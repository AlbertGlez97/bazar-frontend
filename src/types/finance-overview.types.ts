/**
 * GET /finance/overview (socio only). Server-confirmed, recorded inputs only:
 * it is NOT a cash balance, withdrawable profit or a partner distribution.
 * Money is integer MXN cents and may be negative. Source of truth:
 * bazar-api/doc/finance-overview-reserves.md.
 */
export type OverviewStatus = 'complete' | 'partial'

export interface FinanceOverviewWarning {
  code: string
  message: string
}

export interface FinanceOverview {
  currency: 'MXN'
  period: {
    from: string
    /** Exclusive end: the interval is `[from,to)`. */
    to: string
    fromInstant: string
    toInstant: string
    utcOffsetMinutes: number
    interval: string
  }
  timeBasis: Record<string, string>
  sales: {
    saleCount: number
    salesMinor: number
    recordedCostMinor: number
    recordedGrossMarginMinor: number
  }
  costCoverage: {
    status: OverviewStatus
    totalLineCount: number
    knownCostLineCount: number
    missingCostLineCount: number
    missingCostUnitCount: number
    salesWithoutCostMinor: number
    /** 0-100 (unrounded) or null when there are no sale lines. */
    knownCostLinePercentage: number | null
  }
  expenses: {
    operatingMinor: number
    inventoryPurchasesMinor: number
  }
  contributions: {
    amountMinor: number
    count: number
  }
  /** Non-monetary. */
  workShifts: {
    shiftCount: number
    knownMinutes: number
    unknownDurationCount: number
  }
  reserves: {
    activeCount: number
    plannedMinor: number
    matching: string
  }
  result: {
    recordedOperatingResultMinor: number
    potentiallyAvailableMinor: number
    status: OverviewStatus
    isCashBalance: false
    isWithdrawableProfit: false
  }
  sync: {
    source: string
    localPendingIncluded: false
  }
  warnings: FinanceOverviewWarning[]
  /** UTC ISO timestamp of this response (not an offline watermark). */
  generatedAt: string
}
