import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RegisterBusinessView from '../RegisterBusinessView.vue'
import BusinessRegistrationService from '@/services/business-registration.service'
import { useToastStore } from '@/stores/toast.store'

vi.mock('@/services/business-registration.service', () => ({
  default: { register: vi.fn() },
}))

const payload = {
  nombreNegocio: 'Bazar de Ana',
  nombreSocio: 'Ana Pérez',
  contactoSocio: 'ana@example.com',
}

async function fillAndSubmit(wrapper: ReturnType<typeof mount>) {
  const inputs = wrapper.findAll('input')
  await inputs[0].setValue(payload.nombreNegocio)
  await inputs[1].setValue(payload.nombreSocio)
  await inputs[2].setValue(payload.contactoSocio)
  await wrapper.find('form').trigger('submit')
  await flushPromises()
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

  it('al enviar con éxito llama al servicio y muestra la confirmación sin login', async () => {
    vi.mocked(BusinessRegistrationService.register).mockResolvedValue(undefined)
    const wrapper = mount(RegisterBusinessView)

    await fillAndSubmit(wrapper)

    expect(BusinessRegistrationService.register).toHaveBeenCalledExactlyOnceWith(payload)
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('Solicitud enviada')
    expect(wrapper.text()).toContain('Te notificaremos por correo cuando sea aprobada')
  })

  it('si el servicio falla, mantiene el formulario y notifica por toast', async () => {
    vi.mocked(BusinessRegistrationService.register).mockRejectedValue(
      { response: { data: { message: 'Negocio duplicado' } } }
    )
    const wrapper = mount(RegisterBusinessView)

    await fillAndSubmit(wrapper)

    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Solicitud enviada')

    const toast = useToastStore()
    expect(toast.toasts).toHaveLength(1)
    expect(toast.toasts[0]).toMatchObject({ type: 'error', message: 'Negocio duplicado' })
  })

  it('usa un mensaje de error genérico si el servidor no da detalle', async () => {
    vi.mocked(BusinessRegistrationService.register).mockRejectedValue(new Error('offline'))
    const wrapper = mount(RegisterBusinessView)

    await fillAndSubmit(wrapper)

    const toast = useToastStore()
    expect(toast.toasts[0]).toMatchObject({
      type: 'error',
      message: 'No se pudo enviar tu solicitud, intenta de nuevo',
    })
  })
})
