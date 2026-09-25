import { describe, expect, it } from 'vitest'
import {
  UnexpectedSaleResponseError,
  classifySaleError,
  extractSaleErrorMessages,
  friendlySaleErrorMessage,
} from '../sale-errors'
import { VOICE } from '@/config/voice'

/** Forma mínima de un AxiosError con respuesta. */
function httpError(status: number, message?: string | string[]) {
  return { isAxiosError: true, response: { status, data: message === undefined ? {} : { message } } }
}

describe('classifySaleError', () => {
  it('sin respuesta (ERR_NETWORK, timeout, offline) es network', () => {
    expect(classifySaleError({ isAxiosError: true, code: 'ERR_NETWORK', message: 'Network Error' })).toBe('network')
    expect(classifySaleError({ isAxiosError: true, code: 'ECONNABORTED', message: 'timeout of 10000ms exceeded' })).toBe('network')
    expect(classifySaleError(new Error('boom'))).toBe('network')
    expect(classifySaleError(null)).toBe('network')
  })

  it.each([500, 502, 503, 504])('%i es server', (status) => {
    expect(classifySaleError(httpError(status))).toBe('server')
  })

  it('401 y 403 son auth (la venta no se pierde: se reintenta tras volver a entrar)', () => {
    expect(classifySaleError(httpError(401, 'Unauthorized'))).toBe('auth')
    expect(classifySaleError(httpError(403, 'Sale attribution must match the authenticated selection'))).toBe('auth')
  })

  it('400 es business', () => {
    expect(classifySaleError(httpError(400, 'Insufficient stock for product p-1'))).toBe('business')
  })

  it('409 es conflict-payload', () => {
    expect(classifySaleError(httpError(409, 'Sale x already exists with different data'))).toBe('conflict-payload')
  })

  it('408 y 429 son transitorios: se tratan como server (se reintenta)', () => {
    expect(classifySaleError(httpError(408))).toBe('server')
    expect(classifySaleError(httpError(429))).toBe('server')
  })

  it('otros 4xx (413, 404, 422) no se reintentan para siempre: business', () => {
    expect(classifySaleError(httpError(413, 'request entity too large'))).toBe('business')
    expect(classifySaleError(httpError(404))).toBe('business')
    expect(classifySaleError(httpError(422))).toBe('business')
  })

  it('una respuesta 2xx que no es una venta (portal cautivo, proxy) es server', () => {
    expect(classifySaleError(new UnexpectedSaleResponseError(200))).toBe('server')
  })
})

describe('extractSaleErrorMessages', () => {
  it('normaliza string y arreglo con Array.isArray(message) ? message : [message]', () => {
    expect(extractSaleErrorMessages(httpError(400, 'Insufficient stock for product p-1'))).toEqual([
      'Insufficient stock for product p-1',
    ])
    expect(extractSaleErrorMessages(httpError(400, ['items must not be empty', 'currency must be MXN']))).toEqual([
      'items must not be empty',
      'currency must be MXN',
    ])
  })

  it('devuelve [] si no hay cuerpo utilizable (HTML, sin mensaje, sin respuesta)', () => {
    expect(extractSaleErrorMessages({ response: { status: 404, data: '<pre>Cannot GET /</pre>' } })).toEqual([])
    expect(extractSaleErrorMessages(httpError(500))).toEqual([])
    expect(extractSaleErrorMessages(new Error('x'))).toEqual([])
  })
})

describe('friendlySaleErrorMessage', () => {
  it('stock insuficiente: dice qué pasó y qué hacer', () => {
    const msg = friendlySaleErrorMessage(httpError(400, 'Insufficient stock for product 30000000-0000-4000-8000-000000000001'))
    expect(msg).toBe(VOICE.sale.insufficientStock)
    expect(msg).not.toMatch(/30000000/) // nunca expone el id crudo
  })

  it('efectivo insuficiente', () => {
    expect(friendlySaleErrorMessage(httpError(400, 'Cash received is insufficient for the calculated total'))).toBe(
      VOICE.sale.cashInsufficient,
    )
  })

  it('producto desactivado', () => {
    expect(friendlySaleErrorMessage(httpError(400, 'Product p-1 is deactivated and cannot be sold'))).toBe(
      VOICE.sale.productDeactivated,
    )
  })

  it('producto inexistente', () => {
    expect(friendlySaleErrorMessage(httpError(400, 'Product p-1 does not exist in this context'))).toBe(
      VOICE.sale.productMissing,
    )
  })

  it('409 (mismo id, otros datos)', () => {
    expect(friendlySaleErrorMessage(httpError(409, 'Sale x already exists with different data'))).toBe(
      VOICE.sale.payloadConflict,
    )
  })

  it('400 desconocido o de validación cae en un mensaje genérico de venta, sin texto en inglés', () => {
    const msg = friendlySaleErrorMessage(httpError(400, ['items must not be empty']))
    expect(msg).toBe(VOICE.sale.rejectedGeneric)
    expect(msg).not.toMatch(/items must/)
  })

  it('red, servidor y sesión usan los textos compartidos', () => {
    expect(friendlySaleErrorMessage({ isAxiosError: true, code: 'ERR_NETWORK' })).toBe(VOICE.networkError)
    expect(friendlySaleErrorMessage(httpError(503))).toBe(VOICE.genericError)
    expect(friendlySaleErrorMessage(httpError(401, 'Unauthorized'))).toBe(VOICE.sale.authNeeded)
    expect(friendlySaleErrorMessage(httpError(403, 'Forbidden'))).toBe(VOICE.sale.authNeeded)
  })

  it('en contexto de sincronización el texto describe una venta ya hecha, no invita a editar el carrito', () => {
    const checkout = friendlySaleErrorMessage(httpError(400, 'Insufficient stock for product p-1'), 'checkout')
    const sync = friendlySaleErrorMessage(httpError(400, 'Insufficient stock for product p-1'), 'sync')
    expect(sync).not.toBe(checkout)
    expect(sync).toBe(VOICE.sale.syncInsufficientStock)
  })
})
