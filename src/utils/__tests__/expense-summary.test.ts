import { describe, expect, it } from 'vitest'
import { localExpenseSummary, type SummaryRow } from '../expense-summary'

const row = (over: Partial<SummaryRow> = {}): SummaryRow => ({
  amountMinor: 1000,
  nature: 'OPERATING_EXPENSE',
  fundsSource: 'BUSINESS',
  occurredAt: '2026-10-03T06:00:00Z',
  reversed: false,
  correctionQueued: false,
  uncertain: false,
  ...over,
})

describe('local expense summary', () => {
  it('splits by nature and by funds source over the same expenses', () => {
    const total = localExpenseSummary(
      [
        row({ amountMinor: 1000 }),
        row({ amountMinor: 2500, nature: 'INVENTORY_PURCHASE', fundsSource: 'PERSONAL' }),
        row({ amountMinor: 400, fundsSource: 'PERSONAL' }),
      ],
      '2026-10-01',
      '2026-10-31',
    )
    expect(total).toEqual({
      operatingMinor: 1400,
      inventoryMinor: 2500,
      personalMinor: 2900,
      businessMinor: 1000,
    })
  })

  it('excludes annulled expenses and ones with a queued correction', () => {
    const total = localExpenseSummary(
      [row({ reversed: true }), row({ correctionQueued: true }), row({ amountMinor: 50 })],
      '2026-10-01',
      '2026-10-31',
    )
    expect(total?.operatingMinor).toBe(50)
  })

  it('only counts business days inside the inclusive period', () => {
    const total = localExpenseSummary(
      [
        row({ occurredAt: '2026-10-03T06:00:00Z' }), // 2026-10-03 00:00 in UTC-6
        row({ occurredAt: '2026-10-03T05:59:00Z' }), // 2026-10-02 23:59
        row({ occurredAt: '2026-10-04T05:59:00Z' }), // 2026-10-03 23:59
        row({ occurredAt: '2026-10-04T06:00:00Z' }), // 2026-10-04
      ],
      '2026-10-03',
      '2026-10-03',
    )
    expect(total?.operatingMinor).toBe(2000)
  })

  it('is unavailable when a record in the period is uncertain, but ignores one outside it', () => {
    expect(localExpenseSummary([row({ uncertain: true })], '2026-10-01', '2026-10-31')).toBeNull()
    expect(
      localExpenseSummary(
        [row({ uncertain: true, occurredAt: '2026-09-03T06:00:00Z' })],
        '2026-10-01',
        '2026-10-31',
      ),
    ).not.toBeNull()
  })
})
