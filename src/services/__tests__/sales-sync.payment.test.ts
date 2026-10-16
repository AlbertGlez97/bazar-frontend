// Cola offline y método de pago: lo encolado ANTES de existir el campo se
// reenvía igual (el servidor lo toma como EFECTIVO y lo reconoce como reenvío);
// lo nuevo viaja con su método. Cola REAL sobre fake-indexeddb.
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeLocalDb } from '../local-db'
import * as salesQueue from '../sales-queue'
import { createSalesSync } from '../sales-sync'
import type { SalesSyncDeps } from '../sales-sync'
import { queuedPaymentMethod } from '@/utils/payment-method'
import type { CreateSalePayload, CreateSaleResult, Sale } from '@/types/sale.types'

vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

const realIndexedDb = globalThis.indexedDB
const ORIGIN = { accountId: 'account-a', apiBase: '/api/v1', memberId: 'm-1', deviceId: 'd-1' } as never

function salePayload(id: string, overrides: Partial<CreateSalePayload> = {}): CreateSalePayload {
  return {
    id, memberId: 'm-1', deviceId: 'd-1', occurredAt: '2026-09-25T12:00:00.000Z', currency: 'MXN',
    cashReceivedMinor: 10000, items: [{ productId: 'p-1', quantity: 1, unitPriceMinor: 5000 }], ...overrides,
  }
}

const saleOf = (payload: CreateSalePayload): Sale => ({
  id: payload.id, memberId: payload.memberId, deviceId: payload.deviceId, occurredAt: payload.occurredAt,
  receivedAt: '2026-09-25T12:00:01.000Z', currency: 'MXN', status: 'completada', totalMinor: 5000,
  paymentMethod: payload.paymentMethod ?? 'EFECTIVO', cashReceivedMinor: payload.cashReceivedMinor ?? null,
  changeMinor: payload.cashReceivedMinor === undefined ? null : payload.cashReceivedMinor - 5000,
  conflictReason: null, conflictDetectedAt: null, items: [],
})
const completed = (payload: CreateSalePayload): CreateSaleResult => ({ outcome: 'completed', httpStatus: 201, replayed: false, sale: saleOf(payload) })

async function queueSale(payload: CreateSalePayload, createdAt: string) {
  const saved = await salesQueue.enqueue({ payload, createdAt, sellerName: 'Carlos', totalMinorEstimate: 5000, changeMinorEstimate: 0 })
  if (!saved.ok) throw new Error('no se pudo encolar en el test')
  return saved.record
}

function makeSync() {
  const createSale = vi.fn<SalesSyncDeps['createSale']>(async (payload) => completed(payload))
  const createDebt = vi.fn<NonNullable<SalesSyncDeps['createDebt']>>(async () => ({}))
  const sync = createSalesSync({
    createSale, createDebt, queue: salesQueue, isOnline: () => true, canSync: () => true, locks: null,
    now: () => '2026-09-25T13:00:00.000Z',
  })
  return { ...sync, createSale, createDebt }
}

beforeEach(() => {
  closeLocalDb()
  globalThis.indexedDB = new IDBFactory()
})
afterEach(() => {
  closeLocalDb()
  globalThis.indexedDB = realIndexedDb
})

