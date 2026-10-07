import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../api'
import { FinanceOverviewService, validFinanceOverview } from '../finance-overview.service'
import { overviewFixture } from './finance-overview.fixture'

vi.mock('../api', () => ({ default: { get: vi.fn() } }))

describe('FinanceOverviewService', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
  })

  it('requests the overview with from and the EXCLUSIVE to as given', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: overviewFixture() })
    const result = await FinanceOverviewService.get('2026-10-01', '2026-10-08')
    expect(api.get).toHaveBeenCalledWith('/finance/overview', {
      params: { from: '2026-10-01', to: '2026-10-08' },
    })
    expect(result.sales.salesMinor).toBe(100000)
  })

  it('accepts negative results and a null coverage percentage', () => {
    const o = overviewFixture()
    o.result.recordedOperatingResultMinor = -5000
    o.costCoverage.knownCostLinePercentage = null
    expect(validFinanceOverview(o)).toBe(true)
  })

  it.each([
    ['not an object', 'nope'],
    ['missing sections', { currency: 'MXN' }],
    ['wrong currency', { ...overviewFixture(), currency: 'USD' }],
    ['fractional money', { ...overviewFixture(), sales: { ...overviewFixture().sales, salesMinor: 10.5 } }],
    ['unknown status', { ...overviewFixture(), result: { ...overviewFixture().result, status: 'maybe' } }],
    ['claims to be cash', { ...overviewFixture(), result: { ...overviewFixture().result, isCashBalance: true } }],
    ['includes local pending', { ...overviewFixture(), sync: { source: 'x', localPendingIncluded: true } }],
    ['percentage out of range', { ...overviewFixture(), costCoverage: { ...overviewFixture().costCoverage, knownCostLinePercentage: 140 } }],
    ['bad warnings', { ...overviewFixture(), warnings: [{ code: 1 }] }],
    ['bad timestamp', { ...overviewFixture(), generatedAt: 'yesterday' }],
  ])('rejects an unknown shape: %s', async (_name, payload) => {
    expect(validFinanceOverview(payload)).toBe(false)
    vi.mocked(api.get).mockResolvedValue({ data: payload })
    await expect(FinanceOverviewService.get('2026-10-01', '2026-10-02')).rejects.toThrow(/Invalid finance overview/)
  })

  it('propagates request failures untouched', async () => {
    const failure = Object.assign(new Error('Unprocessable'), {
      response: { status: 422, data: { code: 'FINANCE_OVERVIEW_OVERFLOW' } },
    })
    vi.mocked(api.get).mockImplementation(() => Promise.reject(failure))
    const caught = await FinanceOverviewService.get('2026-10-01', '2026-10-02').catch((e: unknown) => e)
    expect(caught === failure).toBe(true)
  })
})
