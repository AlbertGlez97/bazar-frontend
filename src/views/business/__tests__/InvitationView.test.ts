import { flushPromises, mount, RouterLinkStub, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import InvitationView from '../InvitationView.vue'
import { AccountInvitationsService } from '@/services/account-invitations.service'

vi.mock('@/services/account-invitations.service', () => ({
  AccountInvitationsService: { inspect: vi.fn(), accept: vi.fn() },
}))
const route = reactive<{ params: Record<string, unknown> }>({ params: {} })
const replace = vi.fn()
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ replace }) }))

const TOKEN = 'dG9rZW4tZGUtcHJ1ZWJhLTMyLWJ5dGVzLWJhc2U2NHU' // 43 caracteres, como el servidor
const preview = { memberName: 'Beto', email: 'beto@example.test', expiresAt: '2026-10-23T17:59:00.000Z' }
const PASSWORD = 'una-clave-larga-1'
const accepted = {
  email: 'beto@example.test',
  accountId: '0190aaaa-0000-7000-8000-0000000000a9',
  device: { deviceId: '0190aaaa-0000-7000-8000-0000000000d1', name: 'Dispositivo de Beto', deviceToken: 'dG9rZW4tZGUtZGlzcG9zaXRpdm8tMzItYnl0ZXMtYmE' },
}

async function open(params: Record<string, unknown> = { token: TOKEN }) {
  route.params = params
  const wrapper = mount(InvitationView, { attachTo: document.body, global: { stubs: { RouterLink: RouterLinkStub } } })
  await flushPromises()
  return wrapper
}
const submitButton = (w: VueWrapper) => w.findAll('button').find((b) => b.text() === 'Crear mi contraseña')
const fill = async (w: VueWrapper, password = PASSWORD, confirm = PASSWORD) => {
  await w.get('input[name="password"]').setValue(password)
  await w.get('input[name="confirm"]').setValue(confirm)
}
const failure = (status: number, code?: string, message?: string) => ({ response: { status, data: { code, message } } })

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  setActivePinia(createPinia())
  document.body.innerHTML = ''
  document.head.querySelectorAll('meta[name="referrer"]').forEach((m) => m.remove())
  vi.mocked(AccountInvitationsService.inspect).mockResolvedValue(preview)
})

describe('InvitationView: al abrir el enlace', () => {
  it('muestra a quién va dirigida y el botón, y solo consulta: no consume nada', async () => {
    const w = await open()

    expect(AccountInvitationsService.inspect).toHaveBeenCalledWith(TOKEN)
    expect(AccountInvitationsService.inspect).toHaveBeenCalledTimes(1)
    expect(AccountInvitationsService.accept).not.toHaveBeenCalled()
    expect(w.get('h1').text()).toBe('Crea tu cuenta')
    expect(w.text()).toContain('Hola, Beto.')
    expect(w.text()).toContain('beto@example.test')
    expect(submitButton(w)).toBeDefined()
    w.unmount()
  })

  it('mientras consulta dice que está revisando el enlace', async () => {
    vi.mocked(AccountInvitationsService.inspect).mockReturnValue(new Promise(() => undefined))
    route.params = { token: TOKEN }
    const w = mount(InvitationView, { attachTo: document.body, global: { stubs: { RouterLink: RouterLinkStub } } })
    await flushPromises()
    expect(w.get('[role="status"]').text()).toContain('Revisando')
    expect(submitButton(w)).toBeUndefined()
    w.unmount()
  })

  it.each([
    ['sin token', {}],
    ['token que no es texto', { token: ['a', 'b'] }],
    ['token con otra forma', { token: 'corto' }],
  ])('%s: dice que el enlace no sirve y no llama al servidor', async (_name, params) => {
    const w = await open(params)
    expect(w.get('h1').text()).toBe('Este enlace no sirve')
    expect(AccountInvitationsService.inspect).not.toHaveBeenCalled()
    expect(submitButton(w)).toBeUndefined()
    w.unmount()
  })

  it('un enlace usado, vencido o reemplazado muestra el mensaje del servidor y cómo seguir', async () => {
    vi.mocked(AccountInvitationsService.inspect).mockRejectedValue(failure(404, 'INVITATION_INVALID', 'Este enlace no sirve. Pide una invitación nueva.'))
    const w = await open()
    expect(w.get('h1').text()).toBe('Este enlace no sirve')
    expect(w.get('[role="alert"]').text()).toBe('Este enlace no sirve. Pide una invitación nueva.')
    expect(w.getComponent(RouterLinkStub).props('to')).toBe('/login')
    w.unmount()
  })

  it('un fallo de conexión no se hace pasar por enlace vencido y permite reintentar', async () => {
    vi.mocked(AccountInvitationsService.inspect).mockRejectedValueOnce(new Error('network'))
    const w = await open()
    expect(w.get('[role="alert"]').text()).toContain('No pudimos completar la acción')
    expect(w.get('h1').text()).not.toBe('Este enlace no sirve')

    await w.get('[data-test="retry"]').trigger('click')
    await flushPromises()
    expect(w.get('h1').text()).toBe('Crea tu cuenta')
    w.unmount()
  })

  it('pide al navegador no mandar el Referer mientras está abierta y lo quita al salir', async () => {
    const w = await open()
    expect(document.head.querySelector('meta[name="referrer"]')?.getAttribute('content')).toBe('no-referrer')
    w.unmount()
    expect(document.head.querySelector('meta[name="referrer"]')).toBeNull()
  })
})

