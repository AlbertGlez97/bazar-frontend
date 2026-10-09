import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFinanceDistributionStore } from '../finance-distribution.store'
import { useFinanceOverviewStore } from '../finance-overview.store'
import { FinanceDistributionContractError } from '@/utils/finance-distribution'
import { FinanceOverviewContractError } from '@/utils/finance-overview'
import { overviewFixture } from '@/services/__tests__/finance-overview.fixture'
import { simulationFixture } from '@/services/__tests__/finance-distribution.fixture'
import type { DistributionSimulationRequest } from '@/types/finance-distribution.types'

const mocks = vi.hoisted(() => ({ simulate: vi.fn(), overview: vi.fn() }))
vi.mock('@/services/finance-distribution.service', () => ({
  FinanceDistributionService: { simulate: mocks.simulate },
}))
vi.mock('@/services/finance-overview.service', () => ({
  FinanceOverviewService: { get: mocks.overview },
}))

const request: DistributionSimulationRequest = {
  from: '2026-10-01',
  to: '2026-11-01',
  requestedAmountMinor: 600000,
  partnerShareBps: 5000,
  workShareBps: 5000,
  workBasis: 'WORK_SHIFTS',
}
const period = { from: '2026-10-01', to: '2026-10-31' }
const http = (status: number, data: unknown = {}) => Object.assign(new Error('x'), { response: { status, data } })

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
  mocks.simulate.mockReset()
  mocks.overview.mockReset()
})

describe('simulator pre-base', () => {
  it('reads the potentially available amount for the exclusive period and leaves the Resumen store alone', async () => {
    const o = overviewFixture()
    o.result.potentiallyAvailableMinor = 800000
    o.result.status = 'partial'
    mocks.overview.mockResolvedValue(o)
    const store = useFinanceDistributionStore()
    const resumen = useFinanceOverviewStore()
    await store.loadBase(period)
    expect(mocks.overview).toHaveBeenCalledWith('2026-10-01', '2026-11-01')
    expect(store.base).toEqual({ period, potentiallyAvailableMinor: 800000, status: 'partial' })
    expect(store.baseLoading).toBe(false)
    expect(resumen.overview).toBeNull()
    expect(resumen.period).toBeNull()
  })

  it('ignores a slow response for an old period', async () => {
    const slow = deferred<ReturnType<typeof overviewFixture>>()
    mocks.overview.mockReturnValueOnce(slow.promise)
    const fresh = overviewFixture()
    fresh.result.potentiallyAvailableMinor = 111
    mocks.overview.mockResolvedValueOnce(fresh)
    const store = useFinanceDistributionStore()
    const first = store.loadBase(period)
    await store.loadBase({ from: '2026-11-01', to: '2026-11-30' })
    const stale = overviewFixture()
    stale.result.potentiallyAvailableMinor = 999
    slow.resolve(stale)
    await first
    expect(store.base?.potentiallyAvailableMinor).toBe(111)
    expect(store.base?.period.from).toBe('2026-11-01')
    expect(store.baseLoading).toBe(false)
  })

  it('keeps the last confirmed copy for the same period when a refresh fails, and marks it stale', async () => {
    mocks.overview.mockResolvedValueOnce(overviewFixture())
    const store = useFinanceDistributionStore()
    await store.loadBase(period)
    mocks.overview.mockRejectedValueOnce(http(500))
    await store.loadBase(period)
    expect(store.base).not.toBeNull()
    expect(store.baseIsStale).toBe(true)
    expect(store.baseError).not.toBe('')
    expect(store.baseRetryable).toBe(true)
  })

  it('drops a base that belongs to another period so its amount can never be applied by mistake', async () => {
    mocks.overview.mockResolvedValueOnce(overviewFixture())
    const store = useFinanceDistributionStore()
    await store.loadBase(period)
    mocks.overview.mockRejectedValueOnce(http(500))
    await store.loadBase({ from: '2026-12-01', to: '2026-12-31' })
    expect(store.base).toBeNull()
    expect(store.baseIsStale).toBe(false)
  })

  it('does not offer a retry for a contract error or a missing route', async () => {
    const store = useFinanceDistributionStore()
    mocks.overview.mockRejectedValueOnce(new FinanceOverviewContractError())
    await store.loadBase(period)
    expect(store.baseRetryable).toBe(false)
    mocks.overview.mockRejectedValueOnce(http(404))
    await store.loadBase(period)
    expect(store.baseRetryable).toBe(false)
    mocks.overview.mockResolvedValueOnce(overviewFixture())
    await store.loadBase(period)
    expect(store.baseRetryable).toBe(true)
    expect(store.baseError).toBe('')
  })
})

