// Motor de sincronización de la cola offline (contrato §1.6). Usa la cola REAL
// sobre fake-indexeddb y un `createSale` simulado, para probar el
// comportamiento de punta a punta sin red.
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeLocalDb } from '../local-db'
import * as salesQueue from '../sales-queue'
import { createSalesSync } from '../sales-sync'
import type { SalesSyncDeps } from '../sales-sync'
import SalesService from '../sales.service'
import api from '../api'
import { VOICE } from '@/config/voice'
import type { CreateSalePayload, CreateSaleResult, Sale } from '@/types/sale.types'

vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

const realIndexedDb = globalThis.indexedDB

function payloadFor(id: string, memberId = 'm-1'): CreateSalePayload {
  return {
    id, memberId, deviceId: 'd-1', occurredAt: '2026-09-25T12:00:00.000Z', currency: 'MXN',
    cashReceivedMinor: 10000, items: [{ productId: 'p-1', quantity: 1, unitPriceMinor: 5000 }],
  }
}

function saleFor(payload: CreateSalePayload, status: Sale['status'] = 'completada'): Sale {
  const rejected = status === 'rechazada_por_conflicto'
  return {
    id: payload.id, memberId: payload.memberId, deviceId: payload.deviceId,
    occurredAt: payload.occurredAt, receivedAt: '2026-09-25T12:00:01.000Z', currency: 'MXN', status,
    totalMinor: rejected ? null : 5000, cashReceivedMinor: payload.cashReceivedMinor,
    changeMinor: rejected ? null : 5000,
    conflictReason: rejected ? 'stock insuficiente al sincronizar' : null,
    conflictDetectedAt: rejected ? '2026-09-25T12:00:01.000Z' : null,
    items: [],
  }
}

const completed = (payload: CreateSalePayload, httpStatus = 201): CreateSaleResult => ({
  outcome: 'completed', httpStatus, replayed: httpStatus === 200, sale: saleFor(payload),
})
const conflict = (payload: CreateSalePayload, httpStatus = 201): CreateSaleResult => ({
  outcome: 'conflict', httpStatus, replayed: httpStatus === 200, sale: saleFor(payload, 'rechazada_por_conflicto'),
})
const httpError = (status: number, message: string | string[] = 'x') => ({
  isAxiosError: true, response: { status, data: { message } },
})
const networkError = () => ({ isAxiosError: true, code: 'ERR_NETWORK', message: 'Network Error' })

async function queueSale(id: string, createdAt: string, memberId = 'm-1') {
  const result = await salesQueue.enqueue({
    payload: payloadFor(id, memberId), createdAt, sellerName: 'Carlos',
    totalMinorEstimate: 5000, changeMinorEstimate: 5000,
  })
  if (!result.ok) throw new Error('no se pudo encolar en el test')
}

function makeSync(overrides: Partial<SalesSyncDeps> = {}) {
  const createSale = vi.fn<SalesSyncDeps['createSale']>(async (payload) => completed(payload))
  const deps: SalesSyncDeps = {
    createSale,
    queue: salesQueue,
    isOnline: () => true,
    canSync: () => true,
    locks: null,
    now: () => '2026-09-25T13:00:00.000Z',
    ...overrides,
  }
  return { ...createSalesSync(deps), createSale: deps.createSale as typeof createSale }
}

beforeEach(() => {
  closeLocalDb()
  globalThis.indexedDB = new IDBFactory()
  vi.clearAllMocks()
})
afterEach(() => {
  closeLocalDb()
  globalThis.indexedDB = realIndexedDb
})

