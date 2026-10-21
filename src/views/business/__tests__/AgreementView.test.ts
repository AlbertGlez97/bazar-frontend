import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import AgreementView from '../AgreementView.vue'
import { AgreementsService } from '@/services/agreements.service'
import { defaultRulesConfig, versionSummary } from '@/utils/finance-rules'
import type { AgreementPage } from '@/types/finance-rules.types'

vi.mock('@/services/agreements.service', () => ({
  AgreementsService: { inspect: vi.fn(), respond: vi.fn() },
}))
const route = reactive<{ params: Record<string, unknown> }>({ params: {} })
vi.mock('vue-router', () => ({ useRoute: () => route }))

const TOKEN = 'dG9rZW4tZGUtcHJ1ZWJhLTMyLWJ5dGVzLWJhc2U2NHU' // 43 caracteres, como el servidor
const page = (over: Partial<AgreementPage> = {}): AgreementPage => ({
  state: 'pendiente',
  message: null,
  business: 'Bazar Sol',
  memberName: 'Beto',
  proposerName: 'Ana',
  version: 2,
  submittedAt: '2026-10-20T16:00:00.000Z',
  expiresAt: '2026-10-27T16:00:00.000Z',
  rules: versionSummary(defaultRulesConfig()).slice(0, 3),
  warnings: [],
  changes: null,
  approvedBy: ['Ana'],
  waitingFor: ['Beto'],
  ...over,
})
const failure = (status: number, code?: string) => ({ response: { status, data: { code } } })

async function open(params: Record<string, unknown> = { token: TOKEN }) {
  route.params = params
  const wrapper = mount(AgreementView, { attachTo: document.body })
  await flushPromises()
  return wrapper
}
const button = (w: VueWrapper, test: string) => w.find(`[data-test="${test}"]`)
const click = async (w: VueWrapper, test: string) => {
  await button(w, test).trigger('click')
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
  document.head.querySelectorAll('meta[name="referrer"]').forEach((m) => m.remove())
  vi.mocked(AgreementsService.inspect).mockResolvedValue(page())
})