describe('InvitationView: crear la contraseña', () => {
  it('cada campo tiene su etiqueta, id y autocompletado de contraseña nueva', async () => {
    const w = await open()
    for (const name of ['password', 'confirm']) {
      const input = w.get(`input[name="${name}"]`)
      expect(input.attributes('type')).toBe('password')
      expect(input.attributes('autocomplete')).toBe('new-password')
      expect(w.find(`label[for="${input.attributes('id')}"]`).exists()).toBe(true)
    }
    expect(w.text()).toContain('Tú eliges tu contraseña')
    w.unmount()
  })

  it('valida antes de enviar: corta, distinta o vacía no salen a la red', async () => {
    const w = await open()
    for (const [password, confirm, message] of [
      ['', '', 'Escribe una contraseña.'],
      ['corta', 'corta', 'Tu contraseña debe tener al menos 10 caracteres.'],
      [PASSWORD, `${PASSWORD}x`, 'Las dos contraseñas deben ser iguales.'],
    ] as const) {
      await fill(w, password, confirm)
      await submitButton(w)!.trigger('click')
      expect(w.get('[role="alert"]').text()).toContain(message)
    }
    expect(AccountInvitationsService.accept).not.toHaveBeenCalled()
    w.unmount()
  })

  it('al crearla va al login con el correo ya escrito, sin iniciar sesión ni guardar la contraseña', async () => {
    vi.mocked(AccountInvitationsService.accept).mockResolvedValue(accepted)
    const w = await open()
    await fill(w)
    await submitButton(w)!.trigger('click')
    await flushPromises()

    expect(AccountInvitationsService.accept).toHaveBeenCalledWith(TOKEN, PASSWORD)
    expect(replace).toHaveBeenCalledWith({ name: 'Login', query: { email: 'beto@example.test', created: '1', device: '1' } })
    expect(JSON.stringify(replace.mock.calls)).not.toContain(PASSWORD)
    expect(JSON.stringify(replace.mock.calls)).not.toContain(TOKEN)
    expect(JSON.stringify(replace.mock.calls)).not.toContain(accepted.device.deviceToken)
    // Sin sesión: ni token de acceso ni persona elegida; solo el dispositivo, a nombre de la cuenta nueva.
    expect(localStorage.getItem('access_token')).toBeNull()
    w.unmount()
  })

  it('el dispositivo que llega queda guardado a nombre de la cuenta nueva y no toca el de otra cuenta', async () => {
    localStorage.setItem('device_contexts', JSON.stringify({
      version: 1, devices: { 'cuenta-compartida|/api/v1': { deviceId: 'device-a', name: 'Tablet', deviceToken: 'secret-a' } },
    }))
    vi.mocked(AccountInvitationsService.accept).mockResolvedValue(accepted)
    const w = await open()
    await fill(w)
    await submitButton(w)!.trigger('click')
    await flushPromises()

    const saved = JSON.parse(localStorage.getItem('device_contexts')!).devices
    expect(saved[`${accepted.accountId}|/api/v1`]).toEqual(accepted.device)
    expect(saved['cuenta-compartida|/api/v1']).toEqual({ deviceId: 'device-a', name: 'Tablet', deviceToken: 'secret-a' })
    expect(w.text()).not.toContain(accepted.device.deviceToken)
    w.unmount()
  })

  it('si la contraseña falla, no se guarda ningún dispositivo', async () => {
    vi.mocked(AccountInvitationsService.accept).mockRejectedValue(failure(429, 'INVITATION_RATE_LIMITED'))
    const w = await open()
    await fill(w)
    await submitButton(w)!.trigger('click')
    await flushPromises()
    expect(localStorage.getItem('device_contexts')).toBeNull()
    w.unmount()
  })

  it('un doble toque envía una sola vez', async () => {
    let finish!: (v: typeof accepted) => void
    vi.mocked(AccountInvitationsService.accept).mockReturnValue(new Promise((r) => { finish = r }))
    const w = await open()
    await fill(w)
    await submitButton(w)!.trigger('click')
    // Ya enviando, el botón sigue ahí pero bloqueado (cambia su texto por la rueda de espera).
    await w.get('form button').trigger('click')
    await w.get('form').trigger('submit')

    expect(AccountInvitationsService.accept).toHaveBeenCalledTimes(1)
    expect(w.get('form button').attributes('disabled')).toBeDefined()
    finish(accepted)
    await flushPromises()
    w.unmount()
  })

  it('si el enlace ya no sirve al enviar, lo dice y cambia de pantalla', async () => {
    vi.mocked(AccountInvitationsService.accept).mockRejectedValue(failure(404, 'INVITATION_INVALID'))
    const w = await open()
    await fill(w)
    await submitButton(w)!.trigger('click')
    await flushPromises()

    expect(w.get('h1').text()).toBe('Este enlace no sirve')
    expect(replace).not.toHaveBeenCalled()
    w.unmount()
  })

  it('otro fallo deja el formulario para intentar de nuevo con un mensaje sencillo', async () => {
    vi.mocked(AccountInvitationsService.accept).mockRejectedValue(failure(429, 'INVITATION_RATE_LIMITED', 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'))
    const w = await open()
    await fill(w)
    await submitButton(w)!.trigger('click')
    await flushPromises()

    expect(w.get('[role="alert"]').text()).toBe('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.')
    expect(submitButton(w)!.attributes('disabled')).toBeUndefined()
    w.unmount()
  })

  it('el foco pasa al título cuando cambia el resultado', async () => {
    vi.mocked(AccountInvitationsService.inspect).mockRejectedValue(failure(404, 'INVITATION_INVALID'))
    const w = await open()
    expect(document.activeElement).toBe(w.get('h1').element)
    w.unmount()
  })
})
