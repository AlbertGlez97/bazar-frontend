import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { HELP_ARTICLES, HELP_EVIDENCE, CASH_HELP } from '../help-content'

describe('audited help content', () => {
  it('does not invent report filters, retry buttons or optional creation cost', () => {
    const article = (id: string) => HELP_ARTICLES.find((item) => item.id === id)!
    expect(article('crear-producto').steps.join(' ')).toContain('Costo de compra')
    expect(article('crear-producto').steps.join(' ')).toContain('obligatorio')
    expect(article('reportes').steps.join(' ')).toContain('Por persona')
    expect(article('reportes').steps.join(' ')).not.toContain('filtros disponibles de personas')
    expect(article('sin-conexion').steps.join(' ')).not.toContain('Reintentar')
    expect(article('sin-conexion').steps.join(' ')).toContain('Entendido')
    expect(CASH_HELP.tips.join(' ')).toContain('$430')
    expect(CASH_HELP.tips.join(' ')).toContain('$70')
    expect(article('preguntas').questions?.length).toBeGreaterThan(2)
  })
  it('covers administrative workflows with socio boundaries and current limitations', () => {
    const expected = ['crear-producto', 'editar-producto', 'fotos', 'imprimir-qr', 'crear-deuda', 'abonos', 'calendario', 'incidencias', 'reportes', 'equipo', 'dispositivos', 'contrasena', 'instalar', 'preguntas']
    expect(HELP_ARTICLES.map((article) => article.id)).toEqual(expect.arrayContaining(expected))
    const debt = HELP_ARTICLES.find((article) => article.id === 'crear-deuda')!
    expect(debt.audience).toBe('socio')
    expect(debt.steps.join(' ')).toContain('0')
    expect(debt.tips.join(' ')).toContain('efectivo')
    expect(HELP_ARTICLES.find((article) => article.id === 'editar-producto')?.tips.join(' ')).toContain('existencia')
    expect(HELP_ARTICLES.find((article) => article.id === 'reportes')?.tips.join(' ')).toContain('contado')
  })
  it('provides stable unique articles with useful steps and evidence kept outside reader copy', () => {
    const ids = HELP_ARTICLES.map((article) => article.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const article of HELP_ARTICLES) {
      expect(article.questions?.length ?? article.steps.length).toBeGreaterThanOrEqual(3)
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
