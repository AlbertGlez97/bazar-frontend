// Tests del organismo ContactSection — encabezado + ContactForm ensamblados
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ContactSection from '@/components/ui/organisms/ContactSection.vue'

describe('ContactSection', () => {
  it('renderiza el encabezado de la sección', () => {
    const wrapper = mount(ContactSection)
    expect(wrapper.text()).toContain('¿Tienes dudas antes de empezar?')
  })

  it('incluye el formulario de contacto', () => {
    const wrapper = mount(ContactSection)
    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.find('textarea').exists()).toBe(true)
  })
})
