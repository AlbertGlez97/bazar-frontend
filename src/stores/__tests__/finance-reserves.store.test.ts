import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFinanceReservesStore, type ReservesQuery } from '../finance-reserves.store'
import { useFinanceOverviewStore } from '../finance-overview.store'
import {
  RESERVE_ID,
  cancellationFixture,
  cancellationReceiptFixture,
  reserveItemFixture,
  reservePageFixture,
  reserveReceiptFixture,
} from '@/services/__tests__/finance-reserves.fixture'
import type { ReserveFields } from '@/types/finance-reserve.types'

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  cancel: vi.fn(),
  origin: { accountId: 'a', apiBase: '/api/v1', memberId: 'm', deviceId: 'd' } as object | null,
}))
vi.mock('@/services/finance-reserves.service', () => ({
  FinanceReservesService: { list: mocks.list, create: mocks.create, cancel: mocks.cancel },
}))
vi.mock('@/services/finance-overview.service', () => ({ FinanceOverviewService: { get: vi.fn() } }))
vi.mock('@/services/work-shifts.service', () => ({ WorkShiftsService: { summary: vi.fn() } }))
vi.mock('@/services/queue-origin', () => ({ currentQueueOrigin: () => mocks.origin }))

const query: ReservesQuery = { range: { from: '2026-10-01', to: '2026-10-31' }, scope: 'period', status: 'active' }
const fields: ReserveFields = {
  name: 'Renta',
  amountMinor: 500000,
  periodFrom: '2026-10-01',
  periodTo: '2026-11-01',
  note: null,
}
const failure = (status?: number) => Object.assign(new Error('x'), status ? { response: { status } } : {})
function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  setActivePinia(createPinia())
  mocks.list.mockReset()
  mocks.create.mockReset()
  mocks.cancel.mockReset()
  mocks.origin = { accountId: 'a', apiBase: '/api/v1', memberId: 'm', deviceId: 'd' }
  mocks.list.mockResolvedValue(reservePageFixture())
})

describe('reserves store: list', () => {
  it('loads the exact period with the exclusive end and the chosen status', async () => {
    const store = useFinanceReservesStore()
    await store.load(query)
    expect(mocks.list).toHaveBeenCalledWith(mocks.origin, {
      status: 'active',
      limit: 20,
      from: '2026-10-01',
      to: '2026-11-01',
    })
    expect(store.items).toHaveLength(1)
    expect(store.shown).toEqual(query)
    expect(store.loading).toBe(false)
    expect(store.error).toBe('')
  })

  it('omits from/to when asking for every period', async () => {
    const store = useFinanceReservesStore()
    await store.load({ ...query, scope: 'all', status: 'reversed' })
    expect(mocks.list.mock.calls[0]![1]).toEqual({ status: 'reversed', limit: 20 })
  })

  it('pages with the cursor unchanged and appends without duplicating items', async () => {
    const second = reserveItemFixture({ id: '0199a600-0000-7000-8000-0000000000aa', name: 'Luz' })
    mocks.list
      .mockResolvedValueOnce(reservePageFixture([reserveItemFixture()], 'cursor-1=='))
      .mockResolvedValueOnce(reservePageFixture([reserveItemFixture(), second], null))
    const store = useFinanceReservesStore()
    await store.load(query)
    expect(store.nextCursor).toBe('cursor-1==')
    await store.loadMore()
    expect(mocks.list.mock.calls[1]![1]).toMatchObject({ cursor: 'cursor-1==', from: '2026-10-01', to: '2026-11-01' })
    expect(store.items.map((i) => i.name)).toEqual(['Renta del local', 'Luz'])
    expect(store.nextCursor).toBeNull()
    await store.loadMore() // nothing more to load
    expect(mocks.list).toHaveBeenCalledTimes(2)
  })

  it('ignores a slow response for an old query (stale-response guard)', async () => {
    const slow = deferred<ReturnType<typeof reservePageFixture>>()
    mocks.list.mockReturnValueOnce(slow.promise)
    const store = useFinanceReservesStore()
    const first = store.load(query)
    mocks.list.mockResolvedValueOnce(reservePageFixture([reserveItemFixture({ name: 'Nueva' })]))
    await store.load({ ...query, scope: 'all' })
    slow.resolve(reservePageFixture([reserveItemFixture({ name: 'Vieja' })]))
    await first
    expect(store.items.map((i) => i.name)).toEqual(['Nueva'])
    expect(store.shown?.scope).toBe('all')
    expect(store.loading).toBe(false)
  })

  it('drops a pending next-page response when a new query started', async () => {
    const slow = deferred<ReturnType<typeof reservePageFixture>>()
    mocks.list.mockResolvedValueOnce(reservePageFixture([reserveItemFixture()], 'c1'))
    const store = useFinanceReservesStore()
    await store.load(query)
    mocks.list.mockReturnValueOnce(slow.promise)
    const more = store.loadMore()
    mocks.list.mockResolvedValueOnce(reservePageFixture([reserveItemFixture({ name: 'Otra' })]))
    await store.load({ ...query, status: 'reversed' })
    slow.resolve(reservePageFixture([reserveItemFixture({ name: 'Tarde' })]))
    await more
    expect(store.items.map((i) => i.name)).toEqual(['Otra'])
  })

  it('keeps the last confirmed list and reports a calm error when a refresh fails', async () => {
    const store = useFinanceReservesStore()
    await store.load(query)
    mocks.list.mockRejectedValueOnce(failure())
    await store.load(query)
    expect(store.items).toHaveLength(1)
    expect(store.error).toContain('conectarnos')
    expect(store.loading).toBe(false)
  })

  it('explains a missing list route and flags the error as not worth retrying', async () => {
    mocks.list.mockRejectedValueOnce(failure(404))
    const store = useFinanceReservesStore()
    await store.load(query)
    expect(store.error).toContain('Esta función aún no está disponible en el servidor')
    expect(store.retryable).toBe(false)
    mocks.list.mockRejectedValueOnce(failure(500))
    await store.load(query)
    expect(store.retryable).toBe(true)
  })

  it('reports a context problem without calling the API when there is no origin', async () => {
    mocks.origin = null
    const store = useFinanceReservesStore()
    await store.load(query)
    expect(mocks.list).not.toHaveBeenCalled()
    expect(store.error).not.toBe('')
  })
})