describe('AgreementView: al abrir el enlace', () => {
  it('muestra las reglas y los dos botones, y solo consulta: no responde nada', async () => {
    const w = await open()

    expect(AgreementsService.inspect).toHaveBeenCalledWith(TOKEN)
    expect(AgreementsService.inspect).toHaveBeenCalledTimes(1)
    expect(AgreementsService.respond).not.toHaveBeenCalled()
    expect(w.get('h1').text()).toBe('Reglas de reparto')
    expect(w.text()).toContain('Hola, Beto. Ana propuso estas reglas de reparto para Bazar Sol (versión 2).')
    expect(w.get('[data-test="agreement-rules"]').text()).toContain('Utilidad: 100 % por ser socio')
    expect(button(w, 'agreement-approve').text()).toBe('Aprobar')
    expect(button(w, 'agreement-object').text()).toBe('No estoy de acuerdo')
    expect(w.text()).toContain('Abrir esta página no aprueba nada. Tú decides aquí.')
    expect(w.text()).toContain('Este enlace vence el 27/10/2026.')
    w.unmount()
  })

  it('dice quién ya aprobó y quién falta', async () => {
    const w = await open()
    expect(w.get('[data-test="agreement-approved"]').text()).toBe('Ya aprobaron: Ana.')
    expect(w.get('[data-test="agreement-waiting"]').text()).toBe('Falta responder: Beto.')
    vi.mocked(AgreementsService.inspect).mockResolvedValue(page({ approvedBy: [], waitingFor: [] }))
    const none = await open()
    expect(none.find('[data-test="agreement-approved"]').exists()).toBe(false)
    expect(none.find('[data-test="agreement-waiting"]').exists()).toBe(false)
    w.unmount()
    none.unmount()
  })

  it('con cambios, los muestra con su antes y su ahora; los avisos de las reglas se ven sin asustar', async () => {
    vi.mocked(AgreementsService.inspect).mockResolvedValue(page({
      changes: [{ topic: 'Reservas', before: 'Se aparta 10 %.', after: 'Se aparta 20 %.' }],
      warnings: [{ code: 'RESERVES_HIGH', message: 'Apartas la mitad o más para reservas.' }],
    }))
    const w = await open()
    expect(w.get('[data-test="agreement-changes"]').text()).toContain('Reservas. Antes: Se aparta 10 %. Ahora: Se aparta 20 %.')
    expect(w.text()).toContain('Apartas la mitad o más para reservas.')
    w.unmount()
  })

  it('mientras consulta dice que está revisando el enlace y no muestra botones', async () => {
    vi.mocked(AgreementsService.inspect).mockReturnValue(new Promise(() => undefined))
    const w = await open()
    expect(w.get('[role="status"]').text()).toContain('Revisando')
    expect(w.find('[data-test="agreement-approve"]').exists()).toBe(false)
    w.unmount()
  })

  it.each([
    ['sin token', {}],
    ['token que no es texto', { token: ['a', 'b'] }],
    ['token con otra forma', { token: 'corto' }],
  ])('%s: dice que el enlace no sirve y no llama al servidor', async (_name, params) => {
    const w = await open(params)
    expect(w.get('h1').text()).toBe('Este enlace no sirve')
    expect(w.get('[role="alert"]').text()).toBe('Este enlace no sirve. Pide a un socio que te lo envíe de nuevo.')
    expect(AgreementsService.inspect).not.toHaveBeenCalled()
    w.unmount()
  })

  it('un enlace que el servidor no reconoce (404) da el mismo mensaje', async () => {
    vi.mocked(AgreementsService.inspect).mockRejectedValue(failure(404, 'AGREEMENT_LINK_INVALID'))
    const w = await open()
    expect(w.get('h1').text()).toBe('Este enlace no sirve')
    expect(w.get('[role="alert"]').text()).toBe('Este enlace no sirve. Pide a un socio que te lo envíe de nuevo.')
    expect(w.find('[data-test="agreement-approve"]').exists()).toBe(false)
    w.unmount()
  })

  it('en revisión muestra el aviso y ningún botón de responder', async () => {
    vi.mocked(AgreementsService.inspect).mockResolvedValue(page({
      state: 'en_revision',
      message: 'Esta propuesta está en revisión; recibirás la versión nueva por correo.',
    }))
    const w = await open()
    expect(w.get('h1').text()).toBe('Esta propuesta está en revisión')
    expect(w.get('[data-test="agreement-in-review"]').text()).toBe('Esta propuesta está en revisión; recibirás la versión nueva por correo.')
    expect(w.find('[data-test="agreement-approve"]').exists()).toBe(false)
    expect(w.find('[data-test="agreement-object"]').exists()).toBe(false)
    w.unmount()
  })

  it('si no hay conexión, lo explica y deja reintentar', async () => {
    vi.mocked(AgreementsService.inspect).mockRejectedValueOnce(new Error('red'))
    const w = await open()
    expect(w.get('[role="alert"]').text()).toContain('Revisa tu conexión')

    await click(w, 'retry')
    expect(button(w, 'agreement-approve').exists()).toBe(true)
    expect(AgreementsService.inspect).toHaveBeenCalledTimes(2)
    w.unmount()
  })

  it('no deja pasar el enlace a otras páginas: pone referrer no-referrer y lo quita al salir', async () => {
    const w = await open()
    expect(document.head.querySelector('meta[name="referrer"]')?.getAttribute('content')).toBe('no-referrer')
    w.unmount()
    expect(document.head.querySelector('meta[name="referrer"]')).toBeNull()
  })

  it('el foco pasa al título cuando cambia lo que se ve', async () => {
    const w = await open()
    expect(document.activeElement).toBe(w.get('h1').element)
    w.unmount()
  })
})

