import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSalesQueueStore } from '../sales-queue.store'
import { closeLocalDb } from '@/services/local-db'
import * as salesQueue from '@/services/sales-queue'
import SalesService from '@/services/sales.service'
import type { CreateSalePayload, CreateSaleResult, Sale } from '@/types/sale.types'

vi.mock('@/services/sales.service', () => ({ default: { createSale: vi.fn() } }))

const realIndexedDb = globalThis.indexedDB

function payloadFor(id: string): CreateSalePayload {
  return {
    id, memberId: 'm-1', deviceId: 'd-1', occurredAt: '2026-09-25T12:00:00.000Z', currency: 'MXN',
    cashReceivedMinor: 10000, items: [{ productId: 'p-1', quantity: 1 }],
  }
}

function completed(payload: CreateSalePayload): CreateSaleResult {
  const sale = {
    id: payload.id, memberId: payload.memberId, deviceId: payload.deviceId, occurredAt: payload.occurredAt,
    receivedAt: '2026-09-25T12:00:01.000Z', currency: 'MXN', status: 'completada', totalMinor: 5000,
    cashReceivedMinor: 10000, changeMinor: 5000, conflictReason: null, conflictDetectedAt: null, items: [],
  } satisfies Sale
  return { outcome: 'completed', httpStatus: 201, replayed: false, sale }
}

async function queueSale(id: string, createdAt: string) {
  await salesQueue.enqueue({ payload: payloadFor(id), createdAt, totalMinorEstimate: 5000, changeMinorEstimate: 5000 })
}

beforeEach(() => {
  closeLocalDb()
  globalThis.indexedDB = new IDBFactory()
  setActivePinia(createPinia())
  localStorage.setItem('access_token', 'jwt')
  vi.mocked(SalesService.createSale).mockReset()
  vi.mocked(SalesService.createSale).mockImplementation(async (payload) => completed(payload))
})
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  closeLocalDb()
  globalThis.indexedDB = realIndexedDb
})

describe('sales-queue.store — contadores', () => {
  it('arranca en cero', () => {
    const store = useSalesQueueStore()
    expect(store.pendingCount).toBe(0)
    expect(store.needsReviewCount).toBe(0)
    expect(store.isSyncing).toBe(false)
  })

  it('refreshCounts lee pending y needs_review de la cola', async () => {
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    await queueSale('b', '2026-09-25T12:00:02.000Z')
    await salesQueue.markNeedsReview('b', 'Motivo amable')
    const store = useSalesQueueStore()

    await store.refreshCounts()

    expect(store.pendingCount).toBe(1)
    expect(store.needsReviewCount).toBe(1)
    expect(store.needsReviewRecords.map((r) => [r.id, r.lastError])).toEqual([['b', 'Motivo amable']])
  })

  it('se actualizan solos tras cada cambio de la cola (encolar, revisar, descartar)', async () => {
    const store = useSalesQueueStore()

    await queueSale('a', '2026-09-25T12:00:01.000Z')
    await vi.waitFor(() => expect(store.pendingCount).toBe(1))

    await salesQueue.markNeedsReview('a', 'Motivo')
    await vi.waitFor(() => {
      expect(store.pendingCount).toBe(0)
      expect(store.needsReviewCount).toBe(1)
    })

    await store.dismissReview('a')
    await vi.waitFor(() => expect(store.needsReviewCount).toBe(0))
  })

  it('si IndexedDB falla conserva los últimos contadores y lo marca', async () => {
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    const store = useSalesQueueStore()
    await store.refreshCounts()
    expect(store.storageAvailable).toBe(true)

    closeLocalDb()
    // @ts-expect-error simulamos un navegador sin IndexedDB
    globalThis.indexedDB = undefined
    await store.refreshCounts()

    expect(store.pendingCount).toBe(1)
    expect(store.storageAvailable).toBe(false)
  })
})

describe('sales-queue.store — sincronización', () => {
  it('syncNow envía las pendientes, marca isSyncing durante la corrida y actualiza contadores', async () => {
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    const store = useSalesQueueStore()
    await store.refreshCounts()

    const run = store.syncNow()
    expect(store.isSyncing).toBe(true)
    const summary = await run

    expect(summary).toMatchObject({ synced: 1, stoppedBecause: null })
    expect(store.isSyncing).toBe(false)
    expect(store.pendingCount).toBe(0)
    expect(store.lastSummary).toEqual(summary)
    expect(SalesService.createSale).toHaveBeenCalledTimes(1)
  })

  it('start() sincroniza de inmediato lo que haya pendiente', async () => {
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    const store = useSalesQueueStore()

    await store.start()

    expect(SalesService.createSale).toHaveBeenCalledTimes(1)
    expect(store.pendingCount).toBe(0)
    store.stop()
  })

  it('sin conexión no envía y los contadores siguen mostrando la pendiente', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    const store = useSalesQueueStore()

    await store.start()

    expect(SalesService.createSale).not.toHaveBeenCalled()
    expect(store.pendingCount).toBe(1)
    store.stop()
  })

  it('una venta que el servidor rechaza (400) pasa a needs_review y se refleja en el store', async () => {
    vi.mocked(SalesService.createSale).mockRejectedValue({
      isAxiosError: true, response: { status: 400, data: { message: 'Insufficient stock for product p-1' } },
    })
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    const store = useSalesQueueStore()

    await store.syncNow()

    expect(store.pendingCount).toBe(0)
    expect(store.needsReviewCount).toBe(1)
    expect(store.needsReviewRecords[0].lastError).toMatch(/servidor/)
  })

  it('sin sesión (sin token) no envía', async () => {
    localStorage.removeItem('access_token')
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    const store = useSalesQueueStore()

    const summary = await store.syncNow()

    expect(summary.stoppedBecause).toBe('not-authenticated')
    expect(SalesService.createSale).not.toHaveBeenCalled()
  })

  it('stop() es seguro aunque no se haya iniciado', () => {
    const store = useSalesQueueStore()
    expect(() => store.stop()).not.toThrow()
  })

  it('dismissReview solo descarta una needs_review', async () => {
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    const store = useSalesQueueStore()

    expect(await store.dismissReview('a')).toBe(false)
    expect(await salesQueue.list()).toHaveLength(1)
  })
})