describe('reserves store: create', () => {
  it('sends the origin, a UUID, the audit instant, then refreshes the list and the loaded overview', async () => {
    mocks.create.mockResolvedValue(reserveReceiptFixture())
    const overview = useFinanceOverviewStore()
    const loadOverview = vi.spyOn(overview, 'load').mockResolvedValue()
    overview.period = { from: '2026-10-01', to: '2026-10-31' }
    const store = useFinanceReservesStore()
    await store.load(query)
    mocks.list.mockClear()
    expect(await store.create(fields)).toBe(true)
    const body = mocks.create.mock.calls[0]![1]
    expect(body).toMatchObject({ ...fields, currency: 'MXN', createdByMemberId: 'm', deviceId: 'd' })
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(Number.isNaN(Date.parse(body.occurredAt))).toBe(false)
    expect(mocks.list).toHaveBeenCalledTimes(1)
    expect(loadOverview).toHaveBeenCalledWith({ from: '2026-10-01', to: '2026-10-31' })
    expect(store.savedName).toBe('Renta del local')
    expect(store.saveError).toBe('')
  })

  it('does not touch the overview when it was never loaded', async () => {
    mocks.create.mockResolvedValue(reserveReceiptFixture())
    const overview = useFinanceOverviewStore()
    const loadOverview = vi.spyOn(overview, 'load').mockResolvedValue()
    const store = useFinanceReservesStore()
    await store.load(query)
    await store.create(fields)
    expect(loadOverview).not.toHaveBeenCalled()
  })

  it('reuses the SAME id and audit instant when retrying after a network failure, then uses a fresh id', async () => {
    mocks.create.mockRejectedValueOnce(failure()).mockResolvedValue(reserveReceiptFixture())
    const store = useFinanceReservesStore()
    expect(await store.create(fields)).toBe(false)
    expect(store.saveError).toBe('No pudimos guardar la reserva. Revisa tu conexión; si reintentas no se duplicará.')
    expect(store.savedName).toBe('')
    expect(await store.create(fields)).toBe(true)
    const [first, second] = mocks.create.mock.calls.map((c) => c[1])
    expect(second.id).toBe(first.id)
    expect(second.occurredAt).toBe(first.occurredAt)
    await store.create(fields)
    expect(mocks.create.mock.calls[2]![1].id).not.toBe(first.id)
  })

  it('reuses the id after a 5xx too, but frees it after a definitive 400', async () => {
    mocks.create.mockRejectedValueOnce(failure(503)).mockRejectedValueOnce(failure(400)).mockResolvedValue(reserveReceiptFixture())
    const store = useFinanceReservesStore()
    await store.create(fields)
    await store.create(fields)
    await store.create(fields)
    const ids = mocks.create.mock.calls.map((c) => c[1].id)
    expect(ids[1]).toBe(ids[0])
    expect(ids[2]).not.toBe(ids[1])
    expect(store.saveError).toBe('')
  })

  it('maps a 409 to a calm message, refreshes the list and starts a new id', async () => {
    mocks.create.mockRejectedValueOnce(failure(409)).mockResolvedValue(reserveReceiptFixture())
    const store = useFinanceReservesStore()
    await store.load(query)
    mocks.list.mockClear()
    expect(await store.create(fields)).toBe(false)
    expect(store.saveError).toContain('Revisa la lista')
    expect(mocks.list).toHaveBeenCalledTimes(1)
    await store.create(fields)
    expect(mocks.create.mock.calls[1]![1].id).not.toBe(mocks.create.mock.calls[0]![1].id)
  })

  it('explains a missing create route and does not claim anything was saved', async () => {
    mocks.create.mockRejectedValueOnce(failure(404))
    const store = useFinanceReservesStore()
    expect(await store.create(fields)).toBe(false)
    expect(store.saveError).toContain('Esta función aún no está disponible en el servidor')
    expect(store.saveError).not.toMatch(/guardada|ya no existe/)
  })

  it('ignores a second submit while one is in flight', async () => {
    const slow = deferred<ReturnType<typeof reserveReceiptFixture>>()
    mocks.create.mockReturnValueOnce(slow.promise)
    const store = useFinanceReservesStore()
    const first = store.create(fields)
    expect(store.saving).toBe(true)
    expect(await store.create(fields)).toBe(false)
    slow.resolve(reserveReceiptFixture())
    await first
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(store.saving).toBe(false)
  })

  it('keeps the loaded data when saving fails and never reports it as saved', async () => {
    mocks.create.mockRejectedValue(failure())
    const store = useFinanceReservesStore()
    await store.load(query)
    await store.create(fields)
    expect(store.items).toHaveLength(1)
    expect(store.savedName).toBe('')
  })

  it('discarding the draft frees the pending id on purpose', async () => {
    mocks.create.mockRejectedValue(failure())
    const store = useFinanceReservesStore()
    await store.create(fields)
    store.discardDraft()
    await store.create(fields)
    expect(mocks.create.mock.calls[1]![1].id).not.toBe(mocks.create.mock.calls[0]![1].id)
    expect(store.saveError).not.toBe('') // the new attempt failed again
  })
})

