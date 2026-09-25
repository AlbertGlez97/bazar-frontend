import { describe, expect, it } from 'vitest'
import { describeCheckoutResult } from '../sale-result'
import { VOICE, saleConflictMessage } from '@/config/voice'
import type { CheckoutResult } from '@/stores/checkout.store'
import type { Sale } from '@/types/sale.types'

const sale = (overrides: Partial<Sale> = {}): Sale => ({
  id: 's-1',
  memberId: 'm-1',
  deviceId: 'd-1',
  occurredAt: '2026-09-25T12:00:00.000Z',
  receivedAt: '2026-09-25T12:00:01.000Z',
  currency: 'MXN',
  status: 'completada',
  totalMinor: 25000,
  cashReceivedMinor: 30000,
  changeMinor: 5000,
  conflictReason: null,
  conflictDetectedAt: null,
  items: [],
  ...overrides,
})

describe('describeCheckoutResult', () => {
  it('success: totales del servidor y el resumen de marca con el vendedor', () => {
    const view = describeCheckoutResult({ kind: 'success', sale: sale(), totalMinor: 25000, changeMinor: 5000 }, 'Carlos')
    expect(view).toEqual({
      kind: 'success',
      totalMinor: 25000,
      changeMinor: 5000,
      summary: 'Venta anotada: $250.00. Cambio: $50.00. Quedó a nombre de Carlos.',
    })
  })

  it('success sin vendedor conocido omite "Quedó a nombre de"', () => {
    const view = describeCheckoutResult({ kind: 'success', sale: sale(), totalMinor: 12550, changeMinor: 0 })
    expect(view).toMatchObject({ kind: 'success', summary: 'Venta anotada: $125.50.' })
  })

  it('saved-offline conserva los totales locales', () => {
    expect(describeCheckoutResult({ kind: 'saved-offline', pendingId: 'p', totalMinor: 1999, changeMinor: 1 }))
      .toEqual({ kind: 'saved-offline', totalMinor: 1999, changeMinor: 1 })
  })

  it('conflict: mensaje amable de la marca y el motivo del servidor SOLO como detalle', () => {
    const result: CheckoutResult = {
      kind: 'conflict',
      sale: sale({ status: 'rechazada_por_conflicto', totalMinor: null, changeMinor: null, conflictReason: 'stock insuficiente al sincronizar: producto p' }),
      reason: saleConflictMessage(),
    }
    expect(describeCheckoutResult(result)).toEqual({
      kind: 'conflict',
      message: saleConflictMessage(),
      detail: 'stock insuficiente al sincronizar: producto p',
    })
  })

  it('rejected, auth-needed y failed-to-save pasan su mensaje amable', () => {
    expect(describeCheckoutResult({ kind: 'rejected', reasonMessage: 'algo amable', canFix: true }))
      .toEqual({ kind: 'rejected', message: 'algo amable' })
    expect(describeCheckoutResult({ kind: 'auth-needed', pendingId: 'p', totalMinor: 5000, changeMinor: 0, message: 'sesión' }))
      .toEqual({ kind: 'auth-needed', message: 'sesión', totalMinor: 5000, changeMinor: 0 })
    expect(describeCheckoutResult({ kind: 'failed-to-save', message: 'no se guardó' }))
      .toEqual({ kind: 'failed-to-save', message: 'no se guardó' })
  })

  it('blocked: un texto amable por motivo', () => {
    expect(describeCheckoutResult({ kind: 'blocked', reason: 'empty-cart' }))
      .toEqual({ kind: 'blocked', message: VOICE.sale.blockedEmptyCart })
    expect(describeCheckoutResult({ kind: 'blocked', reason: 'cash-insufficient' }))
      .toEqual({ kind: 'blocked', message: VOICE.sale.cashInsufficient })
    expect(describeCheckoutResult({ kind: 'blocked', reason: 'missing-context' }))
      .toEqual({ kind: 'blocked', message: VOICE.sale.blockedMissingContext })
  })
})
