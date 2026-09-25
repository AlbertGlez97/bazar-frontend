// Tests de la vista LandingView — se ensambla sin errores e incluye todas las
// secciones de la landing, con contenido honesto (solo lo que la API hace hoy).
// Se mockea vue-router porque los CTA navegan vía RouterLink.
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-router', () => ({
  RouterLink: {
    props: ['to'],
    template: '<a :data-to="JSON.stringify(to)"><slot /></a>',
  },
}))

import LandingView from '@/views/LandingView.vue'

describe('LandingView', () => {
  it('se monta sin errores', () => {
    const wrapper = mount(LandingView)
    expect(wrapper.find('.landing-view').exists()).toBe(true)
  })

  it('incluye la sección hero con la propuesta de valor', () => {
    const wrapper = mount(LandingView)
    expect(wrapper.get('h1').text()).toContain('Tú atiendes a tu clientela')
  })

  it('incluye beneficios, para quién es, el origen del nombre, cómo empezar y la llamada final', () => {
    const text = mount(LandingView).text()
    expect(text).toContain('Lo que hace por tu negocio')
    expect(text).toContain('Hecha para quien vende de tú a tú')
    expect(text).toContain('¿Por qué nos llamamos así?')
    expect(text).toContain('Así empiezas')
    expect(text).toContain('¿Le entramos?')
  })

  it('cubre a changarros, bazares y tianguis', () => {
    const text = mount(LandingView).text()
    for (const audience of ['Changarros', 'Bazares', 'Tianguis']) expect(text).toContain(audience)
  })

  it('tiene dos llamadas a registrar el negocio (hero y cierre)', () => {
    const wrapper = mount(LandingView)
    const registerLinks = wrapper.findAll('a').filter((a) => a.attributes('data-to')?.includes('BusinessRegistration'))
    expect(registerLinks).toHaveLength(2)
  })

  it('ya no simula un formulario de contacto que no envía nada', () => {
    const wrapper = mount(LandingView)
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/Recibimos tu mensaje|Enviar mensaje/)
  })

  it('no inventa testimonios, cifras ni funciones que no existen', () => {
    const text = mount(LandingView).text()
    expect(text).not.toMatch(/testimonio|\d+\s?%|miles de|sin internet|offline|notificaci|reportes/i)
  })

  it('el orden de la historia es: hero, beneficios, público, origen, pasos, cierre', () => {
    const headings = mount(LandingView).findAll('h1, h2').map((h) => h.text())
    expect(headings).toEqual([
      expect.stringContaining('Tú atiendes'),
      'Lo que hace por tu negocio',
      'Hecha para quien vende de tú a tú',
      '¿Por qué nos llamamos así?',
      'Así empiezas',
      '¿Le entramos?',
    ])
  })
})
