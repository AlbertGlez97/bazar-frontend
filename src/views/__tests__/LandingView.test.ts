// Tests de la vista LandingView — se ensambla sin errores e incluye las
// secciones esperadas (hero, features, contacto). Se mockea vue-router
// porque LandingHero navega vía RouterLink.
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-router', () => ({
  RouterLink: { props: ['to'], template: '<a><slot /></a>' },
}))

import LandingView from '@/views/LandingView.vue'

describe('LandingView', () => {
  it('se monta sin errores', () => {
    const wrapper = mount(LandingView)
    expect(wrapper.find('.landing-view').exists()).toBe(true)
  })

  it('incluye la sección hero con la propuesta de valor', () => {
    const wrapper = mount(LandingView)
    expect(wrapper.text()).toContain('bazar')
  })

  it('incluye la sección de beneficios', () => {
    const wrapper = mount(LandingView)
    expect(wrapper.text()).toContain('Hecho para cómo realmente vendes')
  })

  it('incluye la sección de contacto con su formulario', () => {
    const wrapper = mount(LandingView)
    expect(wrapper.text()).toContain('¿Tienes dudas antes de empezar?')
    expect(wrapper.find('form').exists()).toBe(true)
  })
})
