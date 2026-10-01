import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import * as queue from '../sales-queue'
import { closeLocalDb } from '../local-db'
import { createSalesSync } from '../sales-sync'
import { createSyncScheduler } from '../sales-sync-scheduler'
import DeudasService from '../deudas.service'
import api from '../api'

vi.mock('../api', () => ({ default: { post: vi.fn() } }))
const origin = { accountId: 'account-a', memberId: 'member-a', deviceId: 'device-a', apiBase: '/api/v1' }
const payload = { id: 'debt-a', type: 'fiado' as const, productId: 'product-a', cantidad: 2, deudor: { nombre: 'Ana' }, abonoInicialMinor: 1000, cuotasPlaneadas: [{ fechaEsperada: '2026-10-15', montoEsperadoMinor: 3000 }] }
const debt = { ...payload, status: 'pendiente', totalMinor: 4000, abonos: [], cuotasPlaneadas: [], createdByMemberId: origin.memberId }
const cash = { id: 'cash-a', memberId: 'member-a', deviceId: 'device-a', occurredAt: '2026-10-01T00:00:00Z', currency: 'MXN' as const, cashReceivedMinor: 4000, items: [{ productId: 'product-a', quantity: 1 }] }
const enqueueDebt = () => queue.enqueueDebt({ payload, origin, totalMinorEstimate: 4000, pendingMinorEstimate: 3000 })
const engine = (overrides = {}) => createSalesSync({ createSale: vi.fn(async () => ({ outcome: 'completed' as const, httpStatus: 201, replayed: false, sale: {} as never })), createDebt: vi.fn(async () => debt), canSyncRecord: () => true, queue, isOnline: () => true, canSync: () => true, locks: null, now: () => '2026-10-01T00:00:00Z', ...overrides })
beforeEach(() => { closeLocalDb(); globalThis.indexedDB = new IDBFactory(); vi.clearAllMocks() })
afterEach(() => { closeLocalDb(); vi.restoreAllMocks() })

describe('shared offline debt queue', () => {
  it('durably freezes debt, origin, initial payment and installments without credentials', async () => {
    const source = structuredClone(payload)
    await queue.enqueueDebt({ payload: source, origin, totalMinorEstimate: 4000, pendingMinorEstimate: 3000 })
    source.deudor.nombre = 'Changed'
    source.cuotasPlaneadas[0]!.montoEsperadoMinor = 99
    closeLocalDb()
    const records = await queue.list()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ kind: 'debt', payload, origin, state: 'pending' })
    expect(JSON.stringify(records)).not.toMatch(/access_token|Authorization|deviceToken/)
    expect(await queue.count()).toBe(1)
    await enqueueDebt()
    expect(await queue.count()).toBe(1)
  })
  it('keeps legacy cash and debt in one sequential engine', async () => {
    await queue.enqueue({ payload: cash, totalMinorEstimate: 4000, changeMinorEstimate: 0, createdAt: '2026-01-01' })
    await enqueueDebt()
    const createSale = vi.fn(async () => ({ outcome: 'completed' as const, httpStatus: 201, replayed: false, sale: {} as never }))
    const createDebt = vi.fn(async () => { expect(createSale).toHaveBeenCalledTimes(1); return debt })
    expect(await engine({ createSale, createDebt }).syncPendingSales()).toMatchObject({ synced: 2, remainingPending: 0 })
    expect(createDebt).toHaveBeenCalledWith(payload, origin)
    expect(await queue.list()).toEqual([])
  })
  it.each([400, 409])('retains definitive %i rejection as visible needs_review', async (status) => {
    await enqueueDebt()
    const createDebt = vi.fn().mockRejectedValue({ response: { status, data: { message: 'Insufficient stock' } } })
    expect(await engine({ createDebt }).syncPendingSales()).toMatchObject({ needsReview: 1, remainingPending: 0 })
    expect(await queue.countNeedsReview()).toBe(1)
    expect((await queue.list())[0]).toMatchObject({ kind: 'debt', payload, state: 'needs_review' })
  })
  it('retains same payload after ambiguous failure and retries on reconnection', async () => {
    await enqueueDebt()
    let online = false
    vi.mocked(api.post).mockRejectedValueOnce({ code: 'ERR_NETWORK' }).mockResolvedValue({ status: 201, data: debt })
    const createDebt = vi.fn((body, selected) => DeudasService.createDeuda(body, { origin: selected }))
    const sync = engine({ createDebt, isOnline: () => online })
    const scheduler = createSyncScheduler({ sync: sync.syncPendingSales, countPending: queue.count, isOnline: () => online, target: window })
    await scheduler.start()
    expect(createDebt).not.toHaveBeenCalled()
    online = true
    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(createDebt).toHaveBeenCalledTimes(1))
    await vi.waitFor(async () => expect((await queue.list())[0]?.attempts).toBe(1))
    window.dispatchEvent(new Event('online'))
    await vi.waitFor(async () => expect(await queue.count()).toBe(0))
    expect(createDebt.mock.calls[0]).toEqual(createDebt.mock.calls[1])
    scheduler.stop()
  })
  it('does not post incompatible origin, nor silently discard its record', async () => {
    await enqueueDebt()
    const createDebt = vi.fn()
    const result = await engine({ createDebt, canSyncRecord: () => false }).syncPendingSales()
    expect(createDebt).not.toHaveBeenCalled()
    expect(result).toMatchObject({ synced: 0, remainingPending: 1, stoppedBecause: 'context' })
  })
  it('rechecks authentication before each send after an earlier awaited request', async () => {
    await queue.enqueue({ payload: cash, totalMinorEstimate: 4000, changeMinorEstimate: 0, createdAt: '2026-01-01' })
    await enqueueDebt()
    let authenticated = true
    const createDebt = vi.fn()
    const createSale = vi.fn(async () => { authenticated = false; return { outcome: 'completed' as const, httpStatus: 201, replayed: false, sale: {} as never } })
    await engine({ createSale, createDebt, canSync: () => authenticated }).syncPendingSales()
    expect(createDebt).not.toHaveBeenCalled()
    expect(await queue.count()).toBe(1)
  })
  it('sends frozen selection headers and retains unexpected responses', async () => {
    vi.mocked(api.post).mockResolvedValue({ status: 201, data: debt })
    await DeudasService.createDeuda(payload, { origin, handleAuthLocally: true })
    expect(api.post).toHaveBeenCalledWith('/deudas', payload, { debtOrigin: origin, headers: { 'x-member-id': origin.memberId, 'x-device-id': origin.deviceId }, skipAuthRedirect: true })
    vi.mocked(api.post).mockResolvedValue({ status: 200, data: { ...debt, id: 'other' } })
    await expect(DeudasService.createDeuda(payload, { origin })).rejects.toThrow()
  })
})