describe('syncPendingSales — camino feliz', () => {
  it('envía las pendientes EN ORDEN de creación, una a la vez, con el cuerpo idéntico, y las borra', async () => {
    await queueSale('c', '2026-09-25T12:00:03.000Z')
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    await queueSale('b', '2026-09-25T12:00:02.000Z')

    let inFlight = 0
    let maxInFlight = 0
    const { syncPendingSales } = makeSync({
      createSale: vi.fn(async (payload) => {
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise((resolve) => setTimeout(resolve, 5))
        inFlight--
        return completed(payload)
      }),
    })

    const summary = await syncPendingSales()

    expect(summary).toEqual({ synced: 3, needsReview: 0, remainingPending: 0, stoppedBecause: null })
    expect(maxInFlight).toBe(1)
    expect(await salesQueue.list()).toEqual([])
  })

  it('cada venta viaja con su payload congelado exacto', async () => {
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    const { syncPendingSales, createSale } = makeSync()

    await syncPendingSales()

    expect(createSale).toHaveBeenCalledExactlyOnceWith(payloadFor('a'))
  })

  it('con la cola vacía no hace nada', async () => {
    const { syncPendingSales, createSale } = makeSync()
    expect(await syncPendingSales()).toEqual({ synced: 0, needsReview: 0, remainingPending: 0, stoppedBecause: null })
    expect(createSale).not.toHaveBeenCalled()
  })

  it('reenvío de una venta que el servidor YA tiene (200 idempotente): se borra sin duplicar', async () => {
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    const { syncPendingSales, createSale } = makeSync({
      createSale: vi.fn(async (payload) => completed(payload, 200)),
    })

    const summary = await syncPendingSales()

    expect(summary.synced).toBe(1)
    expect(await salesQueue.list()).toEqual([])
    expect(createSale).toHaveBeenCalledTimes(1)
  })

  it('offline al encolar y online después: sobrevive a un reload y se envía al reconectar', async () => {
    let online = false
    const { syncPendingSales, createSale } = makeSync({ isOnline: () => online })
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    closeLocalDb() // "reload" de la página

    expect(await syncPendingSales()).toMatchObject({ synced: 0, remainingPending: 1, stoppedBecause: 'offline' })
    expect(createSale).not.toHaveBeenCalled()
    expect((await salesQueue.list())).toHaveLength(1)

    online = true
    closeLocalDb()
    expect(await syncPendingSales()).toEqual({ synced: 1, needsReview: 0, remainingPending: 0, stoppedBecause: null })
    expect(createSale).toHaveBeenCalledTimes(1)
    expect(await salesQueue.list()).toEqual([])
  })
})

describe('syncPendingSales — resultados definitivos del servidor', () => {
  it('201 rechazada_por_conflicto -> needs_review con motivo amable; NO se borra y no se reintenta', async () => {
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    const { syncPendingSales, createSale } = makeSync({
      createSale: vi.fn(async (payload) => conflict(payload)),
    })

    const summary = await syncPendingSales()

    expect(summary).toEqual({ synced: 0, needsReview: 1, remainingPending: 0, stoppedBecause: null })
    const [record] = await salesQueue.list()
    expect(record.state).toBe('needs_review')
    expect(record.lastError).toBe(VOICE.sale.conflict)

    await syncPendingSales()
    expect(createSale).toHaveBeenCalledTimes(1)
  })

  it('200 idempotente de una rechazada también queda en needs_review', async () => {
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    const { syncPendingSales } = makeSync({ createSale: vi.fn(async (p) => conflict(p, 200)) })

    expect((await syncPendingSales()).needsReview).toBe(1)
    expect((await salesQueue.list())[0].state).toBe('needs_review')
  })

  it('400 -> needs_review con mensaje amable en español, NUNCA se reintenta y la cola sigue con la siguiente', async () => {
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    await queueSale('b', '2026-09-25T12:00:02.000Z')
    const createSale = vi.fn(async (payload: CreateSalePayload) => {
      if (payload.id === 'a') throw httpError(400, 'Insufficient stock for product p-1')
      return completed(payload)
    })
    const { syncPendingSales } = makeSync({ createSale })

    const first = await syncPendingSales()
    expect(first).toEqual({ synced: 1, needsReview: 1, remainingPending: 0, stoppedBecause: null })

    const [record] = await salesQueue.list()
    expect(record.id).toBe('a')
    expect(record.state).toBe('needs_review')
    expect(record.lastError).toBe(VOICE.sale.syncInsufficientStock)

    createSale.mockClear()
    await syncPendingSales()
    expect(createSale).not.toHaveBeenCalled()
  })

  it('409 (mismo id, otros datos) -> needs_review', async () => {
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    const { syncPendingSales } = makeSync({
      createSale: vi.fn(async () => { throw httpError(409, 'Sale a already exists with different data') }),
    })

    expect((await syncPendingSales()).needsReview).toBe(1)
    const [record] = await salesQueue.list()
    expect(record.state).toBe('needs_review')
    expect(record.lastError).toBe(VOICE.sale.syncPayloadConflict)
  })

  it('las needs_review no se envían nunca', async () => {
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    await salesQueue.markNeedsReview('a', 'Motivo')
    const { syncPendingSales, createSale } = makeSync()

    expect(await syncPendingSales()).toEqual({ synced: 0, needsReview: 0, remainingPending: 0, stoppedBecause: null })
    expect(createSale).not.toHaveBeenCalled()
  })
})

