import { businessDayOf } from '@/utils/business-time'
import type { ExpenseSummary } from '@/types/expense.types'
import type { ExpenseNature, FundsSource } from '@/types/expense.types'

export interface SummaryRow {
  amountMinor: number
  nature: ExpenseNature
  fundsSource: FundsSource
  occurredAt: string
  /** Confirmed reversal (annulled or corrected): excluded, like the server does. */
  reversed: boolean
  /** A queued, not yet confirmed correction: the user already annulled it. */
  correctionQueued: boolean
  /** Sync trouble: the figure for this row cannot be trusted. */
  uncertain: boolean
}

/**
 * Totals from this device's records for a business-day period (inclusive).
 * Returns `null` when any record in the period is uncertain (needs review or
 * paused): showing totals that might be wrong would be worse than showing none.
 */
export function localExpenseSummary(
  rows: readonly SummaryRow[],
  from: string,
  to: string,
): ExpenseSummary | null {
  const inPeriod = rows.filter((r) => {
    const day = businessDayOf(r.occurredAt)
    return day >= from && day <= to
  })
  if (inPeriod.some((r) => r.uncertain)) return null
  const total: ExpenseSummary = {
    operatingMinor: 0,
    inventoryMinor: 0,
    personalMinor: 0,
    businessMinor: 0,
  }
  for (const r of inPeriod) {
    if (r.reversed || r.correctionQueued) continue
    if (r.nature === 'OPERATING_EXPENSE') total.operatingMinor += r.amountMinor
    else total.inventoryMinor += r.amountMinor
    if (r.fundsSource === 'PERSONAL') total.personalMinor += r.amountMinor
    else total.businessMinor += r.amountMinor
  }
  return total
}
