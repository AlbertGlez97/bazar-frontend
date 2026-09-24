// Tests del organismo LandingHero — renderiza los dos CTA y navegan a las
// rutas correctas. Se mockea vue-router para no depender de un router real.
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-router', () => ({
  RouterLink: {
    props: ['to'],
    template: '<a :data-to="JSON.stringify(to)"><slot /></a>',
  },
}))

import LandingHero from '@/components/ui/organisms/LandingHero.vue'

describe('LandingHero', () => {
  it('renderiza el título con la propuesta de valor', () => {
    const wrapper = mount(LandingHero)
    expect(wrapper.text()).toContain('bazar')
  })

  it('renderiza el botón "Iniciar sesión" apuntando a la ruta Login', () => {
    const wrapper = mount(LandingHero)
    const links = wrapper.findAll('a')
    const loginLink = links.find((l) => l.text().includes('Iniciar sesión'))
    expect(loginLink).toBeTruthy()
    expect(loginLink!.attributes('data-to')).toContain('Login')
  })

  it('renderiza el botón "Registra tu negocio" apuntando a BusinessRegistration', () => {
    const wrapper = mount(LandingHero)
    const links = wrapper.findAll('a')
    const registerLink = links.find((l) => l.text().includes('Registra tu negocio'))
    expect(registerLink).toBeTruthy()
    expect(registerLink!.attributes('data-to')).toContain('BusinessRegistration')
  })
})
