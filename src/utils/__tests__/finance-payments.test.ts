import { describe, expect, it } from 'vitest'
import { ALBERTO_ID } from '@/services/__tests__/finance-distribution.fixture'
import { FinancePaymentContractError, PaymentFormError, businessDateTimeInput, exceedsPendingNumbers, formatPaymentDate,
  instantFromBusinessInput, isUncertainPaymentFailure, normalizePaymentFields, paymentErrorMessage, paymentProgressLabel,
  paymentReasonText } from '../finance-payments'

const http = (status: number, code = '', extra: object = {}) => ({ response: { status, data: { code, ...extra } } })

describe('payment field normalization', () => {
  const base = { participantMemberId: ALBERTO_ID, amountMinor: 100, occurredAt: '2026-10-09T15:00:00.000Z' }
  it('keeps only the strict fields, trims the note and drops a blank one', () => {
    expect(normalizePaymentFields({ ...base, note: '  hola  ', agreedMinor: 5 } as never)).toEqual({ ...base, note: 'hola' })
    expect(normalizePaymentFields({ ...base, note: '   ' })).not.toHaveProperty('note')
    expect(normalizePaymentFields({ ...base, note: null })).not.toHaveProperty('note')
  })
  it.each([0, -1, 1.5, 2147483648, Number.NaN])('rejects amount %s', (amountMinor) => {
    expect(() => normalizePaymentFields({ ...base, amountMinor })).toThrow(PaymentFormError)
  })
  it.each(['', 'today', '2026-10-09', '2026-10-09T15:00:00', '2026-10-09T15:00:00.1234Z', '2026-13-09T15:00:00Z'])('rejects time %j', (occurredAt) => {
    expect(() => normalizePaymentFields({ ...base, occurredAt })).toThrow(PaymentFormError)
  })
  it('rejects an invalid participant and an over-long note, and requires a trimmed reason', () => {
    expect(() => normalizePaymentFields({ ...base, participantMemberId: 'x' })).toThrow(PaymentFormError)
    expect(() => normalizePaymentFields({ ...base, note: 'x'.repeat(1001) })).toThrow(PaymentFormError)
    expect(paymentReasonText('  Error ')).toBe('Error')
    expect(() => paymentReasonText('  ')).toThrow(PaymentFormError)
    expect(() => paymentReasonText('x'.repeat(1001))).toThrow(PaymentFormError)
  })
})

describe('payment error mapping', () => {
  it.each([
    ['FINANCE_PAYMENT_ID_CONFLICT', 409, 'otro intento'], ['FINANCE_PAYMENT_AGREEMENT_VOIDED', 409, 'anulado'],
    ['FINANCE_PAYMENT_ALREADY_VOIDED', 409, 'ya estaba anulado'], ['FINANCE_PAYMENT_NOTHING_AGREED', 422, 'no tiene un monto acordado'],
    ['FINANCE_PAYMENT_TIME_INVALID', 422, 'reloj de tu dispositivo va adelantado'], ['FINANCE_PAYMENT_REVERSAL_TIME_INVALID', 422, 'anulación'],
  ])('maps %s to clear Spanish', (code, status, fragment) => {
    const message = paymentErrorMessage(http(status, code, { message: 'SERVER ENGLISH' }))
    expect(message).toContain(fragment)
    expect(message).not.toContain('SERVER ENGLISH')
  })
  it('shows the backend overpayment numbers exactly', () => {
    const error = http(422, 'FINANCE_PAYMENT_EXCEEDS_PENDING', { agreedMinor: 100050, paidMinor: 50, pendingMinor: 100000 })
    expect(exceedsPendingNumbers(error)).toEqual({ agreedMinor: 100050, paidMinor: 50, pendingMinor: 100000 })
    const message = paymentErrorMessage(error)
    for (const amount of ['$1,000.50', '$0.50', '$1,000.00']) expect(message).toContain(amount)
    expect(paymentErrorMessage(http(422, 'FINANCE_PAYMENT_EXCEEDS_PENDING'))).toContain('supera')
    expect(exceedsPendingNumbers(http(422, 'FINANCE_PAYMENT_EXCEEDS_PENDING', { agreedMinor: -1, paidMinor: 0, pendingMinor: 0 }))).toBeNull()
  })
  it.each([[400, 'Revisa'], [401, 'sesión'], [403, 'personas socias'], [404, 'No se encontró'], [409, 'cambió'], [422, 'no aceptó'], [503, 'ocupado']])(
    'maps plain status %i', (status, fragment) => { expect(paymentErrorMessage(http(status))).toContain(fragment) })
  it('treats network failures, 5xx, 408, 429 and malformed 2xx as uncertain and 4xx as definitive', () => {
    for (const cause of [new Error('Network Error'), http(500), http(503), http(408), http(429), new FinancePaymentContractError()])
      expect(isUncertainPaymentFailure(cause)).toBe(true)
    for (const cause of [http(400), http(403), http(404), http(409), http(422)]) expect(isUncertainPaymentFailure(cause)).toBe(false)
    expect(paymentErrorMessage(new Error('boom'))).toContain('no se duplicará')
  })
})

describe('labels and business-time conversion', () => {
  it('uses the product wording for every progress state', () => {
    expect(paymentProgressLabel('UNPAID')).toBe('Sin pagar')
    expect(paymentProgressLabel('PARTIALLY_PAID')).toBe('Pago parcial')
    expect(paymentProgressLabel('PAID')).toBe('Pagado')
    expect(paymentProgressLabel('NOT_DUE')).toBe('Sin monto acordado')
  })
  it('formats dates in business time (UTC-6), not the device zone', () => {
    expect(formatPaymentDate('2026-10-09T15:00:00.000Z')).toBe('9 oct 2026')
    expect(formatPaymentDate('2026-10-10T03:00:00.000Z')).toBe('9 oct 2026')
    expect(formatPaymentDate('2026-10-10T06:00:00.000Z')).toBe('10 oct 2026')
    expect(formatPaymentDate('nope')).toBe('—')
  })
  it('round-trips the datetime input through UTC-6 and rejects non-dates', () => {
    expect(businessDateTimeInput(new Date('2026-10-09T15:30:45.000Z'))).toBe('2026-10-09T09:30')
    expect(instantFromBusinessInput('2026-10-09T09:30')).toBe('2026-10-09T15:30:00.000Z')
    expect(instantFromBusinessInput('2026-02-30T09:30')).toBeNull()
    expect(instantFromBusinessInput('')).toBeNull()
    expect(instantFromBusinessInput('2026-10-09')).toBeNull()
  })
})
