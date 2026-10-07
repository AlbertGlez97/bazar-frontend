import type { FinanceOverview } from '@/types/finance-overview.types'

/** Shared test fixture: a complete, valid overview response. */
export const overviewFixture = (over: Partial<FinanceOverview> = {}): FinanceOverview => ({
  currency: 'MXN',
  period: {
    from: '2026-10-01',
    to: '2026-10-08',
    fromInstant: '2026-10-01T06:00:00.000Z',
    toInstant: '2026-10-08T06:00:00.000Z',
    utcOffsetMinutes: -360,
    interval: '[from,to)',
  },
  timeBasis: {
    sales: 'occurredAt',
    expenses: 'occurredAt',
    contributions: 'occurredAt',
    workShifts: 'workDate',
    reserves: 'exactPeriod',
  },
  sales: { saleCount: 3, salesMinor: 100000, recordedCostMinor: 60000, recordedGrossMarginMinor: 40000 },
  costCoverage: {
    status: 'complete',
    totalLineCount: 5,
    knownCostLineCount: 5,
    missingCostLineCount: 0,
    missingCostUnitCount: 0,
    salesWithoutCostMinor: 0,
    knownCostLinePercentage: 100,
  },
  expenses: { operatingMinor: 15000, inventoryPurchasesMinor: 30000 },
  contributions: { amountMinor: 50000, count: 2 },
  workShifts: { shiftCount: 4, knownMinutes: 600, unknownDurationCount: 1 },
  reserves: { activeCount: 0, plannedMinor: 0, matching: 'EXACT_PERIOD' },
  result: {
    recordedOperatingResultMinor: 25000,
    potentiallyAvailableMinor: 25000,
    status: 'complete',
    isCashBalance: false,
    isWithdrawableProfit: false,
  },
  sync: { source: 'SERVER_CONFIRMED', localPendingIncluded: false },
  // RESERVES_PENDING is no longer sent now that reserves are real; the screen still tolerates it.
  warnings: [],
  generatedAt: '2026-10-07T18:00:00.000Z',
  ...over,
})
