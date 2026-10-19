import { describe, expect, it } from 'vitest'
import { collapseSpaces } from '../short-text'

describe('collapseSpaces', () => {
  it('recorta y junta los espacios de adentro', () => {
    expect(collapseSpaces('  Azul   ·    28  ')).toBe('Azul · 28')
  })
  it('tabuladores y saltos de línea cuentan como un espacio', () => {
    expect(collapseSpaces('uno\ndos\t\ttres\r\ncuatro')).toBe('uno dos tres cuatro')
  })
  it('en blanco queda vacío', () => {
    expect(collapseSpaces('')).toBe('')
    expect(collapseSpaces('  \n\t ')).toBe('')
  })
  it('un texto ya limpio no cambia', () => {
    expect(collapseSpaces('24 oz')).toBe('24 oz')
  })
  it('tarda poco con decenas de miles de espacios', () => {
    const start = performance.now()
    collapseSpaces(`${' '.repeat(50_000)}x${' '.repeat(50_000)}`)
    expect(performance.now() - start).toBeLessThan(250)
  })
})
