import { mount, flushPromises, RouterLinkStub, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import RegisterBusinessView from '../RegisterBusinessView.vue'
import BusinessRegistrationService from '@/services/business-registration.service'
import { useToastStore } from '@/stores/toast.store'
import { VOICE } from '@/config/voice'
import { LEGAL_VERSION } from '@/legal/versions'

vi.mock('@/services/business-registration.service', () => ({
  default: { register: vi.fn(), resend: vi.fn(), verifyEmail: vi.fn() },
}))

const TurnstileStub = defineComponent({
  name: 'TurnstileWidget',
  props: { siteKey: { type: String, default: '' } },
  emits: ['verified', 'expired', 'failed'],
  setup(_props, { expose }) {
    expose({ reset: vi.fn() })
    return () => null
  },
})

const values: Record<string, string> = {
  nombreNegocio: 'Abarrotes Los Pinos',
  queVende: 'Abarrotes, dulces y refrescos',
  nombre: 'Ana',
  apellidos: 'Pérez Soto',
  correo: 'ana@example.com',
  telefono: '55 1234 5678',
}

// Contrato de POST /business-registration
const payload = {
  nombreNegocio: 'Abarrotes Los Pinos',
  tipoNegocio: 'abarrotes',
  queVende: 'Abarrotes, dulces y refrescos',
  nombre: 'Ana',
  apellidos: 'Pérez Soto',
  correo: 'ana@example.com',
  telefono: '5512345678',
  aceptaLegal: true,
  versionLegal: LEGAL_VERSION,
  turnstileToken: 'token-1',
  sitioWebEmpresa: '',
}

// VeeValidate valida con un pequeño debounce: se deja pasar antes de leer.
async function settle() {
  await flushPromises()
  if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(30)
  else await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}

function mountView() {
  return mount(RegisterBusinessView, {
    attachTo: document.body,
    global: { stubs: { RouterLink: RouterLinkStub, TurnstileWidget: TurnstileStub } },
  })
}

async function fillAndSubmit(wrapper: VueWrapper, extra: Record<string, string> = {}, token = 'token-1') {
  const all = { ...values, ...extra }
  for (const [name, value] of Object.entries(all)) {
    await wrapper.get(`[name="${name}"]`).setValue(value)
  }
  await wrapper.get('select[name="tipoNegocio"]').setValue('abarrotes')
  await wrapper.get('input[name="aceptaLegal"]').setValue(true)
  wrapper.findComponent(TurnstileStub).vm.$emit('verified', token)
  await flushPromises()
  await wrapper.get('form').trigger('submit')
  await settle()
}

const checkScreen = (wrapper: VueWrapper) => wrapper.find('.register-business__check')
const resendButton = (wrapper: VueWrapper) => wrapper.findAll('button').find((b) => b.text().startsWith('Reenviar correo'))!
const fieldError = (wrapper: VueWrapper, field: string) =>
  wrapper.get(`[name="${field}"]`).element.closest('.app-input-wrap')?.querySelector('.app-input__error')?.textContent?.trim()

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site-key-test')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  document.body.innerHTML = ''
})

