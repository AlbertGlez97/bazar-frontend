import { describe, expect, it } from 'vitest'
import {
  buildSalesReport,
  formatDayRange,
  gananciaCellText,
  GANANCIA_NO_DISPONIBLE,
  profitPartialNote,
  rangeDescription,
  reportNotes,
  roleLabel,
  sharePercent,
  UNKNOWN_SELLER,
} from '../sales-report'
import type { AbonoRecibidoRow, DeudaLiquidadaRow, SalesByMemberReport, SalesByPeriodReport, SalesDetailRow, SalesDetailTotals } from '@/types/report.types'
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

const period = (
  totalSoldMinor: number,
  saleCount: number,
  extra: { abonosRecibidos?: AbonoRecibidoRow[]; deudasLiquidadas?: DeudaLiquidadaRow[] } = {},
): SalesByPeriodReport => {
  const abonosRecibidos = extra.abonosRecibidos ?? []
  const abonosRecibidosMinor = abonosRecibidos.reduce((sum, a) => sum + a.montoMinor, 0)
  return {
    from: FROM, to: TO, totalSoldMinor, saleCount,
    abonosRecibidos, abonosRecibidosMinor,
    deudasLiquidadas: extra.deudasLiquidadas ?? [],
    totalIngresadoMinor: totalSoldMinor + abonosRecibidosMinor,
  }
}

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

