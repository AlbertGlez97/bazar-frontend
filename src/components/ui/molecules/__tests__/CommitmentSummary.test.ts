import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CommitmentSummary from '../CommitmentSummary.vue'

const commitment = { from: '2026-10-01', to: '2026-11-01', availableMinor: 1_000_000, committedMinor: 600_000, freeMinor: 400_000, agreementCount: 2 }
const mountIt = (props: Record<string, unknown> = {}) => mount(CommitmentSummary, { props: { commitment, ...props } })

describe('CommitmentSummary', () => {
  it('muestra Disponible, Comprometido y Libre con su dinero, en una lista de definiciones', () => {
    const w = mountIt()
    const terms = w.findAll('dt').map((t) => t.text())
    const values = w.findAll('dd').map((d) => d.text())

    expect(terms).toEqual(['Disponible', 'Comprometido', 'Libre'])
    expect(values).toEqual(['$10,000.00', '$6,000.00', '$4,000.00'])
  })

  it('dice cuántos acuerdos vigentes hay (singular y plural)', () => {
    expect(mountIt().text()).toContain('2 acuerdos vigentes')
    expect(mountIt({ commitment: { ...commitment, agreementCount: 1 } }).text()).toContain('1 acuerdo vigente')
  })

  it('sin acuerdos vigentes no dibuja esa línea', () => {
    expect(mountIt({ commitment: { ...commitment, committedMinor: 0, freeMinor: 1_000_000, agreementCount: 0 } }).text()).not.toContain('vigente')
  })

  it('cargando: un aviso de estado, sin cifras', () => {
    const w = mountIt({ commitment: null, loading: true })
    expect(w.get('[role="status"]').text()).toContain('Consultando')
    expect(w.find('dl').exists()).toBe(false)
  })

  it('con error: el texto, sin cifras', () => {
    const w = mountIt({ commitment: null, error: 'No pudimos consultar.' })
    expect(w.text()).toContain('No pudimos consultar.')
    expect(w.find('dl').exists()).toBe(false)
  })

  it('sin nada que mostrar no dibuja nada', () => {
    expect(mountIt({ commitment: null }).find('section').exists()).toBe(false)
  })

  it('tiene nombre accesible', () => {
    expect(mountIt().get('section').attributes('aria-label')).toBe('Disponible, comprometido y libre del período')
  })

  it('lo libre en cero se marca con texto además del color', () => {
    const w = mountIt({ commitment: { ...commitment, committedMinor: 1_000_000, freeMinor: 0 } })
    expect(w.get('[data-test="free"]').text()).toContain('$0.00')
    expect(w.get('[data-test="free"]').classes()).toContain('commitment-summary__item--empty')
  })
})
