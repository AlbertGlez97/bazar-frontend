import { describe, expect, it } from 'vitest'
import { friendlyDeudaErrorMessage } from '../deuda-errors'
import { VOICE } from '@/config/voice'

function httpError(status: number, message?: string | string[]) {
  return { isAxiosError: true, response: { status, data: message === undefined ? {} : { message } } }
}

describe('friendlyDeudaErrorMessage', () => {
  it('sin respuesta (red/timeout) avisa de conexión', () => {
    expect(friendlyDeudaErrorMessage({ isAxiosError: true, code: 'ERR_NETWORK' })).toBe(VOICE.networkError)
    expect(friendlyDeudaErrorMessage(new Error('boom'))).toBe(VOICE.networkError)
  })

  it.each([500, 502, 503])('%i es un fallo genérico del servidor', (status) => {
    expect(friendlyDeudaErrorMessage(httpError(status))).toBe(VOICE.genericError)
  })

  it('stock insuficiente', () => {
    expect(friendlyDeudaErrorMessage(httpError(400, 'Insufficient stock for product p-1'))).toBe(VOICE.deuda.insufficientStock)
  })

  it('producto desactivado', () => {
    expect(friendlyDeudaErrorMessage(httpError(400, 'Product p-1 is deactivated and cannot be used for a new deuda'))).toBe(VOICE.deuda.productDeactivated)
  })

  it('producto o deudor inexistente', () => {
    expect(friendlyDeudaErrorMessage(httpError(400, 'Product p-1 does not exist in this context'))).toBe(VOICE.deuda.productMissing)
  })

  it('cualquier otro 400 (validación, deudorId+deudor a la vez) cae en el genérico de deuda', () => {
    expect(friendlyDeudaErrorMessage(httpError(400, 'Exactly one of deudorId or deudor must be provided'))).toBe(VOICE.deuda.createError)
    expect(friendlyDeudaErrorMessage(httpError(400, ['deudor.nombre should not be empty']))).toBe(VOICE.deuda.createError)
  })

  // BE-15: abonoInicialMinor ahora va DENTRO de POST /deudas (transacción atómica) —
  // si por sí solo excede el total, la creación entera falla con este mensaje
  // (el mismo que un abono normal excesivo).
  it('BE-15: abonoInicialMinor que excede el saldo tiene su propio mensaje', () => {
    expect(friendlyDeudaErrorMessage(httpError(400, 'Abono of 20000 exceeds the remaining balance of 15000')))
      .toBe(VOICE.deuda.abonoInicialExceedsBalance)
  })

  it('403 (colaborador, no socio) también cae en el genérico de deuda', () => {
    expect(friendlyDeudaErrorMessage(httpError(403))).toBe(VOICE.deuda.createError)
  })

  it('nunca expone el texto crudo del servidor', () => {
    const message = friendlyDeudaErrorMessage(httpError(400, 'Insufficient stock for product p-1'))
    expect(message).not.toMatch(/p-1|Insufficient/)
  })
})