// BE-15: sales-by-period trae abonos/deudas liquidadas y el total combinado
// del periodo; buildSalesReport los pasa TAL CUAL (ya vienen agregados del
// servidor, no hay nada que recalcular aquí, a diferencia de `rows`/`people`).
describe('buildSalesReport — abonos/deudas liquidadas (BE-15, pass-through)', () => {
  it('pasa abonosRecibidos, abonosRecibidosMinor, deudasLiquidadas y totalIngresadoMinor tal cual del período', () => {
    const abonosRecibidos: AbonoRecibidoRow[] = [{ fecha: '2026-09-22T15:30:00.000Z', deudor: 'Lucía', montoMinor: 20000, type: 'apartado' }]
    const deudasLiquidadas: DeudaLiquidadaRow[] = [{ id: 'd-1', type: 'fiado', deudor: 'Carlos', totalMinor: 65000, saldadaAt: '2026-09-23T13:00:00.000Z', gananciaMinor: 15000, gananciaDisponible: true }]
    const report = build([], { period: period(0, 0, { abonosRecibidos, deudasLiquidadas }) })

    expect(report.abonosRecibidos).toEqual(abonosRecibidos)
    expect(report.abonosRecibidosMinor).toBe(20000)
    expect(report.deudasLiquidadas).toEqual(deudasLiquidadas)
    expect(report.totalIngresadoMinor).toBe(20000)
  })

  it('sin abonos ni deudas liquidadas, quedan vacíos y el total combinado es solo lo vendido', () => {
    const s = sale({ totalMinor: 5000 })
    const report = build([s])
    expect(report.abonosRecibidos).toEqual([])
    expect(report.deudasLiquidadas).toEqual([])
    expect(report.totalIngresadoMinor).toBe(5000)
  })
})

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

  it('adds up amounts that drift in floating-point pesos: ten sales of $0.10 are exactly $1.00 (500 - 299.50 = 200.50 per change)', () => {
    const tenCents = Array.from({ length: 10 }, () => sale({ totalMinor: 10, cashReceivedMinor: 10 }))
    const report = build([
      ...tenCents,
      sale({ memberId: 'm-ana', totalMinor: 29950, cashReceivedMinor: 50000, changeMinor: 20050 }),
    ])

    expect(report.totals.totalMinor).toBe(100 + 29950)
    expect(report.totals.changeMinor).toBe(20050)
    const carlos = report.people.find((p) => p.memberId === 'm-carlos')
    expect(carlos?.totalMinor).toBe(100)
    expect(carlos?.saleCount).toBe(10)
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

describe('rangeDescription and reportNotes (shared by PDF and Excel)', () => {
  it('describes a single day and a multi-day range in business dates', () => {
    expect(rangeDescription(build([]))).toBe('24/09/2026')
    const week = build([], { period: {
      from: '2026-09-20T06:00:00.000Z', to: '2026-09-27T05:59:59.999Z', totalSoldMinor: 0, saleCount: 0,
      abonosRecibidos: [], abonosRecibidosMinor: 0, deudasLiquidadas: [], totalIngresadoMinor: 0,
    } })
    expect(rangeDescription(week)).toBe('20/09/2026 al 26/09/2026')
  })

  it('formatDayRange writes one date for one day and "del … al …" for several', () => {
    expect(formatDayRange('2026-09-24', '2026-09-24')).toBe('24/09/2026')
    expect(formatDayRange('2026-09-01', '2026-09-24')).toBe('01/09/2026 al 24/09/2026')
  })

  it('has no notes for a whole, consistent report', () => {
    expect(reportNotes(build([sale({ totalMinor: 700 })]))).toEqual([])
  })

  it('warns when the detail was cut at the page cap', () => {
    const notes = reportNotes(build([], { truncated: true }))
    expect(notes).toHaveLength(1)
    expect(notes[0]).toContain('límite de ventas')
  })

  it('warns when detail and period report disagree, with both figures', () => {
    const notes = reportNotes(build([sale({ totalMinor: 700 })], { period: period(1000, 2) }))
    expect(notes).toHaveLength(1)
    expect(notes[0]).toContain('no coincide con el reporte del periodo')
    expect(notes[0]).toContain('1 venta, $7.00')
    expect(notes[0]).toContain('2 ventas, $10.00')
  })
})

describe('roleLabel', () => {
  it('gives the Spanish label of each role, and a dash when unknown', () => {
    expect(roleLabel('socio')).toBe('Socio')
    expect(roleLabel('colaborador')).toBe('Colaborador')
    expect(roleLabel(null)).toBe('—')
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

describe('buildSalesReport — detail (D4: real profit by product/member)', () => {
  const detailRows: SalesDetailRow[] = [
    {
      productId: 'p1', productName: 'Reloj', memberId: 'm-carlos', memberName: 'Carlos',
      units: 2, ingresoMinor: 1000, costoMinor: 400, gananciaMinor: 600, gananciaDisponible: true,
    },
    {
      productId: 'p2', productName: 'Pulsera', memberId: 'm-x', memberName: null,
      units: 1, ingresoMinor: 200, costoMinor: null, gananciaMinor: null, gananciaDisponible: false,
    },
  ]
  const detailTotals: SalesDetailTotals = { ingresoMinor: 1200, gananciaMinor: 600, lineasSinCosto: 1 }

  it('is undefined when no detail was given (existing reports keep working)', () => {
    expect(build([]).detail).toBeUndefined()
  })

  it('maps detail rows, resolving the name and dropping costoMinor (unused in the report model)', () => {
    const report = build([], { detail: { rows: detailRows, totals: detailTotals } })
    expect(report.detail).toEqual({
      rows: [
        { productId: 'p1', productName: 'Reloj', memberId: 'm-carlos', memberName: 'Carlos', units: 2, ingresoMinor: 1000, gananciaMinor: 600, gananciaDisponible: true },
        { productId: 'p2', productName: 'Pulsera', memberId: 'm-x', memberName: 'Sin nombre', units: 1, ingresoMinor: 200, gananciaMinor: null, gananciaDisponible: false },
      ],
      totals: detailTotals,
    })
  })
})

describe('gananciaCellText', () => {
  it('formats the money when the profit is available', () => {
    expect(gananciaCellText({ gananciaMinor: 600, gananciaDisponible: true })).toBe('$6.00')
  })

  it('a real $0 profit still prints $0.00 (it is a known value, not a gap)', () => {
    expect(gananciaCellText({ gananciaMinor: 0, gananciaDisponible: true })).toBe('$0.00')
  })

  it('never prints $0.00 for an unavailable profit — says "No disponible"', () => {
    expect(gananciaCellText({ gananciaMinor: null, gananciaDisponible: false })).toBe(GANANCIA_NO_DISPONIBLE)
    expect(GANANCIA_NO_DISPONIBLE).toBe('No disponible')
  })
})

describe('profitPartialNote', () => {
  it('is null when every line of the period has its cost', () => {
    expect(profitPartialNote(0)).toBeNull()
  })

  it('states the exact gap, singular and plural', () => {
    expect(profitPartialNote(1)).toBe(
      'Ganancia calculada solo sobre las ventas con costo registrado — 1 venta sin costo capturado no se incluyen en el total.',
    )
    expect(profitPartialNote(3)).toBe(
      'Ganancia calculada solo sobre las ventas con costo registrado — 3 ventas sin costo capturado no se incluyen en el total.',
    )
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
    const report = build([], { period: {
      from: '2026-09-20T06:00:00.000Z', to: '2026-09-27T05:59:59.999Z', totalSoldMinor: 0, saleCount: 0,
      abonosRecibidos: [], abonosRecibidosMinor: 0, deudasLiquidadas: [], totalIngresadoMinor: 0,
    } })
    expect(report.range).toMatchObject({ fromDay: '2026-09-20', toDay: '2026-09-26' })
  })

  it('propagates the truncated flag (default false)', () => {
    expect(build([]).truncated).toBe(false)
    expect(build([], { truncated: true }).truncated).toBe(true)
  })
})