describe('AgreementView: aprobar', () => {
  it('"Aprobar" responde una vez y dice lo que pasó', async () => {
    vi.mocked(AgreementsService.respond).mockResolvedValue({ outcome: 'aprobada' })
    const w = await open()

    await click(w, 'agreement-approve')

    expect(AgreementsService.respond).toHaveBeenCalledTimes(1)
    expect(AgreementsService.respond).toHaveBeenCalledWith(TOKEN, 'approve', undefined)
    expect(w.get('h1').text()).toBe('Listo, aprobaste')
    expect(w.get('[data-test="agreement-done"]').text()).toBe('Cuando todos los socios aprueben, las reglas entrarán en vigor.')
    expect(w.find('[data-test="agreement-approve"]').exists()).toBe(false)
    w.unmount()
  })

  it('si era la última respuesta, dice que las reglas ya están vigentes', async () => {
    vi.mocked(AgreementsService.respond).mockResolvedValue({ outcome: 'vigente' })
    const w = await open()
    await click(w, 'agreement-approve')
    expect(w.get('[data-test="agreement-done"]').text()).toBe('Eras el último en responder. Las reglas ya están vigentes.')
    w.unmount()
  })

  it('mientras responde, los botones se desactivan: un segundo toque no envía otra vez', async () => {
    let finish!: (v: { outcome: 'aprobada' }) => void
    vi.mocked(AgreementsService.respond).mockReturnValue(new Promise((done) => { finish = done }))
    const w = await open()

    await button(w, 'agreement-approve').trigger('click')
    await button(w, 'agreement-approve').trigger('click')
    expect(button(w, 'agreement-approve').attributes('disabled')).toBeDefined()
    expect(button(w, 'agreement-object').attributes('disabled')).toBeDefined()
    expect(AgreementsService.respond).toHaveBeenCalledTimes(1)

    finish({ outcome: 'aprobada' })
    await flushPromises()
    expect(w.find('[data-test="agreement-done"]').exists()).toBe(true)
    w.unmount()
  })

  it('dos toques seguidos, antes de que la pantalla se actualice, envían una sola vez', async () => {
    let finish!: (v: { outcome: 'aprobada' }) => void
    vi.mocked(AgreementsService.respond).mockReturnValue(new Promise((done) => { finish = done }))
    const w = await open()
    const approve = button(w, 'agreement-approve').element as HTMLButtonElement

    approve.click()
    approve.click()

    expect(AgreementsService.respond).toHaveBeenCalledTimes(1)
    finish({ outcome: 'aprobada' })
    await flushPromises()
    w.unmount()
  })

  it('si llega tarde porque alguien objetó, dice que está en revisión y no que aprobó', async () => {
    vi.mocked(AgreementsService.respond).mockResolvedValue({ outcome: 'en_revision' })
    const w = await open()
    await click(w, 'agreement-approve')
    expect(w.get('h1').text()).toBe('Esta propuesta está en revisión')
    expect(w.get('[data-test="agreement-in-review"]').text()).toBe('Esta propuesta está en revisión; recibirás la versión nueva por correo.')
    w.unmount()
  })

  it('si el enlace ya no sirve al responder, lo dice; si falla la red, deja intentar otra vez', async () => {
    vi.mocked(AgreementsService.respond).mockRejectedValueOnce(failure(404, 'AGREEMENT_LINK_INVALID'))
    const gone = await open()
    await click(gone, 'agreement-approve')
    expect(gone.get('h1').text()).toBe('Este enlace no sirve')
    gone.unmount()

    vi.mocked(AgreementsService.respond).mockRejectedValueOnce(new Error('red'))
    const offline = await open()
    await click(offline, 'agreement-approve')
    expect(offline.get('[role="alert"]').text()).toContain('Revisa tu conexión')
    expect(button(offline, 'agreement-approve').attributes('disabled')).toBeUndefined()
    offline.unmount()
  })
})

