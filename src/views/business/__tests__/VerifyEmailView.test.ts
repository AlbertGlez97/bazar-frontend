import { flushPromises, mount, RouterLinkStub, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import VerifyEmailView from '../VerifyEmailView.vue'
import BusinessRegistrationService from '@/services/business-registration.service'
import { VOICE } from '@/config/voice'

vi.mock('@/services/business-registration.service', () => ({
  default: { register: vi.fn(), resend: vi.fn(), verifyEmail: vi.fn() },
}))

const route = reactive<{ query: Record<string, unknown> }>({ query: {} })
vi.mock('vue-router', () => ({ useRoute: () => route }))

const TOKEN = 'dG9rZW4tZGUtcHJ1ZWJhLWRlLTMyLWJ5dGVzLWJhc2U2NHVybA'

function mountView(query: Record<string, unknown> = { token: TOKEN }) {
  route.query = query
  return mount(VerifyEmailView, {
    attachTo: document.body,
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
}

const confirmButton = (wrapper: VueWrapper) => wrapper.findAll('button').find((b) => b.text() === 'Confirmar mi correo')
const linkInvalid = { response: { status: 400, data: { code: 'link_invalid' } } }

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('VerifyEmailView: antes de tocar el botón', () => {
  it('muestra el botón "Confirmar mi correo" y NO llama al servidor al abrir la página', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Confirma tu correo')
    expect(confirmButton(wrapper)).toBeDefined()
    // los escáneres de correo abren el enlace solos: abrir la página nunca confirma nada
    expect(BusinessRegistrationService.verifyEmail).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('sin token en el enlace dice que no sirve, sin botón de confirmar', () => {
    const wrapper = mountView({})

    expect(wrapper.text()).toContain('Este enlace no sirve')
    expect(confirmButton(wrapper)).toBeUndefined()
    wrapper.unmount()
  })

  it('un token que no es texto (varios ?token=) tampoco sirve', () => {
    const wrapper = mountView({ token: ['a', 'b'] })

    expect(wrapper.text()).toContain('Este enlace no sirve')
    expect(BusinessRegistrationService.verifyEmail).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})

describe('VerifyEmailView: confirmar', () => {
  it('al tocar el botón manda el token por POST y muestra el mensaje de éxito', async () => {
    vi.mocked(BusinessRegistrationService.verifyEmail).mockResolvedValue(undefined)
    const wrapper = mountView()

    await confirmButton(wrapper)!.trigger('click')
    await flushPromises()

    expect(BusinessRegistrationService.verifyEmail).toHaveBeenCalledExactlyOnceWith(TOKEN)
    expect(wrapper.get('[role="status"]').text()).toBe('Listo. Revisaremos tu solicitud y te escribiremos por WhatsApp.')
    expect(confirmButton(wrapper)).toBeUndefined()
    wrapper.unmount()
  })

  it('mientras confirma el botón está ocupado y un segundo toque no llama otra vez', async () => {
    let resolve!: () => void
    vi.mocked(BusinessRegistrationService.verifyEmail).mockReturnValue(new Promise<void>((r) => { resolve = r }))
    const wrapper = mountView()

    await wrapper.get('button').trigger('click')
    await wrapper.get('button').trigger('click')

    expect(BusinessRegistrationService.verifyEmail).toHaveBeenCalledTimes(1)
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    resolve()
    await flushPromises()
    wrapper.unmount()
  })

  it('un enlace vencido o ya usado lo explica y ofrece pedir otro', async () => {
    vi.mocked(BusinessRegistrationService.verifyEmail).mockRejectedValue(linkInvalid)
    const wrapper = mountView()

    await confirmButton(wrapper)!.trigger('click')
    await flushPromises()

    const alert = wrapper.get('[role="alert"]')
    expect(alert.text()).toContain('Este enlace ya se usó o venció')
    expect(wrapper.find('input[name="correo"]').exists()).toBe(true)
    expect(wrapper.findAll('button').some((b) => b.text() === 'Pedir otro enlace')).toBe(true)
    wrapper.unmount()
  })

  it('pedir otro enlace manda el correo escrito y avisa sin revelar si existe', async () => {
    vi.mocked(BusinessRegistrationService.verifyEmail).mockRejectedValue(linkInvalid)
    vi.mocked(BusinessRegistrationService.resend).mockResolvedValue(undefined)
    const wrapper = mountView()
    await confirmButton(wrapper)!.trigger('click')
    await flushPromises()

    await wrapper.get('input[name="correo"]').setValue('  Ana@Example.com ')
    await wrapper.findAll('button').find((b) => b.text() === 'Pedir otro enlace')!.trigger('click')
    await flushPromises()

    expect(BusinessRegistrationService.resend).toHaveBeenCalledExactlyOnceWith('ana@example.com')
    expect(wrapper.get('[role="status"]').text()).toBe('Listo. Si ese correo tiene una solicitud sin confirmar, te mandamos otro enlace.')
    wrapper.unmount()
  })

  it('pedir otro enlace con el correo en blanco o mal escrito pide corregirlo y no llama al servidor', async () => {
    vi.mocked(BusinessRegistrationService.verifyEmail).mockRejectedValue(linkInvalid)
    const wrapper = mountView()
    await confirmButton(wrapper)!.trigger('click')
    await flushPromises()
    const ask = () => wrapper.findAll('button').find((b) => b.text() === 'Pedir otro enlace')!

    await ask().trigger('click')
    await flushPromises()
    expect(wrapper.get('.app-input__error').text()).toBe('Escribe tu correo.')

    await wrapper.get('input[name="correo"]').setValue('ana@')
    await ask().trigger('click')
    await flushPromises()
    expect(wrapper.get('.app-input__error').text()).toContain('Ese correo no se ve bien')
    expect(BusinessRegistrationService.resend).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it.each([
    ['sin red', new Error('Network Error'), VOICE.networkError],
    ['429', { response: { status: 429, data: { code: 'rate_limited' } } }, 'Hiciste muchos intentos. Espera un rato y vuelve a intentar.'],
    ['503', { response: { status: 503, data: { code: 'email_unavailable' } } }, 'Por ahora no pudimos terminar. Intenta de nuevo en un rato.'],
    ['500', { response: { status: 500, data: {} } }, VOICE.genericError],
  ])('un fallo (%s) lo dice con palabras claras y deja volver a intentar con el mismo enlace', async (_label, rejection, message) => {
    vi.mocked(BusinessRegistrationService.verifyEmail).mockRejectedValue(rejection)
    const wrapper = mountView()

    await confirmButton(wrapper)!.trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe(message)
    expect(confirmButton(wrapper)).toBeDefined()
    expect(confirmButton(wrapper)!.attributes('disabled')).toBeUndefined()

    vi.mocked(BusinessRegistrationService.verifyEmail).mockResolvedValue(undefined)
    await confirmButton(wrapper)!.trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toContain('Listo.')
    wrapper.unmount()
  })

  it('el resultado se anuncia: el foco pasa al título del nuevo estado', async () => {
    vi.mocked(BusinessRegistrationService.verifyEmail).mockResolvedValue(undefined)
    const wrapper = mountView()

    await confirmButton(wrapper)!.trigger('click')
    await flushPromises()

    expect(document.activeElement).toBe(wrapper.get('h1').element)
    expect(wrapper.get('h1').attributes('tabindex')).toBe('-1')
    wrapper.unmount()
  })

  it('el token no se muestra en pantalla', async () => {
    const wrapper = mountView()

    expect(wrapper.html()).not.toContain(TOKEN)
    wrapper.unmount()
  })
})
