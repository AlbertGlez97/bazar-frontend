// Tests del organismo FeaturesSection — agrupa varias FeatureCard con
// contenido de marketing basado en funcionalidad real del backend
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FeaturesSection from '@/components/ui/organisms/FeaturesSection.vue'

describe('FeaturesSection', () => {
  it('renderiza el título de la sección', () => {
    const wrapper = mount(FeaturesSection)
    expect(wrapper.text()).toContain('Hecho para cómo realmente vendes')
  })

  it('renderiza varias FeatureCard', () => {
    const wrapper = mount(FeaturesSection)
    const cards = wrapper.findAll('.feature-card')
    expect(cards.length).toBeGreaterThanOrEqual(3)
  })

  it('incluye los beneficios clave del sistema', () => {
    const wrapper = mount(FeaturesSection)
    expect(wrapper.text()).toContain('Funciona sin internet')
    expect(wrapper.text()).toContain('Fiado y apartados con seguimiento')
    expect(wrapper.text()).toContain('Comisiones automáticas')
  })
})
