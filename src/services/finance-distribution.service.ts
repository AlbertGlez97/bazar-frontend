import api from './api'
import { FinanceDistributionContractError } from '@/utils/finance-distribution'
import type {
  DistributionSimulation,
  DistributionSimulationRequest,
} from '@/types/finance-distribution.types'

type Rec = Record<string, unknown>
const obj = (v: unknown): Rec | null =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Rec) : null
const int = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v)
const count = (v: unknown): v is number => int(v) && v >= 0
const text = (v: unknown): v is string => typeof v === 'string'
const BPS_TOTAL = 10000

function validMember(value: unknown): boolean {
  const m = obj(value)
  return (
    !!m &&
    text(m.memberId) &&
    text(m.name) &&
    (m.role === 'socio' || m.role === 'colaborador') &&
    typeof m.isActive === 'boolean' &&
    typeof m.partnerEligible === 'boolean' &&
    count(m.partnerAmountMinor) &&
    count(m.workUnits) &&
    count(m.shiftCount) &&
    count(m.knownMinutes) &&
    count(m.unknownDurationCount) &&
    count(m.workAmountMinor) &&
    count(m.totalMinor) &&
    m.partnerAmountMinor + m.workAmountMinor === m.totalMinor
  )
}

/**
 * Strict shape check: an unknown or inconsistent response is rejected, never
 * rendered. Money is never recomputed here; the sums below are only a sanity
 * check that the server's own figures agree with each other.
 */
export function validDistributionSimulation(value: unknown): value is DistributionSimulation {
  const o = obj(value)
  if (!o || o.simulation !== true || o.persisted !== false || o.currency !== 'MXN') return false
  const period = obj(o.period)
  const base = obj(o.financialBase)
  const rule = obj(o.rule)
  const pools = obj(o.pools)
  const totals = obj(o.totals)
  if (!period || !base || !rule || !pools || !totals) return false
  if (
    !text(period.from) ||
    !text(period.to) ||
    !text(period.fromInstant) ||
    !text(period.toInstant) ||
    period.utcOffsetMinutes !== -360 ||
    !text(period.interval)
  )
    return false
  if (
    !int(base.potentiallyAvailableMinor) ||
    !count(base.requestedAmountMinor) ||
    !int(base.remainingAvailableMinor) ||
    (base.status !== 'complete' && base.status !== 'partial')
  )
    return false
  if (
    !count(rule.partnerShareBps) ||
    !count(rule.workShareBps) ||
    rule.partnerShareBps + rule.workShareBps !== BPS_TOTAL ||
    (rule.workBasis !== 'WORK_SHIFTS' && rule.workBasis !== 'KNOWN_MINUTES') ||
    rule.partnerMode !== 'EQUAL'
  )
    return false
  if (!count(pools.partnerPoolMinor) || !count(pools.workPoolMinor)) return false
  if (!count(totals.distributedMinor) || !count(totals.undistributedMinor)) return false
  if (!Array.isArray(o.members) || !o.members.every(validMember)) return false
  if (
    !Array.isArray(o.warnings) ||
    !o.warnings.every((w) => {
      const x = obj(w)
      return !!x && text(x.code) && text(x.message)
    })
  )
    return false
  const members = o.members as { totalMinor: number }[]
  const requested = base.requestedAmountMinor
  return (
    pools.partnerPoolMinor + pools.workPoolMinor === requested &&
    totals.distributedMinor + totals.undistributedMinor === requested &&
    members.reduce((sum, m) => sum + m.totalMinor, 0) === totals.distributedMinor
  )
}

export const FinanceDistributionService = {
  /**
   * POST /finance/distribution-simulations — socio only, pure (persists
   * nothing, answers 200). `to` is EXCLUSIVE. The body is rebuilt field by
   * field so unknown properties (rejected with 400) can never be sent. Auth and
   * member/device headers come from the shared axios interceptor.
   */
  async simulate(request: DistributionSimulationRequest): Promise<DistributionSimulation> {
    const body: DistributionSimulationRequest = {
      from: request.from,
      to: request.to,
      requestedAmountMinor: request.requestedAmountMinor,
      partnerShareBps: request.partnerShareBps,
      workShareBps: request.workShareBps,
      workBasis: request.workBasis,
    }
    const { data } = await api.post<unknown>('/finance/distribution-simulations', body)
    if (!validDistributionSimulation(data)) throw new FinanceDistributionContractError()
    return data
  },
}
