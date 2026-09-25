// Tests del organismo FeaturesSection — agrupa varias FeatureCard con
// contenido de marketing basado en funcionalidad real del backend
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FeaturesSection from '@/components/ui/organisms/FeaturesSection.vue'

describe('FeaturesSection', () => {
  it('renderiza el título de la sección', () => {
    const wrapper = mount(FeaturesSection)
    expect(wrapper.text()).toContain('Lo que hace por tu negocio')
  })

  it('renderiza varias FeatureCard', () => {
    const wrapper = mount(FeaturesSection)
    const cards = wrapper.findAll('.feature-card')
    expect(cards.length).toBeGreaterThanOrEqual(3)
  })

  it('incluye los beneficios clave del sistema', () => {
    const wrapper = mount(FeaturesSection)
    expect(wrapper.text()).toContain('Tu catálogo, ordenado')
    expect(wrapper.text()).toContain('Ventas en un momento')
    expect(wrapper.text()).toContain('Comisiones sin calculadora')
    expect(wrapper.text()).toContain('Fiado y apartados')
    expect(wrapper.text()).toContain('Sin sorpresas con el inventario')
  })

  it('no promete funciones que la API no tiene', () => {
    const text = mount(FeaturesSection).text()
    expect(text).not.toMatch(/sin internet|offline|reportes|notificaci/i)
  })
})