describe('RegisterBusinessView', () => {
  it('se monta mostrando el formulario, no la pantalla de revisar el correo', () => {
    const wrapper = mountView()

    expect(wrapper.find('form').isVisible()).toBe(true)
    expect(checkScreen(wrapper).exists()).toBe(false)
    expect(wrapper.text()).toContain('Registra tu negocio')
    wrapper.unmount()
  })

  it('le pasa al formulario la clave pública de Turnstile del entorno', () => {
    const wrapper = mountView()

    expect(wrapper.findComponent(TurnstileStub).props('siteKey')).toBe('site-key-test')
    wrapper.unmount()
  })

  it('al enviar con éxito llama al servicio con el contrato exacto y muestra "Revisa tu correo"', async () => {
    vi.mocked(BusinessRegistrationService.register).mockResolvedValue(undefined)
    const wrapper = mountView()

    await fillAndSubmit(wrapper)

    expect(BusinessRegistrationService.register).toHaveBeenCalledExactlyOnceWith(payload)
    expect(checkScreen(wrapper).exists()).toBe(true)
    expect(wrapper.get('h1').text()).toBe('Revisa tu correo')
    expect(checkScreen(wrapper).text()).toContain('ana@example.com')
    wrapper.unmount()
  })

  it('NO promete que la solicitud ya se está revisando ni que llegarán credenciales', async () => {
    vi.mocked(BusinessRegistrationService.register).mockResolvedValue(undefined)
    const wrapper = mountView()

    await fillAndSubmit(wrapper)

    const text = checkScreen(wrapper).text()
    expect(text).toContain('Hasta que confirmes, nadie revisa tu solicitud')
    expect(text).not.toMatch(/Solicitud enviada|usuario y contraseña|Resend/i)
    wrapper.unmount()
  })

  it('la pantalla de revisar el correo reemplaza al formulario (oculto, con lo escrito conservado)', async () => {
    vi.mocked(BusinessRegistrationService.register).mockResolvedValue(undefined)
    const wrapper = mountView()

    await fillAndSubmit(wrapper)

    expect(wrapper.find('form').isVisible()).toBe(false)
    wrapper.unmount()
  })

  it('el botón "Reenviar correo" arranca con 60 s de espera y se habilita al terminar', async () => {
    vi.useFakeTimers()
    vi.mocked(BusinessRegistrationService.register).mockResolvedValue(undefined)
    const wrapper = mountView()
    await fillAndSubmit(wrapper)

    expect(resendButton(wrapper).text()).toBe('Reenviar correo en 60 s')
    expect(resendButton(wrapper).attributes('disabled')).toBeDefined()

    await vi.advanceTimersByTimeAsync(30_000)
    expect(resendButton(wrapper).text()).toBe('Reenviar correo en 30 s')

    await vi.advanceTimersByTimeAsync(30_000)
    expect(resendButton(wrapper).text()).toBe('Reenviar correo')
    expect(resendButton(wrapper).attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('reenviar llama al servicio con el correo, avisa y vuelve a pedir esperar', async () => {
    vi.useFakeTimers()
    vi.mocked(BusinessRegistrationService.register).mockResolvedValue(undefined)
    vi.mocked(BusinessRegistrationService.resend).mockResolvedValue(undefined)
    const wrapper = mountView()
    await fillAndSubmit(wrapper)
    await vi.advanceTimersByTimeAsync(60_000)

    await resendButton(wrapper).trigger('click')
    await flushPromises()

    expect(BusinessRegistrationService.resend).toHaveBeenCalledExactlyOnceWith('ana@example.com')
    expect(checkScreen(wrapper).get('[role="status"]').text()).toBe('Listo. Si el correo existe, te mandamos otro enlace.')
    expect(resendButton(wrapper).text()).toBe('Reenviar correo en 60 s')
    wrapper.unmount()
  })

  it('no se puede reenviar dos veces mientras corre la espera', async () => {
    vi.mocked(BusinessRegistrationService.register).mockResolvedValue(undefined)
    const wrapper = mountView()
    await fillAndSubmit(wrapper)

    await resendButton(wrapper).trigger('click')
    await flushPromises()

    expect(BusinessRegistrationService.resend).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it.each([
    ['429', { response: { status: 429, data: { code: 'rate_limited' } } }, 'Hiciste muchos intentos. Espera un rato y vuelve a intentar.'],
    ['sin red', new Error('Network Error'), VOICE.networkError],
    ['503', { response: { status: 503, data: { code: 'email_unavailable' } } }, 'Por ahora no pudimos mandar el correo. Intenta de nuevo en un rato.'],
    ['500', { response: { status: 500, data: {} } }, VOICE.genericError],
  ])('si reenviar falla (%s) lo dice en la misma pantalla y se puede volver a intentar', async (_label, rejection, message) => {
    vi.useFakeTimers()
    vi.mocked(BusinessRegistrationService.register).mockResolvedValue(undefined)
    vi.mocked(BusinessRegistrationService.resend).mockRejectedValue(rejection)
    const wrapper = mountView()
    await fillAndSubmit(wrapper)
    await vi.advanceTimersByTimeAsync(60_000)

    await resendButton(wrapper).trigger('click')
    await flushPromises()

    expect(checkScreen(wrapper).get('[role="status"]').text()).toBe(message)
    expect(resendButton(wrapper).attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('"Corregir mi correo" vuelve al formulario con todo lo escrito, y permite enviar otro correo', async () => {
    vi.mocked(BusinessRegistrationService.register).mockResolvedValue(undefined)
    const wrapper = mountView()
    await fillAndSubmit(wrapper)

    await wrapper.findAll('button').find((b) => b.text() === 'Corregir mi correo')!.trigger('click')
    await flushPromises()

    expect(checkScreen(wrapper).exists()).toBe(false)
    expect(wrapper.find('form').isVisible()).toBe(true)
    expect((wrapper.get('[name="correo"]').element as HTMLInputElement).value).toBe('ana@example.com')
    expect((wrapper.get('[name="nombreNegocio"]').element as HTMLInputElement).value).toBe('Abarrotes Los Pinos')

    await wrapper.get('[name="correo"]').setValue('ana.nueva@example.com')
    wrapper.findComponent(TurnstileStub).vm.$emit('verified', 'token-2')
    await flushPromises()
    await wrapper.get('form').trigger('submit')
    await settle()

    expect(BusinessRegistrationService.register).toHaveBeenLastCalledWith(
      expect.objectContaining({ correo: 'ana.nueva@example.com', turnstileToken: 'token-2' }),
    )
    expect(checkScreen(wrapper).text()).toContain('ana.nueva@example.com')
    wrapper.unmount()
  })

  it('mientras envía el botón está ocupado y un segundo envío no llama otra vez', async () => {
    let resolve!: () => void
    vi.mocked(BusinessRegistrationService.register).mockReturnValue(new Promise<void>((r) => { resolve = r }))
    const wrapper = mountView()

    await fillAndSubmit(wrapper)
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('form [role="status"]').text()).toBe('Enviando tu solicitud…')

    await wrapper.get('form').trigger('submit')
    await settle()
    expect(BusinessRegistrationService.register).toHaveBeenCalledTimes(1)

    resolve()
    await settle()
    expect(checkScreen(wrapper).exists()).toBe(true)
    wrapper.unmount()
  })

  it('si el servidor falla mantiene el formulario y avisa con el mensaje genérico de la marca', async () => {
    vi.mocked(BusinessRegistrationService.register).mockRejectedValue({ response: { status: 500, data: {} } })
    const wrapper = mountView()

    await fillAndSubmit(wrapper)

    expect(wrapper.find('form').isVisible()).toBe(true)
    expect(checkScreen(wrapper).exists()).toBe(false)
    const toast = useToastStore()
    expect(toast.toasts).toHaveLength(1)
    expect(toast.toasts[0]).toMatchObject({ type: 'error', message: VOICE.genericError })
    wrapper.unmount()
  })

  it('si falla, NO se pierde nada de lo escrito', async () => {
    vi.mocked(BusinessRegistrationService.register).mockRejectedValue({ response: { status: 500, data: {} } })
    const wrapper = mountView()

    await fillAndSubmit(wrapper)

    expect((wrapper.get('[name="queVende"]').element as HTMLTextAreaElement).value).toBe(values.queVende)
    expect((wrapper.get('[name="telefono"]').element as HTMLInputElement).value).toBe(values.telefono)
    expect((wrapper.get('input[name="aceptaLegal"]').element as HTMLInputElement).checked).toBe(true)
    wrapper.unmount()
  })

  it('si falla pide una verificación de seguridad NUEVA (la anterior ya se gastó) antes de reintentar', async () => {
    vi.mocked(BusinessRegistrationService.register)
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce(undefined)
    const wrapper = mountView()
    await fillAndSubmit(wrapper)

    await wrapper.get('form').trigger('submit') // sin volver a verificar
    await settle()
    expect(BusinessRegistrationService.register).toHaveBeenCalledTimes(1)
    expect(wrapper.get('.business-registration-form__captcha-error').text()).toBe('Completa la verificación de seguridad.')

    wrapper.findComponent(TurnstileStub).vm.$emit('verified', 'token-nuevo')
    await flushPromises()
    await wrapper.get('form').trigger('submit')
    await settle()

    expect(BusinessRegistrationService.register).toHaveBeenCalledTimes(2)
    expect(vi.mocked(BusinessRegistrationService.register).mock.calls[1][0].turnstileToken).toBe('token-nuevo')
    expect(checkScreen(wrapper).exists()).toBe(true)
    wrapper.unmount()
  })

  it('si no hay red avisa que no pudo conectarse, sin culpar al servidor', async () => {
    vi.mocked(BusinessRegistrationService.register).mockRejectedValue(new Error('Network Error'))
    const wrapper = mountView()

    await fillAndSubmit(wrapper)

    expect(useToastStore().toasts[0]).toMatchObject({ type: 'error', message: VOICE.networkError })
    wrapper.unmount()
  })

  it.each([
    ['429', { response: { status: 429, data: { code: 'rate_limited' } } }, 'Hiciste muchos intentos. Espera un rato y vuelve a intentar.'],
    ['503 (correo)', { response: { status: 503, data: { code: 'email_unavailable' } } }, 'Por ahora no pudimos mandar el correo. Intenta de nuevo en un rato.'],
    ['503 (verificación)', { response: { status: 503, data: { code: 'turnstile_unavailable' } } }, 'Por ahora no podemos hacer la verificación de seguridad. Intenta de nuevo en un rato.'],
    ['400 verificación', { response: { status: 400, data: { code: 'turnstile_invalid' } } }, 'No pudimos confirmar la verificación de seguridad. Inténtalo de nuevo.'],
  ])('el servidor responde %s: aviso con palabras claras', async (_label, rejection, message) => {
    vi.mocked(BusinessRegistrationService.register).mockRejectedValue(rejection)
    const wrapper = mountView()

    await fillAndSubmit(wrapper)

    expect(useToastStore().toasts[0]).toMatchObject({ type: 'error', message })
    expect(wrapper.find('form').isVisible()).toBe(true)
    wrapper.unmount()
  })

  it('un 400 con mensaje en arreglo (class-validator) sin campo conocido da el aviso genérico', async () => {
    vi.mocked(BusinessRegistrationService.register).mockRejectedValue({
      response: { status: 400, data: { message: ['nombre must be shorter than or equal to 100 characters', 'x must be y'] } },
    })
    const wrapper = mountView()

    await fillAndSubmit(wrapper)

    expect(wrapper.find('form').isVisible()).toBe(true)
    expect(useToastStore().toasts[0]).toMatchObject({ type: 'error', message: VOICE.genericError })
    wrapper.unmount()
  })

  it('un 400 que habla del correo lo muestra bajo el campo con el texto de la marca, en vez del inglés del servidor', async () => {
    vi.mocked(BusinessRegistrationService.register).mockRejectedValue({
      response: { status: 400, data: { message: ['correo must be an email'], error: 'Bad Request', statusCode: 400 } },
    })
    const wrapper = mountView()

    await fillAndSubmit(wrapper)

    expect(fieldError(wrapper, 'correo')).toBe('Ese correo no se ve bien. Revisa que tenga la forma nombre@dominio.com.')
    expect(wrapper.text()).not.toContain('must be an email')
    expect(useToastStore().toasts).toHaveLength(0)
    wrapper.unmount()
  })

  it('un 400 que habla del teléfono lo muestra bajo el teléfono', async () => {
    vi.mocked(BusinessRegistrationService.register).mockRejectedValue({
      response: { status: 400, data: { message: ['Escribe un teléfono de México de 10 dígitos'] } },
    })
    const wrapper = mountView()

    await fillAndSubmit(wrapper)

    expect(fieldError(wrapper, 'telefono')).toBe('Escribe un número de 10 dígitos, por ejemplo 55 1234 5678.')
    wrapper.unmount()
  })

  it('un 400 con mensaje de tipo string también se maneja', async () => {
    vi.mocked(BusinessRegistrationService.register).mockRejectedValue({
      response: { status: 400, data: { message: 'Bad Request' } },
    })
    const wrapper = mountView()

    await fillAndSubmit(wrapper)

    expect(useToastStore().toasts[0]).toMatchObject({ message: VOICE.genericError })
    wrapper.unmount()
  })
})
