// Tests del átomo AppBadge — color, variante filled y contenido
// Nota: el template inicia con comentario HTML, se usa wrapper.find('span') para el elemento real.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppBadge from '@/components/ui/atoms/AppBadge.vue'

describe('AppBadge', () => {
  it('renderiza el slot por defecto', () => {
    const wrapper = mount(AppBadge, { slots: { default: 'Activo' } })
    expect(wrapper.text()).toBe('Activo')
  })

  it('aplica la clase de color correcta — prefijo app-badge--', () => {
    const wrapper = mount(AppBadge, { props: { color: 'green' } })
    expect(wrapper.find('span').classes()).toContain('app-badge--green')
  })

  it('aplica la clase app-badge--filled cuando la prop filled está activa', () => {
    const wrapper = mount(AppBadge, { props: { color: 'blue', filled: true } })
    expect(wrapper.find('span').classes()).toContain('app-badge--filled')
  })

  it('no aplica la clase app-badge--filled por defecto', () => {
    const wrapper = mount(AppBadge, { props: { color: 'gray' } })
    expect(wrapper.find('span').classes()).not.toContain('app-badge--filled')
  })

  it('usa color "blue" por defecto', () => {
    const wrapper = mount(AppBadge)
    expect(wrapper.find('span').classes()).toContain('app-badge--blue')
  })

  it('soporta todos los colores semánticos', () => {
    const colores = ['blue', 'green', 'red', 'amber', 'gray', 'purple'] as const
    for (const color of colores) {
      const wrapper = mount(AppBadge, { props: { color } })
      expect(wrapper.find('span').classes()).toContain(`app-badge--${color}`)
    }
  })
})