describe('simulate', () => {
  it('stores the result with the exact request that produced it', async () => {
    mocks.simulate.mockResolvedValue(simulationFixture())
    const store = useFinanceDistributionStore()
    await expect(store.simulate(request)).resolves.toBe(true)
    expect(mocks.simulate).toHaveBeenCalledWith(request)
    expect(store.result?.totals.distributedMinor).toBe(600000)
    expect(store.resultRequest).toEqual(request)
    expect(store.resultRequest).not.toBe(request)
    expect(store.simulating).toBe(false)
    expect(store.error).toBe('')
  })

  it('refuses a second submit while one is running', async () => {
    const pending = deferred<ReturnType<typeof simulationFixture>>()
    mocks.simulate.mockReturnValueOnce(pending.promise)
    const store = useFinanceDistributionStore()
    const first = store.simulate(request)
    await expect(store.simulate(request)).resolves.toBe(false)
    expect(mocks.simulate).toHaveBeenCalledTimes(1)
    pending.resolve(simulationFixture())
    await expect(first).resolves.toBe(true)
  })

  it('maps failures to friendly text and keeps the previous result', async () => {
    mocks.simulate.mockResolvedValueOnce(simulationFixture())
    const store = useFinanceDistributionStore()
    await store.simulate(request)
    mocks.simulate.mockRejectedValueOnce(http(422, { code: 'FINANCE_DISTRIBUTION_EXCEEDS_AVAILABLE' }))
    await expect(store.simulate({ ...request, requestedAmountMinor: 9 })).resolves.toBe(false)
    expect(store.error).toBe('El monto supera lo potencialmente disponible del período.')
    expect(store.result).not.toBeNull()
    expect(store.resultRequest).toEqual(request)
    expect(store.simulating).toBe(false)
  })

  it('uses the hours basis to explain a missing duration and a contract error calmly', async () => {
    const store = useFinanceDistributionStore()
    mocks.simulate.mockRejectedValueOnce(
      http(422, { code: 'FINANCE_DISTRIBUTION_NO_WORK', message: 'All shifts of the period lack a known duration' }),
    )
    await store.simulate({ ...request, workBasis: 'KNOWN_MINUTES' })
    expect(store.error).toMatch(/ninguna tiene duración registrada/)
    mocks.simulate.mockRejectedValueOnce(new FinanceDistributionContractError())
    await store.simulate(request)
    expect(store.error).toMatch(/formato inesperado/)
    store.clearError()
    expect(store.error).toBe('')
  })

  it('clears the previous error when a new simulation starts', async () => {
    const store = useFinanceDistributionStore()
    mocks.simulate.mockRejectedValueOnce(http(500))
    await store.simulate(request)
    expect(store.error).not.toBe('')
    mocks.simulate.mockResolvedValueOnce(simulationFixture())
    await store.simulate(request)
    expect(store.error).toBe('')
  })
})

