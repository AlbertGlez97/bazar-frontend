// Organismos nuevos de la landing: contenido estático y honesto.
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-router', () => ({
  RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' },
}))

import AudienceSection from '@/components/ui/organisms/AudienceSection.vue'
import LandingStory from '@/components/ui/organisms/LandingStory.vue'
import HowItWorksSection from '@/components/ui/organisms/HowItWorksSection.vue'
import LandingCta from '@/components/ui/organisms/LandingCta.vue'

describe('AudienceSection', () => {
  it('describe a changarros, bazares y tianguis', () => {
    const wrapper = mount(AudienceSection)
    expect(wrapper.findAll('h3').map((h) => h.text())).toEqual(['Changarros', 'Bazares', 'Tianguis'])
  })
})

describe('LandingStory', () => {
  it('cuenta el origen del nombre con la frase del mercado', () => {
    const text = mount(LandingStory).text()
    expect(text).toContain('marchanta')
    expect(text).toContain('¿qué le damos, marchanta?')
  })

  it('evita los clichés turísticos', () => {
    expect(mount(LandingStory).text()).not.toMatch(/sombrero|charro|picante|ándale|arriba/i)
  })
})

describe('HowItWorksSection', () => {
  it('muestra tres pasos numerados que reflejan el alta real', () => {
    const wrapper = mount(HowItWorksSection)
    expect(wrapper.findAll('li')).toHaveLength(3)
    expect(wrapper.text()).toContain('Lo revisamos')
    expect(wrapper.text()).toContain('por correo')
  })

  it('no promete aprobación: dice "si todo va bien"', () => {
    expect(mount(HowItWorksSection).text()).toContain('Si todo va bien')
  })
})

describe('LandingCta', () => {
  it('cierra con una llamada a registrar el negocio', () => {
    const wrapper = mount(LandingCta)
    expect(wrapper.get('h2').text()).toBe('¿Le entramos?')
    expect(wrapper.get('a').attributes('data-to')).toContain('BusinessRegistration')
  })
})
