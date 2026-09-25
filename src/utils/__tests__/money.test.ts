import { describe, it, expect } from 'vitest'
import { minorToDisplay, displayToMinor, parseCashInput } from '../money'

describe('minorToDisplay', () => {
  it.each([
    [12550, '125.50'],
    [0, '0.00'],
    [100000, '1000.00'],
    [1, '0.01'],
    [10, '0.10'],
  ])('convierte %i centavos a "%s"', (minor, expected) => {
    expect(minorToDisplay(minor)).toBe(expected)
  })

  it('devuelve "0.00" para valores no finitos', () => {
    expect(minorToDisplay(Number.NaN)).toBe('0.00')
  })
})

describe('displayToMinor', () => {
  it.each([
    ['125.50', 12550],
    ['125.5', 12550],
    ['0', 0],
    ['0.01', 1],
    ['1000', 100000],
    ['125,50', 12550], // separador decimal con coma (es-MX)
  ])('convierte "%s" pesos a %i centavos', (display, expected) => {
    expect(displayToMinor(display)).toBe(expected)
  })

  it('acepta un number como entrada', () => {
    expect(displayToMinor(125.5)).toBe(12550)
  })

  it('redondea correctamente el caso límite de punto flotante 10.005', () => {
    // 10.005 * 100 == 1000.4999999999999 en floats — truncar daría 1000,
    // pero redondear "half up" al segundo decimal da 1001.
    expect(displayToMinor('10.005')).toBe(1001)
  })

  it('redondea hacia abajo cuando el tercer decimal es < 5', () => {
    expect(displayToMinor('10.004')).toBe(1000)
  })

  it.each(['', 'abc', '12.34.56', null as unknown as string, undefined as unknown as string])(
    'devuelve 0 para entradas inválidas: %s',
    (value) => {
      expect(displayToMinor(value)).toBe(0)
    }
  )

  it('conserva el signo negativo (aunque el dominio de negocio no lo use)', () => {
    expect(displayToMinor('-10.50')).toBe(-1050)
  })
})

// Convención mexicana (es-MX): la COMA agrupa miles y el PUNTO es el decimal.
// Ante un texto ambiguo o sin forma de monto devuelve null (nunca adivina).
describe('parseCashInput', () => {
  it.each([
    ['1,000', 100000],
    ['1,000.50', 100050],
    ['1000', 100000],
    ['1000.5', 100050],
    ['100', 10000],
    ['100.50', 10050],
    ['0.10', 10],
    ['.5', 50],
    ['1000.', 100000],
    ['1,000,000', 100000000],
    ['12,345.67', 1234567],
    ['  1,000.50  ', 100050],
    ['$1,000.50', 100050],
    ['$ 250', 25000],
    ['', 0],
    ['   ', 0],
  ])('%j -> %i centavos', (text, expected) => {
    expect(parseCashInput(text)).toBe(expected)
  })

  it.each([
    'abc',
    '1e5',
    '-20',
    '100,50', // ¿100.50 o 10,050? ambiguo: se bloquea en vez de adivinar
    '1,5',
    '1,00',
    '1,0000',
    '1,23,456',
    '1.000,50', // convención europea: no es la de México
    '1.2.3',
    '10.005', // no existen fracciones de centavo en efectivo
    '1,000.505',
    '.',
    ',',
    ',5',
    '1 500',
    '1,,000',
    '1,000,',
  ])('%j es ambiguo o inválido -> null', (text) => {
    expect(parseCashInput(text)).toBeNull()
  })

  it('null, undefined y no-strings no se interpretan: null', () => {
    expect(parseCashInput(null as unknown as string)).toBeNull()
    expect(parseCashInput(undefined as unknown as string)).toBeNull()
  })

  it('es consistente con Intl.NumberFormat("es-MX"): lo que se formatea así se lee de vuelta exacto', () => {
    const fmt = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    for (const minor of [0, 1, 99, 100, 12550, 100000, 100050, 123456789, 2147483647]) {
      expect(parseCashInput(fmt.format(minor / 100))).toBe(minor)
    }
  })
})
