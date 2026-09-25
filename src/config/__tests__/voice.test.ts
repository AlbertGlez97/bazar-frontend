import { describe, it, expect } from 'vitest'
import { VOICE, isNetworkError, saleSuccessMessage } from '@/config/voice'

describe('saleSuccessMessage (patrón de confirmación de venta)', () => {
  it('dice el hecho concreto: qué se anotó y cuánto', () => {
    expect(saleSuccessMessage({ totalMinor: 25000 })).toBe('Venta anotada: $250.00.')
  })

  it('añade el cambio y a nombre de quién cuando hay', () => {
    expect(
      saleSuccessMessage({ totalMinor: 25000, changeMinor: 5000, sellerName: 'Carlos' }),
    ).toBe('Venta anotada: $250.00. Cambio: $50.00. Quedó a nombre de Carlos.')
  })

  it('omite el cambio cuando es cero o no viene', () => {
    expect(saleSuccessMessage({ totalMinor: 12550, changeMinor: 0 })).not.toContain('Cambio')
    expect(saleSuccessMessage({ totalMinor: 12550, changeMinor: null })).not.toContain('Cambio')
  })

  it('nunca cae en el "¡Éxito!" genérico', () => {
    expect(saleSuccessMessage({ totalMinor: 100, sellerName: 'Ana' })).not.toMatch(/éxito|exito|!/i)
  })
})

describe('mensajes de error compartidos', () => {
  it('dicen qué pasó y qué hacer', () => {
    expect(VOICE.genericError).toMatch(/Intenta de nuevo/)
    expect(VOICE.networkError).toMatch(/Revisa tu internet/)
  })

  it('isNetworkError distingue "sin respuesta" de "el servidor respondió"', () => {
    expect(isNetworkError(new Error('Network Error'))).toBe(true)
    expect(isNetworkError(null)).toBe(true)
    expect(isNetworkError({ response: { status: 500 } })).toBe(false)
  })
})