describe('syncPendingSales — fallos que detienen la corrida (no se pierde nada)', () => {
  it('error de red a media corrida: las restantes quedan pending y SIN tocar; la fallida suma un intento', async () => {
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    await queueSale('b', '2026-09-25T12:00:02.000Z')
    await queueSale('c', '2026-09-25T12:00:03.000Z')
    const createSale = vi.fn(async (payload: CreateSalePayload) => {
      if (payload.id === 'b') throw networkError()
      return completed(payload)
    })
    const { syncPendingSales } = makeSync({ createSale })

    const summary = await syncPendingSales()

    expect(summary).toEqual({ synced: 1, needsReview: 0, remainingPending: 2, stoppedBecause: 'network' })
    expect(createSale).toHaveBeenCalledTimes(2) // a y b; c ni se intentó
    const records = await salesQueue.list()
    expect(records.map((r) => [r.id, r.state, r.attempts])).toEqual([['b', 'pending', 1], ['c', 'pending', 0]])
    expect(records[0].lastAttemptAt).toBe('2026-09-25T13:00:00.000Z')
    expect(records[0].lastError).toBe(VOICE.networkError)
    expect(records[1].lastError).toBeUndefined()
  })

  it.each([500, 502, 503])('%i detiene la corrida como server', async (status) => {
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    await queueSale('b', '2026-09-25T12:00:02.000Z')
    const { syncPendingSales, createSale } = makeSync({
      createSale: vi.fn(async () => { throw httpError(status) }),
    })

    expect(await syncPendingSales()).toMatchObject({ remainingPending: 2, stoppedBecause: 'server' })
    expect(createSale).toHaveBeenCalledTimes(1)
  })

  it.each([401, 403])('%i detiene la corrida como auth y deja todo pending', async (status) => {
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    await queueSale('b', '2026-09-25T12:00:02.000Z')
    const { syncPendingSales, createSale } = makeSync({
      createSale: vi.fn(async () => { throw httpError(status, 'Unauthorized') }),
    })

    expect(await syncPendingSales()).toMatchObject({ synced: 0, remainingPending: 2, stoppedBecause: 'auth' })
    expect(createSale).toHaveBeenCalledTimes(1)
    expect((await salesQueue.list()).every((r) => r.state === 'pending')).toBe(true)
  })

  it('un 2xx que no es una venta (portal cautivo) se trata como server y no borra nada', async () => {
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    vi.mocked(api.post).mockResolvedValue({ status: 200, data: '<html>wifi login</html>' })
    const { syncPendingSales } = makeSync({ createSale: SalesService.createSale })

    expect(await syncPendingSales()).toMatchObject({ synced: 0, remainingPending: 1, stoppedBecause: 'server' })
    expect(await salesQueue.list()).toHaveLength(1)
  })

  it('si se pierde la conexión a media corrida, se detiene antes de la siguiente', async () => {
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    await queueSale('b', '2026-09-25T12:00:02.000Z')
    let online = true
    const { syncPendingSales, createSale } = makeSync({
      isOnline: () => online,
      createSale: vi.fn(async (payload) => {
        online = false
        return completed(payload)
      }),
    })

    expect(await syncPendingSales()).toEqual({ synced: 1, needsReview: 0, remainingPending: 1, stoppedBecause: 'offline' })
    expect(createSale).toHaveBeenCalledTimes(1)
  })

  it('sin sesión (canSync false) no envía nada', async () => {
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    const { syncPendingSales, createSale } = makeSync({ canSync: () => false })

    expect(await syncPendingSales()).toMatchObject({ remainingPending: 1, stoppedBecause: 'not-authenticated' })
    expect(createSale).not.toHaveBeenCalled()
  })

  it('si la cola no se puede leer se detiene con storage, sin lanzar', async () => {
    const { syncPendingSales, createSale } = makeSync({
      queue: { ...salesQueue, list: vi.fn(async () => { throw new Error('IDB roto') }) },
    })

    expect(await syncPendingSales()).toEqual({ synced: 0, needsReview: 0, remainingPending: 0, stoppedBecause: 'storage' })
    expect(createSale).not.toHaveBeenCalled()
  })

  it('si no se puede borrar tras un éxito, la venta queda (reenviarla es seguro: 200 idempotente) y se detiene', async () => {
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    await queueSale('b', '2026-09-25T12:00:02.000Z')
    const { syncPendingSales, createSale } = makeSync({
      queue: { ...salesQueue, remove: vi.fn(async () => { throw new Error('IDB roto') }) },
    })

    expect(await syncPendingSales()).toMatchObject({ stoppedBecause: 'storage' })
    expect(createSale).toHaveBeenCalledTimes(1)
    expect(await salesQueue.list()).toHaveLength(2)
  })
})