describe('reserves store: cancel', () => {
  const reserve = { id: RESERVE_ID, name: 'Renta del local' }

  it('sends a NEW cancellation id with the reason, then refreshes list and overview', async () => {
    mocks.cancel.mockResolvedValue(cancellationReceiptFixture())
    const overview = useFinanceOverviewStore()
    const loadOverview = vi.spyOn(overview, 'load').mockResolvedValue()
    overview.period = { from: '2026-10-01', to: '2026-10-31' }
    const store = useFinanceReservesStore()
    await store.load(query)
    mocks.list.mockClear()
    expect(await store.cancel(reserve, 'Ya no se necesita')).toBe(true)
    const [origin, reserveId, body] = mocks.cancel.mock.calls[0]!
    expect(origin).toBe(mocks.origin)
    expect(reserveId).toBe(RESERVE_ID)
    expect(body).toMatchObject({ reason: 'Ya no se necesita', createdByMemberId: 'm', deviceId: 'd' })
    expect(body.id).not.toBe(RESERVE_ID)
    expect(mocks.list).toHaveBeenCalledTimes(1)
    expect(loadOverview).toHaveBeenCalled()
    expect(store.cancelledName).toBe('Renta del local')
  })

  it('reuses the cancellation id and instant on retry after a failure', async () => {
    mocks.cancel.mockRejectedValueOnce(failure()).mockResolvedValue(cancellationReceiptFixture())
    const store = useFinanceReservesStore()
    expect(await store.cancel(reserve, 'motivo')).toBe(false)
    expect(store.cancelError).toContain('no se anulará dos veces')
    expect(await store.cancel(reserve, 'motivo')).toBe(true)
    const [a, b] = mocks.cancel.mock.calls.map((c) => c[2])
    expect(b.id).toBe(a.id)
    expect(b.occurredAt).toBe(a.occurredAt)
  })

  it('maps 409 to "already cancelled", refreshes the list and frees the id', async () => {
    mocks.cancel.mockRejectedValueOnce(failure(409)).mockResolvedValue(cancellationReceiptFixture())
    const store = useFinanceReservesStore()
    await store.load(query)
    mocks.list.mockClear()
    expect(await store.cancel(reserve, 'motivo')).toBe(false)
    expect(store.cancelError).toContain('ya estaba anulada')
    expect(mocks.list).toHaveBeenCalledTimes(1)
    await store.cancel(reserve, 'motivo')
    expect(mocks.cancel.mock.calls[1]![2].id).not.toBe(mocks.cancel.mock.calls[0]![2].id)
  })

  it('exposes the id in flight, refuses a second cancel and attributes the error to the failing reserve', async () => {
    const first = deferred<ReturnType<typeof cancellationReceiptFixture>>()
    mocks.cancel.mockReturnValueOnce(first.promise)
    const store = useFinanceReservesStore()
    const other = { id: 'other-id', name: 'Otra' }
    const pending = store.cancel(reserve, 'motivo')
    expect(store.cancellingId).toBe(RESERVE_ID)
    expect(await store.cancel(other, 'motivo')).toBe(false)
    expect(mocks.cancel).toHaveBeenCalledTimes(1)
    expect(store.cancellingId).toBe(RESERVE_ID)
    expect(store.cancelErrorId).toBe('')
    first.reject(failure(500))
    expect(await pending).toBe(false)
    expect(store.cancellingId).toBe('')
    expect(store.cancelErrorId).toBe(RESERVE_ID)
    expect(store.cancelError).not.toBe('')
    mocks.cancel.mockResolvedValue(cancellationReceiptFixture())
    expect(await store.cancel(other, 'motivo')).toBe(true)
    expect(store.cancelErrorId).toBe('')
    expect(mocks.cancel).toHaveBeenCalledTimes(2)
  })

  it('keeps the list intact when cancelling fails', async () => {
    mocks.cancel.mockRejectedValue(failure(500))
    const store = useFinanceReservesStore()
    await store.load(query)
    await store.cancel(reserve, 'motivo')
    expect(store.items).toHaveLength(1)
    expect(store.cancelledName).toBe('')
  })

  it('shows a cancelled reserve with its reason after the refresh', async () => {
    mocks.cancel.mockResolvedValue(cancellationReceiptFixture())
    const store = useFinanceReservesStore()
    await store.load(query)
    mocks.list.mockResolvedValueOnce(
      reservePageFixture([reserveItemFixture({ status: 'reversed', reversal: cancellationFixture() })]),
    )
    await store.cancel(reserve, 'Ya no se necesita')
    expect(store.items[0]!.status).toBe('reversed')
    expect(store.items[0]!.reversal?.reason).toBe('Ya no se necesita')
  })
})

