import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LegalDocument from '../LegalDocument.vue'
import source from '../LegalDocument.vue?raw'
import type { LegalDocumentData } from '@/legal/types'

const doc: LegalDocumentData = {
  id: 'privacidad',
  title: 'Aviso de Privacidad',
  summary: ['Uno de cinco.', 'Dos de cinco.', 'Tres de cinco.', 'Cuatro de cinco.', 'Cinco de cinco.'],
  sections: [
    {
      id: 'primera',
      title: 'Primera sección',
      blocks: [
        { kind: 'p', text: 'Un párrafo corto.' },
        { kind: 'h3', text: 'Una lista' },
        { kind: 'list', items: ['Uno', 'Dos'] },
      ],
    },
    {
      id: 'segunda',
      title: 'Segunda sección',
      blocks: [{ kind: 'list', ordered: true, items: ['Paso uno', 'Paso dos'] }, { kind: 'p', text: 'Fin.' }],
    },
  ],
}

const mountDoc = () => mount(LegalDocument, { props: { document: doc, version: '2026-10-16', updatedLabel: '16 de octubre de 2026' } })

const css = source.slice(source.indexOf('<style')).replace(/<style[^>]*>/, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('LegalDocument — estructura y accesibilidad', () => {
  it('tiene un solo h1 con el título', () => {
    const wrapper = mountDoc()

    expect(wrapper.findAll('h1')).toHaveLength(1)
    expect(wrapper.get('h1').text()).toBe('Aviso de Privacidad')
  })

  it('muestra "Versión" y la fecha, y la versión va en un <time> legible', () => {
    const wrapper = mountDoc()
    const meta = wrapper.get('.legal-document__version')

    expect(meta.text()).toContain('Versión 2026-10-16')
    expect(meta.text()).toContain('16 de octubre de 2026')
    expect(meta.get('time').attributes('datetime')).toBe('2026-10-16')
  })

  it('arriba hay un resumen de 5 puntos, en una lista ordenada con su encabezado', () => {
    const wrapper = mountDoc()
    const summary = wrapper.get('.legal-document__summary')

    expect(summary.get('h2').text()).toBe('Resumen en 5 puntos')
    expect(summary.findAll('ol > li')).toHaveLength(5)
  })

  it('el resumen va ANTES del índice y de las secciones', () => {
    const order = [...mountDoc().element.querySelectorAll('.legal-document__summary, .legal-document__toc, .legal-document__section')].map((el) => el.className.split(' ')[0])

    expect(order[0]).toBe('legal-document__summary')
    expect(order[1]).toBe('legal-document__toc')
  })

  it('el índice enlaza con anclas a cada sección, y cada ancla existe', () => {
    const wrapper = mountDoc()
    const links = wrapper.findAll('nav.legal-document__toc a')

    expect(links.map((a) => a.attributes('href'))).toEqual(['#primera', '#segunda'])
    for (const link of links) {
      const id = link.attributes('href')!.slice(1)
      expect(wrapper.element.querySelector(`#${id}`), id).not.toBeNull()
    }
  })

  it('el índice es un <nav> con nombre accesible', () => {
    expect(mountDoc().get('nav.legal-document__toc').attributes('aria-label')).toBe('Contenido')
  })

  it('cada sección es un h2 con su id y las listas son listas de verdad', () => {
    const wrapper = mountDoc()

    expect(wrapper.findAll('section.legal-document__section h2').map((h) => h.text())).toEqual(['Primera sección', 'Segunda sección'])
    expect(wrapper.get('#primera').element.tagName).toBe('H2')
    expect(wrapper.findAll('ul > li').map((li) => li.text())).toEqual(['Uno', 'Dos'])
    expect(wrapper.findAll('ol.legal-document__ordered > li')).toHaveLength(2)
  })

  it('jerarquía de encabezados sin saltos: h1 → h2 → h3', () => {
    const levels = [...mountDoc().element.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) => Number(h.tagName[1]))

    for (let i = 1; i < levels.length; i += 1) expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1)
    expect(levels[0]).toBe(1)
  })

  it('el contenido va en un <article> con aria-labelledby apuntando al h1', () => {
    const wrapper = mountDoc()
    const article = wrapper.get('article')
    const h1 = wrapper.get('h1')

    expect(article.attributes('aria-labelledby')).toBe(h1.attributes('id'))
  })

  it('los ids de las secciones no chocan con el id del título', () => {
    const wrapper = mountDoc()
    const ids = [...wrapper.element.querySelectorAll('[id]')].map((el) => el.id)

    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('LegalDocument — lectura cómoda e impresión', () => {
  it('ancho de lectura cómodo: máximo de 70 caracteres por línea o 46 rem', () => {
    expect(css).toMatch(/max-width:\s*(6\d|70)ch|max-width:\s*(4[0-6])(\.\d+)?rem/)
  })

  it('interlineado generoso para leer', () => {
    expect(css).toMatch(/line-height:\s*1\.[5-9]/)
  })

  it('las anclas no quedan tapadas al saltar (scroll-margin-top)', () => {
    expect(css).toMatch(/scroll-margin-top/)
  })

  it('tiene estilo de impresión: sin índice, texto negro sobre blanco y sin cortar secciones a medias', () => {
    const print = css.slice(css.indexOf('@media print'))

    expect(css).toMatch(/@media print/)
    expect(print).toMatch(/\.legal-document__toc\s*\{[^}]*display:\s*none/)
    // Sin colores fijos en los .vue (no-hardcoded-colors.test.ts): "black" y "white" son palabras, no hex.
    expect(print).toMatch(/color:\s*black/)
    expect(print).toMatch(/break-inside:\s*avoid|page-break-inside:\s*avoid/)
  })

  it('no define colores sueltos: usa los tokens de la marca', () => {
    const outsidePrint = css.slice(0, css.indexOf('@media print'))
    expect(outsidePrint).not.toMatch(/#[0-9a-fA-F]{3,6}\b/)
  })
})
