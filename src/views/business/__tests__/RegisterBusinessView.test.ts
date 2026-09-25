import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RegisterBusinessView from '../RegisterBusinessView.vue'
import BusinessRegistrationService from '@/services/business-registration.service'
import { useToastStore } from '@/stores/toast.store'
import { VOICE } from '@/config/voice'

vi.mock('@/services/business-registration.service', () => ({
  default: { register: vi.fn() },
}))

// Contrato de POST /business-registration (sin telefono: se dejó en blanco)
const payload = {
  nombreNegocio: 'Abarrotes Los Pinos',
  nombre: 'Ana',
  apellidos: 'Pérez Soto',
  correo: 'ana@example.com',
}

// VeeValidate valida con un pequeño debounce: se deja pasar antes de leer.
async function settle() {
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}

async function fillAndSubmit(wrapper: VueWrapper, extra: Record<string, string> = {}) {
  const values: Record<string, string> = { ...payload, ...extra }
  for (const [name, value] of Object.entries(values)) {
    await wrapper.get(`input[name="${name}"]`).setValue(value)
  }
  await wrapper.get('form').trigger('submit')
  await settle()
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('RegisterBusinessView', () => {
  it('se monta mostrando el formulario, no la confirmación', () => {
    const wrapper = mount(RegisterBusinessView)
    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Solicitud enviada')
  })

  it('al enviar con éxito llama al servicio con el contrato exacto y muestra la confirmación', async () => {
    vi.mocked(BusinessRegistrationService.register).mockResolvedValue(undefined)
    const wrapper = mount(RegisterBusinessView)

    await fillAndSubmit(wrapper)

    expect(BusinessRegistrationService.register).toHaveBeenCalledExactlyOnceWith(payload)
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('Solicitud enviada')
  })

  it('la confirmación es honesta: credenciales solo si se aprueba, al correo dado; nada si se rechaza', async () => {
    vi.mocked(BusinessRegistrationService.register).mockResolvedValue(undefined)
    const wrapper = mount(RegisterBusinessView)

    await fillAndSubmit(wrapper)

    const text = wrapper.text()
    expect(text).toContain('Si la aprobamos, te mandamos tu usuario y contraseña a ana@example.com')
    expect(text).toContain('Si no, no te enviamos nada')
    // No se promete aviso alguno ni se menciona el proveedor de correo
    expect(text).not.toMatch(/notificaremos|Resend/i)
  })

  it('con teléfono lo manda en el payload', async () => {
    vi.mocked(BusinessRegistrationService.register).mockResolvedValue(undefined)
    const wrapper = mount(RegisterBusinessView)

    await fillAndSubmit(wrapper, { telefono: '55 1234 5678' })

    expect(BusinessRegistrationService.register).toHaveBeenCalledExactlyOnceWith({
      ...payload,
      telefono: '55 1234 5678',
    })
  })

  it('con datos inválidos no llama al servicio', async () => {
    const wrapper = mount(RegisterBusinessView)

    await fillAndSubmit(wrapper, { correo: 'ana@' })

    expect(BusinessRegistrationService.register).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Ese correo no se ve bien')
  })

  it('mientras espera la respuesta bloquea el formulario y no permite un segundo envío', async () => {
    let resolve!: () => void
    vi.mocked(BusinessRegistrationService.register).mockReturnValue(new Promise<void>((r) => { resolve = r }))
    const wrapper = mount(RegisterBusinessView)

    await fillAndSubmit(wrapper)
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[role="status"]').text()).toBe('Enviando tu solicitud…')

    await wrapper.get('form').trigger('submit')
    await settle()
    expect(BusinessRegistrationService.register).toHaveBeenCalledTimes(1)

    resolve()
    await settle()
    expect(wrapper.text()).toContain('Solicitud enviada')
  })

  it('si el servidor falla mantiene el formulario y avisa con el mensaje genérico de la marca', async () => {
    vi.mocked(BusinessRegistrationService.register).mockRejectedValue({ response: { status: 500, data: {} } })
    const wrapper = mount(RegisterBusinessView)

    await fillAndSubmit(wrapper)

    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Solicitud enviada')
    const toast = useToastStore()
    expect(toast.toasts).toHaveLength(1)
    expect(toast.toasts[0]).toMatchObject({ type: 'error', message: VOICE.genericError })
  })

  it('si no hay red avisa que no pudo conectarse, sin culpar al servidor', async () => {
    vi.mocked(BusinessRegistrationService.register).mockRejectedValue(new Error('Network Error'))
    const wrapper = mount(RegisterBusinessView)

    await fillAndSubmit(wrapper)

    const toast = useToastStore()
    expect(toast.toasts[0]).toMatchObject({ type: 'error', message: VOICE.networkError })
  })

  it('un 400 con mensaje en arreglo (class-validator) no rompe y da el aviso genérico', async () => {
    vi.mocked(BusinessRegistrationService.register).mockRejectedValue({
      response: { status: 400, data: { message: ['nombre must be shorter than or equal to 100 characters', 'x must be y'] } },
    })
    const wrapper = mount(RegisterBusinessView)

    await fillAndSubmit(wrapper)

    expect(wrapper.find('form').exists()).toBe(true)
    expect(useToastStore().toasts[0]).toMatchObject({ type: 'error', message: VOICE.genericError })
  })

  it('un 400 que habla del correo lo muestra bajo el campo con el texto de la marca, en vez del inglés del servidor', async () => {
    vi.mocked(BusinessRegistrationService.register).mockRejectedValue({
      response: { status: 400, data: { message: ['correo must be an email'], error: 'Bad Request', statusCode: 400 } },
    })
    const wrapper = mount(RegisterBusinessView, { attachTo: document.body })

    await fillAndSubmit(wrapper)

    const error = wrapper.get('input[name="correo"]').element.closest('.app-input-wrap')?.querySelector('.app-input__error')
    expect(error?.textContent?.trim()).toBe('Ese correo no se ve bien. Revisa que tenga la forma nombre@dominio.com.')
    expect(wrapper.text()).not.toContain('must be an email')
    expect(useToastStore().toasts).toHaveLength(0)
    wrapper.unmount()
  })

  it('un 400 con mensaje de tipo string también se maneja', async () => {
    vi.mocked(BusinessRegistrationService.register).mockRejectedValue({
      response: { status: 400, data: { message: 'Bad Request' } },
    })
    const wrapper = mount(RegisterBusinessView)

    await fillAndSubmit(wrapper)

    expect(useToastStore().toasts[0]).toMatchObject({ message: VOICE.genericError })
  })

  it('después de un fallo se puede volver a enviar', async () => {
    vi.mocked(BusinessRegistrationService.register)
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce(undefined)
    const wrapper = mount(RegisterBusinessView)

    await fillAndSubmit(wrapper)
    await wrapper.get('form').trigger('submit')
    await settle()

    expect(BusinessRegistrationService.register).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Solicitud enviada')
  })
})
