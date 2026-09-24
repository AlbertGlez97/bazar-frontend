import { describe, it, expect } from 'vitest'
import { minorToDisplay, displayToMinor } from '../money'

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
