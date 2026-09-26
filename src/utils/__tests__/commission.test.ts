import { describe, expect, it } from 'vitest'
import { MAX_COMMISSION_BPS, bpsToPercentText, percentTextToBps } from '../commission'

// El backend guarda la comisión en puntos base enteros (1000 = 10.00 %). La
// conversión trabaja sobre los DÍGITOS del texto: nada de multiplicar floats.
describe('percentTextToBps', () => {
  it.each([
    ['10', 1000],
    ['10.5', 1050],
    ['10.50', 1050],
    ['10.05', 1005],
    ['0', 0],
    ['0.01', 1],
    ['0.1', 10],
    ['.5', 50],
    ['.05', 5],
    ['100', 10000],
    ['100.00', 10000],
    ['99.99', 9999],
    ['007', 700],
    ['12.3', 1230],
  ])('%j -> %i puntos base', (text, expected) => {
    expect(percentTextToBps(text)).toBe(expected)
  })

  it('tolera espacios alrededor y un "%" al final', () => {
    expect(percentTextToBps('  10.5  ')).toBe(1050)
    expect(percentTextToBps('10%')).toBe(1000)
    expect(percentTextToBps('10.5 %')).toBe(1050)
  })

  it('no cae en la trampa del punto flotante (0.29 * 100 = 28.999999999999996)', () => {
    expect(percentTextToBps('0.29')).toBe(29)
    expect(percentTextToBps('1.15')).toBe(115)
    expect(percentTextToBps('4.35')).toBe(435)
    expect(percentTextToBps('8.2')).toBe(820)
  })

  it.each([
    '100.01',
    '101',
    '1000',
    '10.555',
    '10.',
    '.',
    '',
    '   ',
    '-5',
    '+5',
    'abc',
    '1e2',
    '10,5',
    '1,000',
    '10..5',
    '1 0',
    '10%%',
    '%',
    '5 5',
  ])('%j es inválido -> null', (text) => {
    expect(percentTextToBps(text)).toBeNull()
  })

  it('valores que no son texto -> null, sin reventar', () => {
    expect(percentTextToBps(null as unknown as string)).toBeNull()
    expect(percentTextToBps(undefined as unknown as string)).toBeNull()
    expect(percentTextToBps(10 as unknown as string)).toBeNull()
  })

  it('el tope coincide con el del backend (10 000 = 100 %)', () => {
    expect(MAX_COMMISSION_BPS).toBe(10_000)
    expect(percentTextToBps('100')).toBe(MAX_COMMISSION_BPS)
    expect(percentTextToBps('100.01')).toBeNull()
  })
})

describe('bpsToPercentText', () => {
  it.each([
    [1000, '10'],
    [1050, '10.5'],
    [1005, '10.05'],
    [1230, '12.3'],
    [50, '0.5'],
    [5, '0.05'],
    [0, '0'],
    [10000, '100'],
    [9999, '99.99'],
  ])('%i puntos base -> "%s"', (bps, expected) => {
    expect(bpsToPercentText(bps)).toBe(expected)
  })

  it('ida y vuelta exacta para todos los valores 0..10000', () => {
    for (let bps = 0; bps <= MAX_COMMISSION_BPS; bps++) {
      expect(percentTextToBps(bpsToPercentText(bps))).toBe(bps)
    }
  })

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 10001])('%s no es un valor válido -> ""', (bps) => {
    expect(bpsToPercentText(bps)).toBe('')
  })
})
