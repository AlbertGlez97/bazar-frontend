import { flushPromises, mount, RouterLinkStub, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import ConfirmEmailView from '../ConfirmEmailView.vue'
import { MemberEmailService } from '@/services/agreements.service'

vi.mock('@/services/agreements.service', () => ({
  MemberEmailService: { inspect: vi.fn(), confirm: vi.fn() },
}))
const route = reactive<{ params: Record<string, unknown> }>({ params: {} })
vi.mock('vue-router', () => ({ useRoute: () => route }))

const TOKEN = 'dG9rZW4tZGUtcHJ1ZWJhLTMyLWJ5dGVzLWJhc2U2NHU' // 43 caracteres, como el servidor
const preview = { memberName: 'Ana', correo: 'a***@e***.com', expiresAt: '2026-10-23T17:59:00.000Z' }
const failure = (status: number, code?: string) => ({ response: { status, data: { code } } })

async function open(params: Record<string, unknown> = { token: TOKEN }) {
  route.params = params
  const wrapper = mount(ConfirmEmailView, { attachTo: document.body, global: { stubs: { RouterLink: RouterLinkStub } } })
  await flushPromises()
  return wrapper
}
const confirmButton = (w: VueWrapper) => w.find('[data-test="confirm-email"]')

beforeEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
  document.head.querySelectorAll('meta[name="referrer"]').forEach((m) => m.remove())
  vi.mocked(MemberEmailService.inspect).mockResolvedValue(preview)
})

describe('ConfirmEmailView', () => {
  it('muestra de quién es el correo (enmascarado) y el botón, y solo consulta: no confirma nada', async () => {
    const w = await open()

    expect(MemberEmailService.inspect).toHaveBeenCalledWith(TOKEN)
    expect(MemberEmailService.confirm).not.toHaveBeenCalled()
    expect(w.get('h1').text()).toBe('Confirma tu correo')
    expect(w.text()).toContain('Hola, Ana. Vas a usar a***@e***.com para recibir las reglas por aprobar.')
    expect(w.text()).toContain('Este enlace vence el 23/10/2026.')
    expect(confirmButton(w).text()).toBe('Confirmar mi correo')
    w.unmount()
  })

  it('mientras consulta dice que está revisando el enlace', async () => {
    vi.mocked(MemberEmailService.inspect).mockReturnValue(new Promise(() => undefined))
    const w = await open()
    expect(w.get('[role="status"]').text()).toContain('Revisando')
    expect(confirmButton(w).exists()).toBe(false)
    w.unmount()
  })

  it.each([
    ['sin token', {}],
    ['token con otra forma', { token: 'corto' }],
  ])('%s: dice que el enlace no sirve y no llama al servidor', async (_name, params) => {
    const w = await open(params)
    expect(w.get('h1').text()).toBe('Este enlace no sirve')
    expect(w.get('[role="alert"]').text()).toBe('Este enlace no sirve. Escribe tu correo de nuevo para recibir otro.')
    expect(MemberEmailService.inspect).not.toHaveBeenCalled()
    expect(w.findComponent(RouterLinkStub).props('to')).toBe('/login')
    w.unmount()
  })

  it('un enlace desconocido, usado, vencido o reemplazado (404) da el mismo mensaje', async () => {
    vi.mocked(MemberEmailService.inspect).mockRejectedValue(failure(404, 'MEMBER_EMAIL_LINK_INVALID'))
    const w = await open()
    expect(w.get('h1').text()).toBe('Este enlace no sirve')
    expect(confirmButton(w).exists()).toBe(false)
    w.unmount()
  })

  it('si no hay conexión, lo explica y deja reintentar', async () => {
    vi.mocked(MemberEmailService.inspect).mockRejectedValueOnce(new Error('red'))
    const w = await open()
    expect(w.get('[role="alert"]').text()).toContain('Revisa tu conexión')
    await w.get('[data-test="retry"]').trigger('click')
    await flushPromises()
    expect(confirmButton(w).exists()).toBe(true)
    w.unmount()
  })

  it('el botón confirma una vez, dice que quedó listo y lleva a entrar', async () => {
    vi.mocked(MemberEmailService.confirm).mockResolvedValue({ correo: 'a***@e***.com' })
    const w = await open()

    await confirmButton(w).trigger('click')
    await flushPromises()

    expect(MemberEmailService.confirm).toHaveBeenCalledTimes(1)
    expect(MemberEmailService.confirm).toHaveBeenCalledWith(TOKEN)
    expect(w.get('h1').text()).toBe('Listo')
    expect(w.get('[data-test="confirm-done"]').text()).toBe('Tu correo a***@e***.com quedó confirmado. Aquí llegarán las reglas por aprobar.')
    expect(w.findComponent(RouterLinkStub).props('to')).toBe('/login')
    w.unmount()
  })

  it('mientras confirma, el botón se desactiva: un segundo toque no envía otra vez', async () => {
    let finish!: (v: { correo: string }) => void
    vi.mocked(MemberEmailService.confirm).mockReturnValue(new Promise((done) => { finish = done }))
    const w = await open()

    await confirmButton(w).trigger('click')
    await confirmButton(w).trigger('click')
    expect(confirmButton(w).attributes('disabled')).toBeDefined()
    expect(MemberEmailService.confirm).toHaveBeenCalledTimes(1)

    finish({ correo: 'a***@e***.com' })
    await flushPromises()
    w.unmount()
  })

  it('dos toques seguidos, antes de que la pantalla se actualice, confirman una sola vez', async () => {
    let finish!: (v: { correo: string }) => void
    vi.mocked(MemberEmailService.confirm).mockReturnValue(new Promise((done) => { finish = done }))
    const w = await open()
    const confirm = confirmButton(w).element as HTMLButtonElement

    confirm.click()
    confirm.click()

    expect(MemberEmailService.confirm).toHaveBeenCalledTimes(1)
    finish({ correo: 'a***@e***.com' })
    await flushPromises()
    w.unmount()
  })

  it('si falla la red al confirmar, deja intentar otra vez; si el enlace ya no sirve, lo dice', async () => {
    vi.mocked(MemberEmailService.confirm).mockRejectedValueOnce(new Error('red'))
    const w = await open()
    await confirmButton(w).trigger('click')
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toContain('Revisa tu conexión')
    expect(confirmButton(w).attributes('disabled')).toBeUndefined()

    vi.mocked(MemberEmailService.confirm).mockRejectedValueOnce(failure(404, 'MEMBER_EMAIL_LINK_INVALID'))
    await confirmButton(w).trigger('click')
    await flushPromises()
    expect(w.get('h1').text()).toBe('Este enlace no sirve')
    w.unmount()
  })

  it('pone referrer no-referrer mientras está abierta y mueve el foco al título', async () => {
    const w = await open()
    expect(document.head.querySelector('meta[name="referrer"]')?.getAttribute('content')).toBe('no-referrer')
    expect(document.activeElement).toBe(w.get('h1').element)
    w.unmount()
    expect(document.head.querySelector('meta[name="referrer"]')).toBeNull()
  })
})