describe('cola offline — ventas con y sin método', () => {
  it('una venta encolada antes de existir el campo se trata como EFECTIVO y se envía SIN tocar su cuerpo congelado', async () => {
    const legacy = salePayload('0190a5f0-7c3e-7000-8000-000000000001')
    expect(legacy).not.toHaveProperty('paymentMethod')
    const record = await queueSale(legacy, '2026-09-25T12:00:00.000Z')
    const { syncPendingSales, createSale } = makeSync()

    const summary = await syncPendingSales()

    expect(queuedPaymentMethod(record)).toBe('EFECTIVO')
    expect(createSale).toHaveBeenCalledExactlyOnceWith(legacy)
    expect(createSale.mock.calls[0]![0]).not.toHaveProperty('paymentMethod')
    expect(summary).toMatchObject({ synced: 1, needsReview: 0, remainingPending: 0, stoppedBecause: null })
  })

  it.each(['TRANSFERENCIA', 'TARJETA'] as const)('una venta nueva por %s se envía con su método y sin efectivo', async (paymentMethod) => {
    const { cashReceivedMinor: _cash, ...rest } = salePayload('0190a5f0-7c3e-7000-8000-000000000002')
    const payload: CreateSalePayload = { ...rest, paymentMethod }
    const record = await queueSale(payload, '2026-09-25T12:00:00.000Z')
    const { syncPendingSales, createSale } = makeSync()

    await syncPendingSales()

    expect(queuedPaymentMethod(record)).toBe(paymentMethod)
    expect(createSale).toHaveBeenCalledExactlyOnceWith(payload)
    expect(createSale.mock.calls[0]![0]).not.toHaveProperty('cashReceivedMinor')
  })

  it('una cola mezclada (vieja, efectivo nueva, tarjeta) se envía en orden y cada una con lo suyo', async () => {
    const old = salePayload('0190a5f0-7c3e-7000-8000-000000000011')
    const cash = salePayload('0190a5f0-7c3e-7000-8000-000000000012', { paymentMethod: 'EFECTIVO' })
    const { cashReceivedMinor: _cash, ...rest } = salePayload('0190a5f0-7c3e-7000-8000-000000000013')
    const card: CreateSalePayload = { ...rest, paymentMethod: 'TARJETA' }
    await queueSale(old, '2026-09-25T12:00:01.000Z')
    await queueSale(cash, '2026-09-25T12:00:02.000Z')
    await queueSale(card, '2026-09-25T12:00:03.000Z')
    const { syncPendingSales, createSale } = makeSync()

    const summary = await syncPendingSales()

    expect(createSale.mock.calls.map(([p]) => p)).toEqual([old, cash, card])
    expect(summary.synced).toBe(3)
  })

  it('el registro encolado conserva el método tal como se guardó', async () => {
    const { cashReceivedMinor: _cash, ...rest } = salePayload('0190a5f0-7c3e-7000-8000-000000000021')
    await queueSale({ ...rest, paymentMethod: 'TRANSFERENCIA' }, '2026-09-25T12:00:00.000Z')

    const [stored] = await salesQueue.list()

    expect(stored!.kind === 'debt' ? null : stored!.payload.paymentMethod).toBe('TRANSFERENCIA')
  })
})

describe('cola offline — deudas con y sin método', () => {
  const debtPayload = (id: string, extra: Record<string, unknown> = {}) => ({
    id, type: 'fiado' as const, productId: 'p-1', cantidad: 1, deudor: { nombre: 'Lucía' }, abonoInicialMinor: 3000, ...extra,
  })

  async function queueDebt(payload: ReturnType<typeof debtPayload>, createdAt: string) {
    const saved = await salesQueue.enqueueDebt({ payload, origin: ORIGIN, createdAt, sellerName: 'Carlos', totalMinorEstimate: 5000, pendingMinorEstimate: 2000 })
    if (!saved.ok) throw new Error('no se pudo encolar en el test')
    return saved.record
  }

  it('un fiado encolado antes de existir el campo se trata como EFECTIVO y se envía tal cual', async () => {
    const legacy = debtPayload('0190a5f0-7c3e-7000-8000-000000000031')
    const record = await queueDebt(legacy, '2026-09-25T12:00:00.000Z')
    const { syncPendingSales, createDebt } = makeSync()

    await syncPendingSales()

    expect(queuedPaymentMethod(record)).toBe('EFECTIVO')
    expect(createDebt.mock.calls[0]![0]).toEqual(legacy)
    expect(createDebt.mock.calls[0]![0]).not.toHaveProperty('abonoInicialPaymentMethod')
  })

  it('un fiado nuevo viaja con el método del abono inicial', async () => {
    const payload = debtPayload('0190a5f0-7c3e-7000-8000-000000000032', { abonoInicialPaymentMethod: 'TRANSFERENCIA' })
    const record = await queueDebt(payload, '2026-09-25T12:00:00.000Z')
    const { syncPendingSales, createDebt } = makeSync()

    await syncPendingSales()

    expect(queuedPaymentMethod(record)).toBe('TRANSFERENCIA')
    expect(createDebt.mock.calls[0]![0]).toMatchObject({ abonoInicialPaymentMethod: 'TRANSFERENCIA', abonoInicialMinor: 3000 })
  })
})
