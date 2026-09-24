// Tests de la molécula ContactForm — validación de cliente, emisión de evento
// y confirmación simulada (no hay backend real, ver TODO en ContactForm.vue)
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ContactForm from '@/components/ui/molecules/ContactForm.vue'

describe('ContactForm', () => {
  it('no emite submit y muestra errores cuando los campos están vacíos', async () => {
    const wrapper = mount(ContactForm)
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('El nombre es requerido')
    expect(wrapper.text()).toContain('El correo es requerido')
    expect(wrapper.text()).toContain('El mensaje es requerido')
  })

  it('rechaza un correo con formato inválido', async () => {
    const wrapper = mount(ContactForm)

    await wrapper.find('input[type="email"]').setValue('correo-invalido')
    await wrapper.find('input[type="email"]').trigger('blur')

    expect(wrapper.text()).toContain('Formato de correo inválido')
  })

  it('emite submit con el payload correcto cuando los datos son válidos', async () => {
    const wrapper = mount(ContactForm)

    const textInputs = wrapper.findAll('input')
    await textInputs[0].setValue('Ana Pérez')
    await wrapper.find('input[type="email"]').setValue('ana@example.com')
    await wrapper.find('textarea').setValue('Quiero más información')

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toHaveLength(1)
    expect(wrapper.emitted('submit')?.[0]).toEqual([
      { name: 'Ana Pérez', email: 'ana@example.com', message: 'Quiero más información' },
    ])
  })

  it('asocia todos los labels con un control y sin ids repetidos (accesibilidad)', () => {
    // attachTo: el navegador resuelve label.control sobre el documento
    const wrapper = mount(ContactForm, { attachTo: document.body })
    const labels = wrapper.findAll('label')
    const ids = wrapper.findAll('input, textarea').map((c) => c.attributes('id'))

    expect(labels.length).toBeGreaterThan(0)
    for (const label of labels) {
      expect((label.element as HTMLLabelElement).control).not.toBeNull()
    }
    expect(ids.every(Boolean)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
    wrapper.unmount()
  })

  it('muestra el mensaje de confirmación simulado tras un envío válido', async () => {
    const wrapper = mount(ContactForm)

    const textInputs = wrapper.findAll('input')
    await textInputs[0].setValue('Ana Pérez')
    await wrapper.find('input[type="email"]').setValue('ana@example.com')
    await wrapper.find('textarea').setValue('Quiero más información')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain('¡Gracias, Ana Pérez!')
    expect(wrapper.find('form').exists()).toBe(false)
  })
})
