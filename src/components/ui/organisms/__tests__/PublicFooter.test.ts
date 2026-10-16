import { describe, expect, it } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { LEGAL_CONTACT_EMAIL } from '@/legal/legal-config'
import PublicFooter from '../PublicFooter.vue'
import source from '../PublicFooter.vue?raw'

const mountFooter = () => mount(PublicFooter, { global: { stubs: { RouterLink: RouterLinkStub } } })

describe('PublicFooter (pie de las páginas públicas)', () => {
  it('es un <footer> con la marca y la firma', () => {
    const wrapper = mountFooter()

    expect(wrapper.element.tagName).toBe('FOOTER')
    expect(wrapper.text()).toContain('Para quien vende de tú a tú.')
  })

  it('enlaza el Aviso de privacidad y los Términos y condiciones', () => {
    const links = mountFooter().findAllComponents(RouterLinkStub)

    expect(links.map((l) => l.props('to'))).toEqual(['/privacidad', '/terminos'])
    expect(links.map((l) => l.text())).toEqual(['Aviso de privacidad', 'Términos y condiciones'])
  })

  it('los enlaces legales están dentro de un <nav> con nombre accesible', () => {
    const nav = mountFooter().get('nav')

    expect(nav.attributes('aria-label')).toBe('Información legal')
    expect(nav.findAllComponents(RouterLinkStub)).toHaveLength(2)
  })

  it('muestra el correo de contacto como enlace mailto', () => {
    const mail = mountFooter().get(`a[href="mailto:${LEGAL_CONTACT_EMAIL}"]`)

    expect(mail.text()).toBe(LEGAL_CONTACT_EMAIL)
  })

  it('los enlaces miden al menos 44 px de alto (zona táctil)', () => {
    const css = source.slice(source.indexOf('<style'))

    expect(css).toMatch(/min-height:\s*2\.75rem/)
  })

  it('es presentacional: no importa stores ni servicios', () => {
    expect(source).not.toMatch(/@\/stores|@\/services/)
  })
})
