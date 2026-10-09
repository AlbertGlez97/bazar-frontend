import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../api'
import { FinanceDistributionService, validDistributionSimulation } from '../finance-distribution.service'
import { FinanceDistributionContractError } from '@/utils/finance-distribution'
import { memberFixture, simulationFixture } from './finance-distribution.fixture'
import type { DistributionSimulationRequest } from '@/types/finance-distribution.types'

vi.mock('../api', () => ({ default: { post: vi.fn() } }))

const request: DistributionSimulationRequest = {
  from: '2026-10-01',
  to: '2026-11-01',
  requestedAmountMinor: 600000,
  partnerShareBps: 5000,
  workShareBps: 5000,
  workBasis: 'WORK_SHIFTS',
}

beforeEach(() => vi.mocked(api.post).mockReset())

describe('FinanceDistributionService.simulate', () => {
  it('posts exactly the six contract fields and returns the validated simulation', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: simulationFixture() })
    const result = await FinanceDistributionService.simulate(request)
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.post).toHaveBeenCalledWith('/finance/distribution-simulations', request)
    expect(result.simulationFingerprint).toBe('sim1:' + 'a'.repeat(64))
    expect(result.members.map((m) => m.totalMinor)).toEqual([270000, 330000])
  })

  it('never sends extra properties even when the caller passes them', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: simulationFixture() })
    const dirty = { ...request, memberIds: ['x'], persisted: true } as DistributionSimulationRequest
    await FinanceDistributionService.simulate(dirty)
    const body = vi.mocked(api.post).mock.calls[0]![1] as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(
      ['from', 'to', 'requestedAmountMinor', 'partnerShareBps', 'workShareBps', 'workBasis'].sort(),
    )
  })

  it('rejects an unexpected body with a contract error', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ok: true } })
    await expect(FinanceDistributionService.simulate(request)).rejects.toBeInstanceOf(FinanceDistributionContractError)
  })

  it('lets HTTP failures through untouched for the store to map', async () => {
    const failure = Object.assign(new Error('x'), { response: { status: 422 } })
    vi.mocked(api.post).mockRejectedValueOnce(failure)
    await expect(FinanceDistributionService.simulate(request)).rejects.toBe(failure)
  })
})

describe('validDistributionSimulation', () => {
  it('accepts the worked example and a partial base', () => {
    expect(validDistributionSimulation(simulationFixture())).toBe(true)
    const partial = simulationFixture()
    partial.financialBase.status = 'partial'
    expect(validDistributionSimulation(partial)).toBe(true)
  })

  it('accepts a member without work and an unknown warning code', () => {
    const s = simulationFixture({
      members: [memberFixture({ partnerAmountMinor: 600000, workUnits: 0, shiftCount: 0, workAmountMinor: 0, totalMinor: 600000 })],
      pools: { partnerPoolMinor: 600000, workPoolMinor: 0 },
      rule: { partnerShareBps: 10000, workShareBps: 0, workBasis: 'WORK_SHIFTS', partnerMode: 'EQUAL' },
      warnings: [{ code: 'SOMETHING_NEW', message: 'x' }],
    })
    expect(validDistributionSimulation(s)).toBe(true)
  })

  const base = simulationFixture()
  it.each([
    ['missing fingerprint', { ...base, simulationFingerprint: undefined }],
    ['short fingerprint', { ...base, simulationFingerprint: 'sim1:abc' }],
    ['uppercase fingerprint', { ...base, simulationFingerprint: 'sim1:' + 'A'.repeat(64) }],
    ['wrong fingerprint version', { ...base, simulationFingerprint: 'sim2:' + 'a'.repeat(64) }],
    ['not an object', 'nope'],
    ['null', null],
    ['persisted true', { ...base, persisted: true }],
    ['simulation false', { ...base, simulation: false }],
    ['wrong currency', { ...base, currency: 'USD' }],
    ['missing members', { ...base, members: undefined }],
    ['members not an array', { ...base, members: {} }],
    ['unknown role', { ...base, members: [memberFixture({ role: 'dueño' as never })] }],
    ['fractional money', { ...base, pools: { partnerPoolMinor: 300000.5, workPoolMinor: 299999.5 } }],
    ['negative amount', { ...base, members: [memberFixture({ partnerAmountMinor: -1, totalMinor: 119999 })] }],
    ['unknown status', { ...base, financialBase: { ...base.financialBase, status: 'maybe' } }],
    ['unknown basis', { ...base, rule: { ...base.rule, workBasis: 'HOURS' } }],
    ['unknown partner mode', { ...base, rule: { ...base.rule, partnerMode: 'CAPITAL' } }],
    ['bps not adding to 10000', { ...base, rule: { ...base.rule, workShareBps: 4000 } }],
    ['pools not adding to the amount', { ...base, pools: { partnerPoolMinor: 1, workPoolMinor: 2 } }],
    ['member total disagrees', { ...base, members: [memberFixture({ totalMinor: 1 }), base.members[1]] }],
    ['distributed disagrees with members', { ...base, totals: { distributedMinor: 1, undistributedMinor: 599999 } }],
    ['bad offset', { ...base, period: { ...base.period, utcOffsetMinutes: 0 } }],
    ['bad warnings', { ...base, warnings: [{ code: 1 }] }],
  ])('rejects %s', (_label, value) => {
    expect(validDistributionSimulation(value)).toBe(false)
  })
})
