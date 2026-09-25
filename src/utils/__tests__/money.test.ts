import { describe, it, expect } from 'vitest'
import {
  minorToDisplay, displayToMinor, formatMinorMoney, parseCashInput,
  addMinor, subtractMinor, multiplyMinor, sumMinor, changeDueMinor, shortfallMinor,
} from '../money'

describe('formatMinorMoney', () => {
  it.each([
    [125000, '$1,250.00'],
    [12550, '$125.50'],
    [0, '$0.00'],
    [1, '$0.01'],
    [99, '$0.99'],
    [100000, '$1,000.00'],
    [99999, '$999.99'],
    [123456789, '$1,234,567.89'],
    [2147483647, '$21,474,836.47'],
  ])('formats %i cents with a "$" and thousands separators, exactly', (minor, expected) => {
    expect(formatMinorMoney(minor)).toBe(expected)
  })

  it('keeps the sign in front of the currency symbol', () => {
    expect(formatMinorMoney(-12550)).toBe('-$125.50')
    expect(formatMinorMoney(-100000)).toBe('-$1,000.00')
  })

  it('returns "$0.00" for non-finite values, like minorToDisplay', () => {
    expect(formatMinorMoney(Number.NaN)).toBe('$0.00')
  })

  it('agrees with minorToDisplay on the digits', () => {
    for (const minor of [1, 7, 10, 99, 100, 101, 5555, 123456, 2147483647]) {
      expect(formatMinorMoney(minor).replace(/[$,]/g, '')).toBe(minorToDisplay(minor))
    }
  })
})

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

// Aritmética de centavos centralizada sobre dinero.js (la misma librería y
// versión que usa bazar-api). Todo entero: sin floats, sin sorpresas offline.
describe('aritmética de centavos (dinero.js)', () => {
  it('500 - 299.50 = 200.50 exacto', () => {
    const change = subtractMinor(displayToMinor('500'), displayToMinor('299.50'))
    expect(change).toBe(20050)
    expect(minorToDisplay(change)).toBe('200.50')
  })

  it('los clásicos del punto flotante salen exactos', () => {
    expect(addMinor(10, 20)).toBe(30) // 0.1 + 0.2 en pesos da 0.30000000000000004
    expect(multiplyMinor(110, 3)).toBe(330) // 1.10 * 3 en pesos da 3.3000000000000003
    expect(multiplyMinor(1999, 3)).toBe(5997)
    expect(subtractMinor(30, 10)).toBe(20)
    expect(minorToDisplay(subtractMinor(displayToMinor('1.10'), displayToMinor('1.00')))).toBe('0.10')
  })

  it('sumMinor suma una lista (vacía = 0) sin deriva', () => {
    expect(sumMinor([])).toBe(0)
    expect(sumMinor(Array.from({ length: 1000 }, () => 10))).toBe(10000)
    expect(sumMinor([1999, 1999, 1999, 1])).toBe(5998)
  })

  it('changeDueMinor y shortfallMinor: cambio y faltante, nunca negativos', () => {
    expect(changeDueMinor(50000, 29950)).toBe(20050)
    expect(shortfallMinor(50000, 29950)).toBe(0)
    expect(changeDueMinor(29950, 50000)).toBe(0)
    expect(shortfallMinor(29950, 50000)).toBe(20050)
    expect(changeDueMinor(1999, 1999)).toBe(0)
    expect(shortfallMinor(1999, 1999)).toBe(0)
  })

  it('subtractMinor puede dar negativo (la diferencia es solo una resta exacta)', () => {
    expect(subtractMinor(100, 250)).toBe(-150)
  })

  it.each([1.5, NaN, Infinity, '5' as unknown as number, null as unknown as number])(
    'un monto que no es entero (%j) se rechaza en vez de redondearlo en silencio',
    (bad) => {
      expect(() => addMinor(bad, 1)).toThrow()
      expect(() => multiplyMinor(bad, 2)).toThrow()
      expect(() => sumMinor([1, bad])).toThrow()
    },
  )

  it('una cantidad fraccionaria o negativa en multiplyMinor se rechaza', () => {
    expect(() => multiplyMinor(100, 1.5)).toThrow()
    expect(() => multiplyMinor(100, -1)).toThrow()
  })

  it('un resultado fuera del rango de enteros exactos falla fuerte (RangeError), como el backend', () => {
    expect(multiplyMinor(2147483647, 100000)).toBe(214748364700000)
    expect(() => sumMinor(Array.from({ length: 500 }, () => multiplyMinor(2147483647, 100000)))).toThrow(RangeError)
  })
})
