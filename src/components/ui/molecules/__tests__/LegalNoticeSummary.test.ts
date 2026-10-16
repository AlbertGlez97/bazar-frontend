import { describe, expect, it } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import LegalNoticeSummary from '../LegalNoticeSummary.vue'
import source from '../LegalNoticeSummary.vue?raw'

const mountSummary = () => mount(LegalNoticeSummary, { global: { stubs: { RouterLink: RouterLinkStub } } })

describe('LegalNoticeSummary (resumen corto para el formulario de registro)', () => {
  it('es un texto corto con enlaces al Aviso de Privacidad y a los Términos', () => {
    const wrapper = mountSummary()
    const links = wrapper.findAllComponents(RouterLinkStub)

    expect(links.map((l) => l.props('to'))).toEqual(['/privacidad', '/terminos'])
    expect(links.map((l) => l.text())).toEqual(['Aviso de Privacidad', 'Términos y Condiciones'])
  })

  it('los enlaces abren en otra pestaña para no perder lo que se escribió en el formulario', () => {
    const wrapper = mountSummary()

    for (const link of wrapper.findAllComponents(RouterLinkStub)) {
      expect(link.attributes('target')).toBe('_blank')
      expect(link.attributes('rel')).toContain('noopener')
    }
  })

  it('dice para qué se usan los datos y que no se venden, con frases cortas', () => {
    const text = mountSummary().text()

    expect(text).toContain('Usamos tus datos para')
    expect(text).toMatch(/no los vendemos/i)
    for (const sentence of text.split(/(?<=[.!?])\s+/)) expect(sentence.split(/\s+/).length, sentence).toBeLessThanOrEqual(20)
  })

  it('no incluye casilla ni botón: la aceptación se integra después en el formulario', () => {
    const wrapper = mountSummary()

    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('es una molécula presentacional: no importa stores ni servicios', () => {
    expect(source).not.toMatch(/@\/stores|@\/services/)
  })
})
