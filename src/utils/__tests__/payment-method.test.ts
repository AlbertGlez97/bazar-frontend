import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PAYMENT_METHOD,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  isCashPayment,
  paymentMethodLabel,
  resolvePaymentMethod,
} from '../payment-method'

describe('payment methods', () => {
  it('son tres, en el orden en que se ofrecen: Efectivo, Transferencia, Tarjeta', () => {
    expect([...PAYMENT_METHODS]).toEqual(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'])
  })

  it('el valor por defecto es EFECTIVO', () => {
    expect(DEFAULT_PAYMENT_METHOD).toBe('EFECTIVO')
  })

  it('cada método tiene su nombre en palabras (nunca solo un ícono)', () => {
    expect(PAYMENT_METHOD_LABELS).toEqual({ EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia', TARJETA: 'Tarjeta' })
    expect(paymentMethodLabel('TARJETA')).toBe('Tarjeta')
  })

  describe('resolvePaymentMethod', () => {
    it('conserva un método válido', () => {
      expect(resolvePaymentMethod('TRANSFERENCIA')).toBe('TRANSFERENCIA')
    })

    it.each([undefined, null, '', 'efectivo', 'CHEQUE', 7, {}])(
      'una entrada sin método o desconocida (%j) se trata como EFECTIVO',
      (value) => {
        expect(resolvePaymentMethod(value)).toBe('EFECTIVO')
      },
    )
  })

  it('solo EFECTIVO maneja efectivo recibido y cambio', () => {
    expect(isCashPayment('EFECTIVO')).toBe(true)
    expect(isCashPayment(undefined)).toBe(true)
    expect(isCashPayment('TRANSFERENCIA')).toBe(false)
    expect(isCashPayment('TARJETA')).toBe(false)
  })
})
