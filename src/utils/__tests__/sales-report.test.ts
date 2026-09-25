import { describe, expect, it } from 'vitest'
import { buildSalesReport, sharePercent, UNKNOWN_SELLER } from '../sales-report'
import type { SalesByMemberReport, SalesByPeriodReport } from '@/types/report.types'
import type { Sale } from '@/types/sale.types'

const FROM = '2026-09-24T06:00:00.000Z'
const TO = '2026-09-25T05:59:59.999Z'
const GENERATED_AT = '2026-09-25T04:00:00.000Z'

let seq = 0
function sale(overrides: Partial<Sale> & { quantities?: number[] } = {}): Sale {
  seq += 1
  const { quantities = [1], ...rest } = overrides
  return {
    id: `sale-${String(seq).padStart(4, '0')}`,
    memberId: 'm-carlos',
    deviceId: 'd-1',
    occurredAt: '2026-09-24T18:00:00.000Z',
    receivedAt: '2026-09-24T18:00:00.000Z',
    currency: 'MXN',
    status: 'completada',
    totalMinor: 1000,
    cashReceivedMinor: 1000,
    changeMinor: 0,
    conflictReason: null,
    conflictDetectedAt: null,
    items: quantities.map((quantity, i) => ({
      id: `item-${seq}-${i}`, productId: `p-${i}`, quantity, unitPriceMinor: 100, subtotalMinor: quantity * 100, createdAt: '2026-09-24T18:00:00.000Z',
    })),
    ...rest,
  }
}

const period = (totalSoldMinor: number, saleCount: number): SalesByPeriodReport => ({ from: FROM, to: TO, totalSoldMinor, saleCount })

const members: SalesByMemberReport = {
  from: FROM,
  to: TO,
  items: [
    { memberId: 'm-ana', memberName: 'Ana', role: 'socio', totalSoldMinor: 0 },
    { memberId: 'm-carlos', memberName: 'Carlos', role: 'colaborador', totalSoldMinor: 0 },
  ],
}

function build(sales: Sale[], overrides: Partial<Parameters<typeof buildSalesReport>[0]> = {}) {
  const total = sales.reduce((sum, s) => sum + (s.totalMinor ?? 0), 0)
  return buildSalesReport({
    period: period(total, sales.length),
    byMember: members,
    sales,
    businessName: 'La Marchanta',
    generatedAt: GENERATED_AT,
    ...overrides,
  })
}

describe('buildSalesReport — rows', () => {
  it('maps each sale to a row with seller name, article count and amounts', () => {
    const s = sale({ memberId: 'm-ana', totalMinor: 125000, cashReceivedMinor: 150000, changeMinor: 25000, quantities: [2, 3, 1] })
    const report = build([s])
    expect(report.rows).toEqual([{
      id: s.id,
      receivedAt: s.receivedAt,
      memberId: 'm-ana',
      sellerName: 'Ana',
      articleCount: 6,
      totalMinor: 125000,
      cashReceivedMinor: 150000,
      changeMinor: 25000,
    }])
  })

  it('orders rows chronologically ascending (oldest first), ties by id', () => {
    const late = sale({ receivedAt: '2026-09-24T22:00:00.000Z' })
    const early = sale({ receivedAt: '2026-09-24T07:00:00.000Z' })
    const tieB = sale({ id: 'zzz', receivedAt: '2026-09-24T12:00:00.000Z' })
    const tieA = sale({ id: 'aaa', receivedAt: '2026-09-24T12:00:00.000Z' })
    const report = build([late, tieB, early, tieA])
    expect(report.rows.map((r) => r.id)).toEqual([early.id, 'aaa', 'zzz', late.id])
  })

  it('names an unknown seller "Sin nombre" and does not lose the sale', () => {
    const report = build([sale({ memberId: 'm-ghost', totalMinor: 500 })])
    expect(report.rows[0].sellerName).toBe(UNKNOWN_SELLER)
    expect(UNKNOWN_SELLER).toBe('Sin nombre')
    expect(report.people).toEqual([expect.objectContaining({ memberId: 'm-ghost', name: 'Sin nombre', role: null, totalMinor: 500 })])
  })

  it('falls back to "Sin nombre" when the member report has a null name', () => {
    const byMember: SalesByMemberReport = { from: FROM, to: TO, items: [{ memberId: 'm-x', memberName: null, role: null, totalSoldMinor: 0 }] }
    const report = build([sale({ memberId: 'm-x' })], { byMember })
    expect(report.rows[0].sellerName).toBe('Sin nombre')
  })

  it('treats a null total or change (should not happen for completed sales) as 0', () => {
    const report = build([sale({ totalMinor: null, changeMinor: null, cashReceivedMinor: 0 })])
    expect(report.rows[0]).toMatchObject({ totalMinor: 0, changeMinor: 0 })
  })
})

