// Tests de la molécula DeviceIdentifyForm — valida identifier+name y emite
// `submit`. No hace fetch (eso vive en SelectContextView).
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DeviceIdentifyForm from '@/components/ui/organisms/DeviceIdentifyForm.vue'

function fillValidForm(wrapper: ReturnType<typeof mount>) {
  const inputs = wrapper.findAll('input')
  return Promise.all([
    inputs[0].setValue('shared-tablet'),
    inputs[1].setValue('Shared tablet'),
  ])
}

describe('DeviceIdentifyForm', () => {
  it('no emite submit y muestra errores cuando los campos están vacíos', async () => {
    const wrapper = mount(DeviceIdentifyForm)
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('Escribe el identificador del dispositivo.')
    expect(wrapper.text()).toContain('Escribe el nombre del dispositivo.')
  })

  it('emite submit con el payload correcto cuando los datos son válidos', async () => {
    const wrapper = mount(DeviceIdentifyForm)
    await fillValidForm(wrapper)
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toHaveLength(1)
    expect(wrapper.emitted('submit')?.[0]).toEqual([
      { identifier: 'shared-tablet', name: 'Shared tablet' },
    ])
  })

  it('muestra el mensaje de error (ej. 403) que le pasa el padre', () => {
    const wrapper = mount(DeviceIdentifyForm, {
      props: { error: 'Este dispositivo no está registrado con nosotros todavía. Contacta a soporte.' },
    })

    expect(wrapper.text()).toContain('Este dispositivo no está registrado con nosotros todavía. Contacta a soporte.')
  })

  it('la alerta es de tipo "error" por defecto (credenciales que no coinciden)', () => {
    const wrapper = mount(DeviceIdentifyForm, { props: { error: 'No coincide.' } })

    expect(wrapper.find('[role="alert"]').classes()).toContain('app-alert--error')
  })

  it('con errorType "warning" la alerta se ve distinta (identificador ya usado)', () => {
    const wrapper = mount(DeviceIdentifyForm, {
      props: { error: 'Este identificador ya fue usado.', errorType: 'warning' },
    })

    const alert = wrapper.find('[role="alert"]')
    expect(alert.classes()).toContain('app-alert--warning')
    expect(alert.classes()).not.toContain('app-alert--error')
    expect(wrapper.text()).toContain('Este identificador ya fue usado.')
  })

  it('con un error visible el formulario sigue editable y se puede reenviar', async () => {
    const wrapper = mount(DeviceIdentifyForm, {
      props: { error: 'Este identificador ya fue usado.', errorType: 'warning' },
    })
    await fillValidForm(wrapper)
    await wrapper.find('form').trigger('submit')

    expect(wrapper.findAll('input').every((i) => i.attributes('disabled') === undefined)).toBe(true)
    expect(wrapper.find('button').attributes('disabled')).toBeUndefined()
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('no muestra ninguna alerta cuando no hay error', () => {
    const wrapper = mount(DeviceIdentifyForm)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('cuenta personal: pide un código a un socio y lo dice con sus pasos, con la ayuda debajo', () => {
    const wrapper = mount(DeviceIdentifyForm, { props: { bound: true } })
    expect(wrapper.text()).toContain('Un socio te puede dar un código. Pídele que entre a Ajustes y luego a Dispositivos, y toque Registrar dispositivo. Escribe aquí el código y el nombre que te dé.')
    expect(wrapper.text()).toContain('El código sirve una sola vez.')
    expect(wrapper.findAll('label').map((l) => l.text())).toEqual(['Código del dispositivo', 'Nombre del dispositivo'])
    expect(wrapper.text()).not.toContain('Este dispositivo aún no está identificado')
  })

  it('cuenta personal: valida y emite igual que siempre', async () => {
    const wrapper = mount(DeviceIdentifyForm, { props: { bound: true } })
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')).toBeUndefined()
    await fillValidForm(wrapper)
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]).toEqual([{ identifier: 'shared-tablet', name: 'Shared tablet' }])
  })

  it('el login compartido no ve la ayuda de "código" ni cambia sus textos', () => {
    const wrapper = mount(DeviceIdentifyForm)
    expect(wrapper.text()).not.toContain('El código sirve una sola vez.')
    expect(wrapper.findAll('label').map((l) => l.text())).toEqual(['Identificador del dispositivo', 'Nombre del dispositivo'])
  })

  it('deshabilita el botón de envío mientras loading es true', () => {
    const wrapper = mount(DeviceIdentifyForm, { props: { loading: true } })
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })
})
