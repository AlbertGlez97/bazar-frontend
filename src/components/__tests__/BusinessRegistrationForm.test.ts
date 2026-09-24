// Tests de la molécula BusinessRegistrationForm — validación de cliente y
// emisión de evento. No hace fetch (eso vive en RegisterBusinessView).
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BusinessRegistrationForm from '@/components/ui/molecules/BusinessRegistrationForm.vue'

function fillValidForm(wrapper: ReturnType<typeof mount>) {
  const inputs = wrapper.findAll('input')
  return Promise.all([
    inputs[0].setValue('Bazar de Ana'),
    inputs[1].setValue('Ana Pérez'),
    inputs[2].setValue('ana@example.com'),
  ])
}

describe('BusinessRegistrationForm', () => {
  it('no emite submit y muestra errores cuando los campos están vacíos', async () => {
    const wrapper = mount(BusinessRegistrationForm)
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('El nombre del negocio es requerido')
    expect(wrapper.text()).toContain('El nombre del socio es requerido')
    expect(wrapper.text()).toContain('El contacto del socio es requerido')
  })

  it('rechaza un contacto que no es ni correo ni teléfono válido', async () => {
    const wrapper = mount(BusinessRegistrationForm)
    const inputs = wrapper.findAll('input')
    await inputs[2].setValue('abc')
    await inputs[2].trigger('blur')

    expect(wrapper.text()).toContain('Ingresa un correo o teléfono válido')
  })

  it('acepta un teléfono como contacto válido', async () => {
    const wrapper = mount(BusinessRegistrationForm)
    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('Bazar de Ana')
    await inputs[1].setValue('Ana Pérez')
    await inputs[2].setValue('55 1234 5678')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')?.[0]).toEqual([
      { nombreNegocio: 'Bazar de Ana', nombreSocio: 'Ana Pérez', contactoSocio: '55 1234 5678' },
    ])
  })

  it('emite submit con el payload correcto cuando los datos son válidos (correo)', async () => {
    const wrapper = mount(BusinessRegistrationForm)
    await fillValidForm(wrapper)
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toHaveLength(1)
    expect(wrapper.emitted('submit')?.[0]).toEqual([
      { nombreNegocio: 'Bazar de Ana', nombreSocio: 'Ana Pérez', contactoSocio: 'ana@example.com' },
    ])
  })

  it('asocia todos los labels con un control y sin ids repetidos (accesibilidad)', () => {
    // attachTo: el navegador resuelve label.control sobre el documento
    const wrapper = mount(BusinessRegistrationForm, { attachTo: document.body })
    const labels = wrapper.findAll('label')
    const ids = wrapper.findAll('input').map((i) => i.attributes('id'))

    expect(labels.length).toBeGreaterThan(0)
    for (const label of labels) {
      expect((label.element as HTMLLabelElement).control).not.toBeNull()
    }
    expect(ids.every(Boolean)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
    wrapper.unmount()
  })

  it('deshabilita el botón de envío mientras loading es true', () => {
    const wrapper = mount(BusinessRegistrationForm, { props: { loading: true } })
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })
})