describe('reserves store: reset', () => {
  it('clears everything and ignores responses that arrive afterwards', async () => {
    const slow = deferred<ReturnType<typeof reservePageFixture>>()
    mocks.list.mockReturnValueOnce(slow.promise)
    const store = useFinanceReservesStore()
    const pending = store.load(query)
    store.reset()
    slow.resolve(reservePageFixture())
    await pending
    expect(store.items).toEqual([])
    expect(store.shown).toBeNull()
    expect(store.loading).toBe(false)
  })
})

it.each(['create', 'cancel'] as const)('suppresses late %s results after reset without refreshing another session', async (operation) => {
  const pending = deferred<ReturnType<typeof reserveReceiptFixture>>()
  mocks[operation].mockReturnValueOnce(pending.promise)
  const store = useFinanceReservesStore()
  await store.load(query)
  const run = operation === 'create' ? store.create(fields) : store.cancel({ id: RESERVE_ID, name: 'Renta' }, 'reason')
  store.reset()
  mocks.list.mockClear()
  pending.resolve(reserveReceiptFixture())
  expect(await run).toBe(false)
  expect(store.savedName).toBe('')
  expect(store.cancelledName).toBe('')
  expect(mocks.list).not.toHaveBeenCalled()
})
it('keeps saving guarded until post-write refresh finishes', async () => {
  const pending = deferred<ReturnType<typeof reservePageFixture>>()
  const store = useFinanceReservesStore()
  await store.load(query)
  mocks.create.mockResolvedValue(reserveReceiptFixture())
  mocks.list.mockReturnValueOnce(pending.promise)
  const run = store.create(fields)
  await new Promise((r) => setTimeout(r, 0))
  expect(store.saving).toBe(true)
  expect(await store.create(fields)).toBe(false)
  pending.resolve(reservePageFixture())
  expect(await run).toBe(true)
  expect(store.saving).toBe(false)
})

it.each(['create', 'cancel'] as const)('ignores a late %s failure after reset and preserves the new request busy state', async (operation) => {
  const old = deferred<ReturnType<typeof reserveReceiptFixture>>()
  const next = deferred<ReturnType<typeof reserveReceiptFixture>>()
  mocks[operation].mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise)
  const store = useFinanceReservesStore()
  const start = () => operation === 'create' ? store.create(fields) : store.cancel({ id: RESERVE_ID, name: 'Renta' }, 'reason')
  const first = start()
  store.reset()
  const second = start()
  old.reject(failure())
  expect(await first).toBe(false)
  expect(store.saveError).toBe('')
  expect(store.cancelError).toBe('')
  expect(operation === 'create' ? store.saving : store.cancelling).toBe(true)
  next.resolve(reserveReceiptFixture())
  expect(await second).toBe(true)
})
