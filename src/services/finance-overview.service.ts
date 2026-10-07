import api from './api'
import type { FinanceOverview } from '@/types/finance-overview.types'

type Rec = Record<string, unknown>
const obj = (v: unknown): Rec | null =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Rec) : null
const int = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v)
const count = (v: unknown) => int(v) && (v as number) >= 0
const status = (v: unknown) => v === 'complete' || v === 'partial'
const ints = (o: Rec | null, keys: string[], nonNegative = false) =>
  !!o && keys.every((k) => (nonNegative ? count(o[k]) : int(o[k])))

/** Strict shape check: an unknown or partial response is rejected, never rendered. */
export function validFinanceOverview(value: unknown): value is FinanceOverview {
  const o = obj(value)
  if (!o || o.currency !== 'MXN') return false
  const period = obj(o.period)
  const sales = obj(o.sales)
  const cov = obj(o.costCoverage)
  const expenses = obj(o.expenses)
  const contributions = obj(o.contributions)
  const shifts = obj(o.workShifts)
  const reserves = obj(o.reserves)
  const result = obj(o.result)
  const sync = obj(o.sync)
  return (
    !!period &&
    typeof period.from === 'string' &&
    typeof period.to === 'string' &&
    !!sales &&
    ints(sales, ['salesMinor', 'recordedCostMinor', 'recordedGrossMarginMinor']) &&
    count(sales.saleCount) &&
    !!cov &&
    status(cov.status) &&
    ints(cov, ['totalLineCount', 'knownCostLineCount', 'missingCostLineCount', 'missingCostUnitCount', 'salesWithoutCostMinor'], true) &&
    (cov.knownCostLinePercentage === null ||
      (typeof cov.knownCostLinePercentage === 'number' &&
        cov.knownCostLinePercentage >= 0 &&
        cov.knownCostLinePercentage <= 100)) &&
    ints(expenses, ['operatingMinor', 'inventoryPurchasesMinor']) &&
    ints(contributions, ['amountMinor']) &&
    count(contributions?.count) &&
    ints(shifts, ['shiftCount', 'knownMinutes', 'unknownDurationCount'], true) &&
    ints(reserves, ['activeCount', 'plannedMinor'], true) &&
    !!result &&
    ints(result, ['recordedOperatingResultMinor', 'potentiallyAvailableMinor']) &&
    status(result.status) &&
    result.isCashBalance === false &&
    result.isWithdrawableProfit === false &&
    !!sync &&
    sync.localPendingIncluded === false &&
    Array.isArray(o.warnings) &&
    o.warnings.every((w) => {
      const x = obj(w)
      return !!x && typeof x.code === 'string' && typeof x.message === 'string'
    }) &&
    typeof o.generatedAt === 'string' &&
    !Number.isNaN(new Date(o.generatedAt).getTime())
  )
}

export const FinanceOverviewService = {
  /**
   * GET /finance/overview — socio only. The server reads `[from,to)`: `to` is
   * EXCLUSIVE, so callers pass the day AFTER the last day to show. Auth and
   * member/device headers come from the shared axios interceptor.
   */
  async get(from: string, toExclusive: string): Promise<FinanceOverview> {
    const { data } = await api.get<unknown>('/finance/overview', {
      params: { from, to: toExclusive },
    })
    if (!validFinanceOverview(data)) throw new Error('Invalid finance overview response')
    return data
  },
}
