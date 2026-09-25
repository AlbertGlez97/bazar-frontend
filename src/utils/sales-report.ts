import { businessDayOf, formatDateKey } from './business-time'
import { formatMinorMoney } from './money'
import type {
  SalesByMemberReport,
  SalesByPeriodReport,
  SalesReport,
  SalesReportPerson,
  SalesReportRow,
  SalesReportTotals,
} from '@/types/report.types'
import type { MemberRole } from '@/types/member.types'
import type { Sale } from '@/types/sale.types'

/** Nombre que se imprime cuando el vendedor no se puede resolver. */
export const UNKNOWN_SELLER = 'Sin nombre'

/** `1 venta` / `2 ventas`. */
export const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/** Periodo en días de negocio: `24/09/2026` o `20/09/2026 al 26/09/2026`. */
export function formatDayRange(fromDay: string, toDay: string): string {
  return fromDay === toDay
    ? formatDateKey(fromDay)
    : `${formatDateKey(fromDay)} al ${formatDateKey(toDay)}`
}

/** El periodo de un reporte armado, para títulos y encabezados de los archivos. */
export function rangeDescription(report: SalesReport): string {
  return formatDayRange(report.range.fromDay, report.range.toDay)
}

/**
 * Avisos que van impresos en los archivos (PDF y Excel): detalle cortado en el
 * tope de páginas y detalle que no cuadra con el reporte del periodo. Vacío
 * cuando todo cuadra: un archivo sano no lleva notas.
 */
export function reportNotes(report: SalesReport): string[] {
  const notes: string[] = []
  const { consistency } = report
  if (report.truncated) {
    notes.push(
      'Este archivo llegó al límite de ventas que se pueden incluir y puede estar incompleto. '
      + 'Descarga un periodo más corto para tener todo el detalle.',
    )
  }
  if (!consistency.ok) {
    notes.push(
      `El detalle de este archivo (${plural(consistency.rowsCount, 'venta', 'ventas')}, ${formatMinorMoney(consistency.rowsTotalMinor)}) `
      + `no coincide con el reporte del periodo (${plural(consistency.reportCount, 'venta', 'ventas')}, ${formatMinorMoney(consistency.reportTotalMinor)}). `
      + 'Es normal si se registraron ventas mientras se preparaba; vuelve a descargarlo para tener las cifras al día.',
    )
  }
  return notes
}

/** Rol en español para tablas y archivos. */
export function roleLabel(role: MemberRole | null): string {
  if (role === 'socio') return 'Socio'
  if (role === 'colaborador') return 'Colaborador'
  return '—'
}

export interface BuildSalesReportInput {
  /** Reporte de sales-by-period del rango (extremos normalizados y totales oficiales). */
  period: SalesByPeriodReport
  /** Reporte de sales-by-member del mismo rango: de aquí salen nombre y rol. */
  byMember: SalesByMemberReport
  /** Detalle de ventas completadas del rango (ver `collectSalesInRange`). */
  sales: Sale[]
  businessName: string
  /** Instante ISO de generación. */
  generatedAt: string
  /** `true` si el detalle se cortó en el tope de páginas. */
  truncated?: boolean
}

/**
 * Porcentaje con un decimal calculado con enteros (`parte * 1000 / total`), sin
 * sumar ni comparar pesos flotantes. 0 si el total es 0.
 */
export function sharePercent(part: number, whole: number): number {
  if (whole <= 0) return 0
  return Math.round((part * 1000) / whole) / 10
}

/**
 * Arma el modelo único que consumen el PDF y el Excel. Todo el dinero se suma en
 * centavos enteros a partir de las filas del detalle; nada se convierte a pesos
 * aquí. `consistency` compara esa suma con el reporte por periodo: si difieren
 * (por ejemplo, entraron ventas mientras se descargaba), la UI lo avisa en vez
 * de imprimir cifras que no cuadran en silencio.
 */
export function buildSalesReport(input: BuildSalesReportInput): SalesReport {
  const { period, byMember, sales, businessName, generatedAt, truncated = false } = input

  const known = new Map<string, { name: string; role: MemberRole | null }>()
  for (const item of byMember.items) {
    known.set(item.memberId, { name: item.memberName?.trim() || UNKNOWN_SELLER, role: item.role })
  }

  const rows: SalesReportRow[] = sales
    .map((sale) => ({
      id: sale.id,
      receivedAt: sale.receivedAt,
      memberId: sale.memberId,
      sellerName: known.get(sale.memberId)?.name ?? UNKNOWN_SELLER,
      articleCount: sale.items.reduce((sum, item) => sum + item.quantity, 0),
      totalMinor: sale.totalMinor ?? 0,
      cashReceivedMinor: sale.cashReceivedMinor,
      changeMinor: sale.changeMinor ?? 0,
    }))
    .sort((a, b) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt) || a.id.localeCompare(b.id))

  const totals: SalesReportTotals = rows.reduce(
    (acc, row) => ({
      saleCount: acc.saleCount + 1,
      articleCount: acc.articleCount + row.articleCount,
      totalMinor: acc.totalMinor + row.totalMinor,
      cashReceivedMinor: acc.cashReceivedMinor + row.cashReceivedMinor,
      changeMinor: acc.changeMinor + row.changeMinor,
    }),
    { saleCount: 0, articleCount: 0, totalMinor: 0, cashReceivedMinor: 0, changeMinor: 0 },
  )

  const perMember = new Map<string, { saleCount: number; totalMinor: number }>()
  for (const row of rows) {
    const acc = perMember.get(row.memberId) ?? { saleCount: 0, totalMinor: 0 }
    acc.saleCount += 1
    acc.totalMinor += row.totalMinor
    perMember.set(row.memberId, acc)
  }
  const people: SalesReportPerson[] = [...perMember.entries()]
    .map(([memberId, acc]) => ({
      memberId,
      name: known.get(memberId)?.name ?? UNKNOWN_SELLER,
      role: known.get(memberId)?.role ?? null,
      saleCount: acc.saleCount,
      totalMinor: acc.totalMinor,
      sharePercent: sharePercent(acc.totalMinor, totals.totalMinor),
    }))
    .sort((a, b) => b.totalMinor - a.totalMinor || a.name.localeCompare(b.name, 'es'))

  return {
    businessName,
    generatedAt,
    range: {
      from: period.from,
      to: period.to,
      fromDay: businessDayOf(period.from),
      toDay: businessDayOf(period.to),
    },
    rows,
    people,
    totals,
    consistency: {
      ok: period.totalSoldMinor === totals.totalMinor && period.saleCount === totals.saleCount,
      reportTotalMinor: period.totalSoldMinor,
      rowsTotalMinor: totals.totalMinor,
      reportCount: period.saleCount,
      rowsCount: totals.saleCount,
    },
    truncated,
  }
}