describe('syncPendingSales — headers por venta', () => {
  it('cada POST lleva x-member-id/x-device-id de SU venta, aunque las de otras personas estén en la misma cola', async () => {
    await queueSale('a', '2026-09-25T12:00:01.000Z', 'm-ana')
    await queueSale('b', '2026-09-25T12:00:02.000Z', 'm-luis')
    vi.mocked(api.post).mockImplementation(async (_url, body) => ({ status: 201, data: saleFor(body as CreateSalePayload) }))
    const { syncPendingSales } = makeSync({ createSale: SalesService.createSale })

    await syncPendingSales()

    const calls = vi.mocked(api.post).mock.calls
    expect(calls).toHaveLength(2)
    expect(calls[0][2]).toEqual({ headers: { 'x-member-id': 'm-ana', 'x-device-id': 'd-1' } })
    expect(calls[1][2]).toEqual({ headers: { 'x-member-id': 'm-luis', 'x-device-id': 'd-1' } })
    expect(calls[0][1]).toEqual(payloadFor('a', 'm-ana'))
  })
})

describe('syncPendingSales — exclusión mutua', () => {
  it('dos llamadas simultáneas envían UNA vez cada registro y comparten el resultado', async () => {
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    await queueSale('b', '2026-09-25T12:00:02.000Z')
    const { syncPendingSales, createSale } = makeSync()

    const [first, second] = await Promise.all([syncPendingSales(), syncPendingSales()])

    expect(createSale).toHaveBeenCalledTimes(2)
    expect(first).toEqual(second)
    expect(first.synced).toBe(2)
  })

  it('terminada una corrida, la siguiente sí arranca', async () => {
    const { syncPendingSales, createSale } = makeSync()
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    await syncPendingSales()
    await queueSale('b', '2026-09-25T12:00:02.000Z')
    await syncPendingSales()
    expect(createSale).toHaveBeenCalledTimes(2)
  })

  it('isRunning refleja la corrida en curso', async () => {
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    const { syncPendingSales, isRunning } = makeSync()

    const run = syncPendingSales()
    expect(isRunning()).toBe(true)
    await run
    expect(isRunning()).toBe(false)
  })

  it('con navigator.locks pide el candado sin esperar (ifAvailable) y corre dentro de él', async () => {
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    const request = vi.fn(async (_name: string, _opts: unknown, cb: (lock: unknown) => Promise<unknown>) => cb({}))
    const { syncPendingSales } = makeSync({ locks: { request } as unknown as LockManager })

    const summary = await syncPendingSales()

    expect(request).toHaveBeenCalledWith('la-marchanta-sales-sync', { ifAvailable: true }, expect.any(Function))
    expect(summary.synced).toBe(1)
  })

  it('si otra pestaña tiene el candado no envía nada y lo dice', async () => {
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    const request = vi.fn(async (_name: string, _opts: unknown, cb: (lock: unknown) => Promise<unknown>) => cb(null))
    const { syncPendingSales, createSale } = makeSync({ locks: { request } as unknown as LockManager })

    expect(await syncPendingSales()).toMatchObject({ synced: 0, remainingPending: 1, stoppedBecause: 'locked-elsewhere' })
    expect(createSale).not.toHaveBeenCalled()
  })

  it('si navigator.locks falla, corre igual (la idempotencia es la red de seguridad)', async () => {
    await queueSale('a', '2026-09-25T12:00:01.000Z')
    const request = vi.fn(async () => { throw new Error('locks no soportado') })
    const { syncPendingSales } = makeSync({ locks: { request } as unknown as LockManager })

    expect((await syncPendingSales()).synced).toBe(1)
  })
})
