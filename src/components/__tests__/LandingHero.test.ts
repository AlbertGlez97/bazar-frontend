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
    expect(wrapper.text()).toContain('Tú atiendes a tu clientela')
    expect(wrapper.text()).toContain('Nosotros llevamos las cuentas')
    expect(wrapper.text()).toContain('changarros, bazares y tianguis')
  })

  it('aclara que la solicitud se revisa a mano y las credenciales llegan por correo', () => {
    const wrapper = mount(LandingHero)
    expect(wrapper.text()).toContain('Revisamos cada solicitud a mano')
    expect(wrapper.text()).toContain('por correo')
  })

  it('renderiza el botón "Ya tengo cuenta" apuntando a la ruta Login', () => {
    const wrapper = mount(LandingHero)
    const links = wrapper.findAll('a')
    const loginLink = links.find((l) => l.text().includes('Ya tengo cuenta'))
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
