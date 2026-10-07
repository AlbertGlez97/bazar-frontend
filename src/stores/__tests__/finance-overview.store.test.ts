import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFinanceOverviewStore } from '../finance-overview.store'
import { overviewFixture } from '@/services/__tests__/finance-overview.fixture'
import type { FinanceOverview } from '@/types/finance-overview.types'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  summary: vi.fn(),
  origin: { accountId: 'a', apiBase: '/api/v1', memberId: 'm', deviceId: 'd' } as object | null,
}))
vi.mock('@/services/finance-overview.service', () => ({
  FinanceOverviewService: { get: mocks.get },
}))
vi.mock('@/services/work-shifts.service', () => ({
  WorkShiftsService: { summary: mocks.summary },
}))
vi.mock('@/services/queue-origin', () => ({ currentQueueOrigin: () => mocks.origin }))

const partnerSummary = {
  totals: { shiftCount: 2, knownMinutes: 480, unknownDurationCount: 0 },
  members: [{ memberId: 'ana', shiftCount: 2, knownMinutes: 480, unknownDurationCount: 0 }],
}
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
  mocks.get.mockReset()
  mocks.summary.mockReset()
  mocks.origin = { accountId: 'a', apiBase: '/api/v1', memberId: 'm', deviceId: 'd' }
  mocks.summary.mockResolvedValue(partnerSummary)
})

describe('finance overview store', () => {
  it('loads the overview and the partner summary for the same exclusive period', async () => {
    mocks.get.mockResolvedValue(overviewFixture())
    const store = useFinanceOverviewStore()
    await store.load({ from: '2026-10-01', to: '2026-10-07' })
    expect(mocks.get).toHaveBeenCalledWith('2026-10-01', '2026-10-08')
    expect(mocks.summary).toHaveBeenCalledWith(mocks.origin, { from: '2026-10-01', to: '2026-10-08' })
    expect(store.overview?.sales.salesMinor).toBe(100000)
    expect(store.partners).toEqual(partnerSummary)
    expect(store.period).toEqual({ from: '2026-10-01', to: '2026-10-07' })
    expect(store.loading).toBe(false)
    expect(store.error).toBe('')
    expect(store.isStale).toBe(false)
  })

  it('degrades to overview totals when the partner summary fails or has no origin', async () => {
    mocks.get.mockResolvedValue(overviewFixture())
    mocks.summary.mockRejectedValue(new Error('offline'))
    const store = useFinanceOverviewStore()
    await store.load({ from: '2026-10-01', to: '2026-10-07' })
    expect(store.overview).not.toBeNull()
    expect(store.partners).toBeNull()
    expect(store.error).toBe('')

    mocks.origin = null
    await store.load({ from: '2026-10-01', to: '2026-10-07' })
    expect(store.partners).toBeNull()
    expect(store.overview).not.toBeNull()
  })

  it('keeps the last confirmed data and flags it stale when a refresh fails', async () => {
    const store = useFinanceOverviewStore()
    mocks.get.mockResolvedValueOnce(overviewFixture())
    await store.load({ from: '2026-10-01', to: '2026-10-07' })
    mocks.get.mockRejectedValueOnce(new Error('Network Error'))
    await store.load({ from: '2026-10-01', to: '2026-10-07' })
    expect(store.overview?.sales.salesMinor).toBe(100000)
    expect(store.partners).toEqual(partnerSummary)
    expect(store.error).toMatch(/No pudimos conectarnos/)
    expect(store.isStale).toBe(true)
    expect(store.loading).toBe(false)
  })

  it('keeps the previous period label when a different period fails to load', async () => {
    const store = useFinanceOverviewStore()
    mocks.get.mockResolvedValueOnce(overviewFixture())
    await store.load({ from: '2026-10-01', to: '2026-10-07' })
    mocks.get.mockRejectedValueOnce(new Error('x'))
    await store.load({ from: '2026-09-01', to: '2026-09-30' })
    expect(store.period).toEqual({ from: '2026-10-01', to: '2026-10-07' })
  })

  it('shows a friendly message for backend 422 codes and has no data on first failure', async () => {
    mocks.get.mockRejectedValue({ response: { status: 422, data: { code: 'FINANCE_OVERVIEW_OVERFLOW' } } })
    const store = useFinanceOverviewStore()
    await store.load({ from: '2026-10-01', to: '2026-10-07' })
    expect(store.error).toContain('periodo más corto')
    expect(store.overview).toBeNull()
    expect(store.isStale).toBe(false)
  })

  it('ignores a stale response for an older period', async () => {
    const slow = deferred<FinanceOverview>()
    const fast = overviewFixture({ sales: { saleCount: 1, salesMinor: 777, recordedCostMinor: 0, recordedGrossMarginMinor: 777 } })
    mocks.get.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(fast)
    const store = useFinanceOverviewStore()
    const first = store.load({ from: '2026-09-01', to: '2026-09-30' })
    await store.load({ from: '2026-10-01', to: '2026-10-07' })
    slow.resolve(overviewFixture())
    await first
    expect(store.overview?.sales.salesMinor).toBe(777)
    expect(store.period).toEqual({ from: '2026-10-01', to: '2026-10-07' })
  })

  it('ignores a stale failure so it cannot flag newer data as stale', async () => {
    const slow = deferred<FinanceOverview>()
    mocks.get.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(overviewFixture())
    const store = useFinanceOverviewStore()
    const first = store.load({ from: '2026-09-01', to: '2026-09-30' })
    await store.load({ from: '2026-10-01', to: '2026-10-07' })
    slow.reject(new Error('late'))
    await first
    expect(store.error).toBe('')
    expect(store.overview).not.toBeNull()
  })

  it('reports loading while a request is pending and reset clears everything', async () => {
    const pending = deferred<FinanceOverview>()
    mocks.get.mockReturnValueOnce(pending.promise)
    const store = useFinanceOverviewStore()
    const run = store.load({ from: '2026-10-01', to: '2026-10-07' })
    expect(store.loading).toBe(true)
    store.reset()
    pending.resolve(overviewFixture())
    await run
    expect(store.overview).toBeNull()
    expect(store.loading).toBe(false)
  })
})
