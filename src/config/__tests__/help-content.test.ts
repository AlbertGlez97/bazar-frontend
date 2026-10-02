import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { HELP_ARTICLES, HELP_EVIDENCE, CASH_HELP } from '../help-content'

describe('audited help content', () => {
  it('provides stable unique articles with useful steps and evidence kept outside reader copy', () => {
    const ids = HELP_ARTICLES.map((article) => article.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const article of HELP_ARTICLES) {
      expect(article.steps.length).toBeGreaterThanOrEqual(3)
      expect(article.title).toBeTruthy()
      expect(article.intro).toBeTruthy()
      expect(article).not.toHaveProperty('evidence')
      expect(HELP_EVIDENCE[article.id]?.length).toBeGreaterThan(0)
      for (const path of HELP_EVIDENCE[article.id] ?? []) expect(existsSync(path)).toBe(true)
    }
  })

  it('covers getting started, first sale, quantities, cash, scanner and offline uncertainty', () => {
    expect(HELP_ARTICLES.map((article) => article.id)).toEqual(expect.arrayContaining([
      'acceso', 'modos', 'primera-venta', 'carrito', 'efectivo', 'escanear', 'sin-conexion',
    ]))
    expect(CASH_HELP.steps.join(' ')).toContain('su propia selección')
    expect(CASH_HELP.tips.join(' ')).toContain('1,250.50')
    expect(HELP_ARTICLES.find((article) => article.id === 'sin-conexion')?.tips.join(' ')).toContain('no confirma')
  })
})