describe('AgreementView: no estoy de acuerdo', () => {
  const objecting = async () => {
    const w = await open()
    await click(w, 'agreement-object')
    return w
  }

  it('pide un motivo con etiqueta, ayuda y contador, y no envía nada todavía', async () => {
    const w = await objecting()
    const area = w.get('textarea')

    expect(AgreementsService.respond).not.toHaveBeenCalled()
    expect(area.attributes('maxlength')).toBe('500')
    expect(area.attributes('autocomplete')).toBe('off')
    expect(w.get(`label[for="${area.attributes('id')}"]`).text()).toBe('¿Por qué no estás de acuerdo?')
    expect(w.text()).toContain('Escribe en pocas palabras. Los demás socios lo verán.')
    expect(w.text()).toContain('0/500')
    expect(w.find('[data-test="agreement-approve"]').exists()).toBe(false)
    w.unmount()
  })

  it('sin motivo no se envía y se dice por qué', async () => {
    const w = await objecting()
    await w.get('textarea').setValue('   ')
    await w.get('form').trigger('submit')
    await flushPromises()

    expect(AgreementsService.respond).not.toHaveBeenCalled()
    expect(w.text()).toContain('Escribe en pocas palabras por qué no estás de acuerdo.')
    w.unmount()
  })

  it('envía el motivo (sin espacios de los lados) y dice que los demás lo verán', async () => {
    vi.mocked(AgreementsService.respond).mockResolvedValue({ outcome: 'objetada' })
    const w = await objecting()
    await w.get('textarea').setValue('  Quiero más reservas  ')
    await w.get('form').trigger('submit')
    await flushPromises()

    expect(AgreementsService.respond).toHaveBeenCalledWith(TOKEN, 'object', 'Quiero más reservas')
    expect(w.get('h1').text()).toBe('Guardamos tu respuesta')
    expect(w.get('[data-test="agreement-done"]').text()).toBe('Los demás socios verán tu motivo. Recibirás la versión nueva por correo.')
    w.unmount()
  })

  it('dos envíos seguidos del formulario, antes de que la pantalla se actualice, mandan el motivo una sola vez', async () => {
    let finish!: (v: { outcome: 'objetada' }) => void
    vi.mocked(AgreementsService.respond).mockReturnValue(new Promise((done) => { finish = done }))
    const w = await objecting()
    await w.get('textarea').setValue('Quiero más reservas')
    const form = w.get('form').element

    form.dispatchEvent(new Event('submit', { cancelable: true }))
    form.dispatchEvent(new Event('submit', { cancelable: true }))

    expect(AgreementsService.respond).toHaveBeenCalledTimes(1)
    finish({ outcome: 'objetada' })
    await flushPromises()
    w.unmount()
  })

  it('"Volver" regresa a los dos botones sin enviar nada', async () => {
    const w = await objecting()
    await click(w, 'agreement-back')
    expect(w.find('textarea').exists()).toBe(false)
    expect(button(w, 'agreement-approve').exists()).toBe(true)
    expect(AgreementsService.respond).not.toHaveBeenCalled()
    w.unmount()
  })

  it('si falla al enviar, conserva lo escrito y deja intentar otra vez; si el enlace murió, lo dice', async () => {
    vi.mocked(AgreementsService.respond).mockRejectedValueOnce(new Error('red'))
    const w = await objecting()
    await w.get('textarea').setValue('Quiero más reservas')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect((w.get('textarea').element as HTMLTextAreaElement).value).toBe('Quiero más reservas')
    expect(w.text()).toContain('Revisa tu conexión')

    vi.mocked(AgreementsService.respond).mockRejectedValueOnce(failure(404, 'AGREEMENT_LINK_INVALID'))
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.get('h1').text()).toBe('Este enlace no sirve')
    w.unmount()
  })

  it('el servidor puede rechazar el motivo y se muestra su explicación', async () => {
    vi.mocked(AgreementsService.respond).mockRejectedValue(failure(400, 'AGREEMENT_REASON_REQUIRED'))
    const w = await objecting()
    await w.get('textarea').setValue('algo')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Escribe en pocas palabras por qué no estás de acuerdo.')
    expect(w.find('textarea').exists()).toBe(true)
    w.unmount()
  })
})