describe('buildSalesReport — totals in minor units', () => {
  it('sums exactly, even with awkward and very large amounts', () => {
    const sales = [
      sale({ totalMinor: 1, cashReceivedMinor: 1 }),
      sale({ totalMinor: 10, cashReceivedMinor: 20, changeMinor: 10 }),
      sale({ totalMinor: 33333, cashReceivedMinor: 40000, changeMinor: 6667 }),
      sale({ totalMinor: 2147483647, cashReceivedMinor: 2147483647 }),
      sale({ totalMinor: 2147483647, cashReceivedMinor: 2147483647 }),
    ]
    const report = build(sales)
    expect(report.totals.totalMinor).toBe(1 + 10 + 33333 + 2 * 2147483647)
    expect(report.totals.cashReceivedMinor).toBe(1 + 20 + 40000 + 2 * 2147483647)
    expect(report.totals.changeMinor).toBe(10 + 6667)
    expect(report.totals.saleCount).toBe(5)
    expect(Number.isInteger(report.totals.totalMinor)).toBe(true)
  })

  it('counts the articles of every sale', () => {
    const report = build([sale({ quantities: [2, 2] }), sale({ quantities: [5] })])
    expect(report.totals.articleCount).toBe(9)
  })

  it('an empty list builds an empty, consistent report without crashing', () => {
    const report = build([])
    expect(report.rows).toEqual([])
    expect(report.people).toEqual([])
    expect(report.totals).toEqual({ saleCount: 0, articleCount: 0, totalMinor: 0, cashReceivedMinor: 0, changeMinor: 0 })
    expect(report.consistency.ok).toBe(true)
  })
})

describe('buildSalesReport — per person', () => {
  it('groups by member, sums in minor units and sorts by total descending', () => {
    const report = build([
      sale({ memberId: 'm-carlos', totalMinor: 10000 }),
      sale({ memberId: 'm-ana', totalMinor: 30000 }),
      sale({ memberId: 'm-carlos', totalMinor: 5000 }),
    ])
    expect(report.people).toEqual([
      { memberId: 'm-ana', name: 'Ana', role: 'socio', saleCount: 1, totalMinor: 30000, sharePercent: 66.7 },
      { memberId: 'm-carlos', name: 'Carlos', role: 'colaborador', saleCount: 2, totalMinor: 15000, sharePercent: 33.3 },
    ])
  })

  it('breaks ties by name', () => {
    const report = build([
      sale({ memberId: 'm-carlos', totalMinor: 1000 }),
      sale({ memberId: 'm-ana', totalMinor: 1000 }),
    ])
    expect(report.people.map((p) => p.name)).toEqual(['Ana', 'Carlos'])
  })

  it('does not list people without sales in the detail', () => {
    const report = build([sale({ memberId: 'm-ana' })])
    expect(report.people.map((p) => p.memberId)).toEqual(['m-ana'])
  })
})

describe('sharePercent', () => {
  it('rounds to one decimal using integers only', () => {
    expect(sharePercent(1, 3)).toBe(33.3)
    expect(sharePercent(2, 3)).toBe(66.7)
    expect(sharePercent(1, 1)).toBe(100)
    expect(sharePercent(0, 500)).toBe(0)
  })

  it('is 0 when the whole is 0', () => {
    expect(sharePercent(0, 0)).toBe(0)
  })
})

describe('buildSalesReport — consistency with the period report', () => {
  it('is ok when rows match the report total and count', () => {
    const report = build([sale({ totalMinor: 700 }), sale({ totalMinor: 300 })])
    expect(report.consistency).toEqual({ ok: true, reportTotalMinor: 1000, rowsTotalMinor: 1000, reportCount: 2, rowsCount: 2 })
  })

  it('flags a total mismatch (sales arrived while collecting)', () => {
    const report = build([sale({ totalMinor: 700 })], { period: period(1000, 1) })
    expect(report.consistency).toEqual({ ok: false, reportTotalMinor: 1000, rowsTotalMinor: 700, reportCount: 1, rowsCount: 1 })
  })

  it('flags a count mismatch even when the totals happen to match', () => {
    const report = build([sale({ totalMinor: 1000 })], { period: period(1000, 2) })
    expect(report.consistency.ok).toBe(false)
    expect(report.consistency).toMatchObject({ reportCount: 2, rowsCount: 1 })
  })
})

describe('buildSalesReport — header data', () => {
  it('carries business name, generation time and the range as instants and business days', () => {
    const report = build([])
    expect(report.businessName).toBe('La Marchanta')
    expect(report.generatedAt).toBe(GENERATED_AT)
    expect(report.range).toEqual({ from: FROM, to: TO, fromDay: '2026-09-24', toDay: '2026-09-24' })
  })

  it('a multi-day range gives its first and last business day', () => {
    const report = build([], { period: { from: '2026-09-20T06:00:00.000Z', to: '2026-09-27T05:59:59.999Z', totalSoldMinor: 0, saleCount: 0 } })
    expect(report.range).toMatchObject({ fromDay: '2026-09-20', toDay: '2026-09-26' })
  })

  it('propagates the truncated flag (default false)', () => {
    expect(build([]).truncated).toBe(false)
    expect(build([], { truncated: true }).truncated).toBe(true)
  })
})