describe('reset and "Nueva simulación"', () => {
  it('clearResult forgets the result and ignores a request still in flight', async () => {
    const pending = deferred<ReturnType<typeof simulationFixture>>()
    mocks.simulate.mockReturnValueOnce(pending.promise)
    const store = useFinanceDistributionStore()
    const run = store.simulate(request)
    store.clearResult()
    expect(store.simulating).toBe(false)
    pending.resolve(simulationFixture())
    await expect(run).resolves.toBe(false)
    expect(store.result).toBeNull()
    expect(store.resultRequest).toBeNull()
  })

  it('reset wipes everything and late responses never repopulate the store', async () => {
    const slowBase = deferred<ReturnType<typeof overviewFixture>>()
    const slowSim = deferred<ReturnType<typeof simulationFixture>>()
    mocks.overview.mockReturnValueOnce(slowBase.promise)
    mocks.simulate.mockReturnValueOnce(slowSim.promise)
    const store = useFinanceDistributionStore()
    const base = store.loadBase(period)
    const sim = store.simulate(request)
    store.reset()
    slowBase.resolve(overviewFixture())
    slowSim.resolve(simulationFixture())
    await base
    await expect(sim).resolves.toBe(false)
    expect(store.base).toBeNull()
    expect(store.result).toBeNull()
    expect(store.resultRequest).toBeNull()
    expect(store.baseLoading).toBe(false)
    expect(store.simulating).toBe(false)
    expect(store.error).toBe('')
  })

  it('a failure after a reset does not surface an error from the previous session', async () => {
    const pending = deferred<never>()
    mocks.simulate.mockReturnValueOnce(pending.promise)
    const store = useFinanceDistributionStore()
    const run = store.simulate(request)
    store.reset()
    pending.reject(http(500))
    await run
    expect(store.error).toBe('')
  })

  it('persists nothing on the device', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    mocks.simulate.mockResolvedValue(simulationFixture())
    mocks.overview.mockResolvedValue(overviewFixture())
    const store = useFinanceDistributionStore()
    await store.loadBase(period)
    await store.simulate(request)
    expect(setItem).not.toHaveBeenCalled()
    setItem.mockRestore()
    const source = readFileSync(resolve(__dirname, '../finance-distribution.store.ts'), 'utf8')
    expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB|local-db/i)
  })
})

describe('result eligibility', () => {
  it('keeps a failed retry invalid after clearing presentation errors and restores only on success', async () => {
    const store = useFinanceDistributionStore()
    const overview = overviewFixture()
    overview.result.potentiallyAvailableMinor = 800000
    mocks.overview.mockResolvedValue(overview)
    mocks.simulate.mockResolvedValue(simulationFixture())
    await store.loadBase(period)
    await store.simulate(request)
    expect(store.isResultEligible(request)).toBe(true)
    mocks.simulate.mockRejectedValueOnce(http(500))
    await store.simulate(request)
    store.clearError()
    await store.loadBase(period)
    expect(store.isResultEligible(request)).toBe(false)
    await store.simulate(request)
    expect(store.isResultEligible(request)).toBe(true)
  })

  it('blocks pending or changed bases and lets drift invalidate a pending simulation', async () => {
    const store = useFinanceDistributionStore()
    const overview = overviewFixture()
    overview.result.potentiallyAvailableMinor = 800000
    mocks.overview.mockResolvedValue(overview)
    mocks.simulate.mockResolvedValue(simulationFixture())
    await store.loadBase(period)
    await store.simulate(request)
    const pendingBase = deferred<ReturnType<typeof overviewFixture>>()
    mocks.overview.mockReturnValueOnce(pendingBase.promise)
    const refresh = store.loadBase(period)
    expect(store.isResultEligible(request)).toBe(false)
    pendingBase.resolve(overview)
    await refresh
    expect(store.isResultEligible(request)).toBe(true)
    overview.result.potentiallyAvailableMinor = 900000
    await store.loadBase(period)
    expect(store.isResultEligible(request)).toBe(false)
    overview.result.potentiallyAvailableMinor = 800000
    await store.loadBase(period)
    expect(store.isResultEligible(request)).toBe(false)
    const pendingSim = deferred<ReturnType<typeof simulationFixture>>()
    mocks.simulate.mockReturnValueOnce(pendingSim.promise)
    const run = store.simulate(request)
    store.invalidateResult()
    pendingSim.resolve(simulationFixture())
    await expect(run).resolves.toBe(false)
    expect(store.isResultEligible(request)).toBe(false)
    expect(store.result).not.toBeNull()
  })
})