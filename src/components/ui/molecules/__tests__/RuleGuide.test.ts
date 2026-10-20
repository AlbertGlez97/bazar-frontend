import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RuleGuide from '../RuleGuide.vue'

const guide = {
  title: 'Reservas',
  what: 'Es lo que se aparta antes de repartir.',
  why: 'Sirve para cubrir imprevistos.',
  source: { label: 'Cascada de reparto', text: 'Se aparta al inicio.', url: null as string | null },
}
const mountIt = (over: Partial<typeof guide> = {}) => mount(RuleGuide, { props: { guide: { ...guide, ...over } } })

describe('RuleGuide', () => {
  it('empieza cerrada: el botón ⓘ tiene nombre y apunta a su panel', () => {
    const w = mountIt()
    const toggle = w.get('.rule-guide__toggle')

    expect(toggle.attributes('aria-label')).toBe('Qué significa: Reservas')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(w.get(`#${toggle.attributes('aria-controls')}`).isVisible()).toBe(false)
  })

  it('al tocarla muestra qué decide y por qué importa', async () => {
    const w = mountIt()
    await w.get('.rule-guide__toggle').trigger('click')

    expect(w.get('.rule-guide__toggle').attributes('aria-expanded')).toBe('true')
    expect(w.get('.rule-guide__panel').isVisible()).toBe(true)
    expect(w.get('.rule-guide__panel').text()).toContain('Es lo que se aparta antes de repartir.')
    expect(w.get('.rule-guide__panel').text()).toContain('Sirve para cubrir imprevistos.')
  })

  it('"¿De dónde sale esto?" muestra la fuente y, sin enlace verificado, lo dice', async () => {
    const w = mountIt()
    await w.get('.rule-guide__toggle').trigger('click')
    const source = w.get('.rule-guide__source-toggle')
    expect(source.attributes('aria-expanded')).toBe('false')

    await source.trigger('click')

    expect(source.attributes('aria-expanded')).toBe('true')
    expect(w.get('.rule-guide__source').text()).toContain('Cascada de reparto')
    expect(w.get('.rule-guide__source').text()).toContain('Se aparta al inicio.')
    expect(w.get('.rule-guide__source').text()).toContain('Aún no tenemos un enlace verificado')
    expect(w.find('a').exists()).toBe(false)
  })

  it('si la fuente tiene enlace verificado, lo abre en otra pestaña de forma segura', async () => {
    const w = mountIt({ source: { ...guide.source, url: 'https://example.test/fuente' } })
    const link = w.get('a')

    expect(link.attributes('href')).toBe('https://example.test/fuente')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
    expect(link.attributes('target')).toBe('_blank')
    expect(w.text()).not.toContain('Aún no tenemos un enlace')
  })

  it('volver a tocar el botón la cierra', async () => {
    const w = mountIt()
    await w.get('.rule-guide__toggle').trigger('click')
    await w.get('.rule-guide__toggle').trigger('click')
    expect(w.get('.rule-guide__toggle').attributes('aria-expanded')).toBe('false')
  })
})
