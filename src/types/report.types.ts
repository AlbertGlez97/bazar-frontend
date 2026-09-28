// Contrato real de bazar-api para el módulo Reports (doc/api-contract-for-
// frontend.md §9). Solo socios. Dinero en centavos MXN (enteros). Solo cuentan
// ventas `completada`, ancladas a `receivedAt` (reloj del servidor).
import type { MemberRole } from './member.types'

/** Query de ambos reportes: `from` y `to` son OBLIGATORIOS. */
export interface ReportRangeParams {
  /** `YYYY-MM-DD` (día de negocio, UTC-6 fijo, inclusivo) o instante ISO 8601 completo. */
  from: string
  to: string
}

/** GET /reports/sales-by-period. `from`/`to` vuelven normalizados como instantes UTC. */
export interface SalesByPeriodReport {
  from: string
  to: string
  totalSoldMinor: number
  saleCount: number
}

export interface SalesByMemberItem {
  memberId: string
  /** `null` solo si el Member ya no se pudiera resolver (en la práctica siempre viene). */
  memberName: string | null
  role: MemberRole | null
  totalSoldMinor: number
}

/** GET /reports/sales-by-member. Ordenado por `totalSoldMinor` descendente; sin paginación. */
export interface SalesByMemberReport {
  from: string
  to: string
  items: SalesByMemberItem[]
}

// ── Modelo del reporte exportable (lo consumen el PDF y el Excel) ──────────
// Todo el dinero sigue en centavos enteros; la conversión a pesos es lo último
// que ocurre, al escribir cada archivo.

/** Una venta del detalle. */
export interface SalesReportRow {
  id: string
  /** Instante UTC del servidor (ancla del reporte). Los archivos lo muestran en hora de negocio. */
  receivedAt: string
  memberId: string
  sellerName: string
  /** Suma de las cantidades de las partidas. */
  articleCount: number
  totalMinor: number
  cashReceivedMinor: number
  changeMinor: number
}

/** Resumen por persona, calculado desde las filas del detalle. */
export interface SalesReportPerson {
  memberId: string
  name: string
  role: MemberRole | null
  saleCount: number
  totalMinor: number
  /** Porcentaje del total con un decimal (0 si el total es 0). */
  sharePercent: number
}

export interface SalesReportTotals {
  saleCount: number
  articleCount: number
  totalMinor: number
  cashReceivedMinor: number
  changeMinor: number
}

/** Compara lo que sumó el detalle con lo que dijo el reporte por periodo. */
export interface SalesReportConsistency {
  ok: boolean
  reportTotalMinor: number
  rowsTotalMinor: number
  reportCount: number
  rowsCount: number
}

export interface SalesReport {
  businessName: string
  /** Instante ISO en que se armó el reporte. */
  generatedAt: string
  range: {
    /** Extremos normalizados por el servidor (instantes UTC). */
    from: string
    to: string
    /** Los mismos extremos como día de negocio `YYYY-MM-DD`. */
    fromDay: string
    toDay: string
  }
  /** Cronológico ascendente. */
  rows: SalesReportRow[]
  /** De mayor a menor venta. */
  people: SalesReportPerson[]
  totals: SalesReportTotals
  consistency: SalesReportConsistency
  /** `true` si se llegó al tope de páginas y el detalle puede estar incompleto. */
  truncated: boolean
}

// ── GET /dashboard/summary (doc/api-contract-for-frontend.md §"GET
// /api/v1/dashboard/summary"). Resumen de la pantalla de inicio de Gestión.
// Solo socios. "Hoy"/"ayer" los resuelve el servidor con el día de negocio
// UTC-6 actual; no son parámetros.

/** Único query: umbral de stock (inclusive) para "productos con poca existencia". Opcional, default 2 en el servidor. */
export interface DashboardSummaryQuery {
  umbral?: number
}

export interface DashboardMoneyCount {
  totalMinor: number
  count: number
}

export interface DashboardDebtSummary {
  /** Suma del saldo pendiente de toda Deuda `pendiente`. */
  totalMinor: number
  /** Deudores distintos con al menos una deuda pendiente. */
  personas: number
}

export interface DashboardLowStockItem {
  id: string
  name: string
  stock: number
  category: string | null
}

export interface DashboardLowStockSummary {
  umbral: number
  /** Cuántos productos activos tienen `stock <= umbral` (puede ser más que `items.length`). */
  total: number
  /** Hasta 5, ordenados por stock ascendente y luego nombre. */
  items: DashboardLowStockItem[]
}

export interface DashboardSummary {
  ventasHoy: DashboardMoneyCount
  ventasAyer: DashboardMoneyCount
  /** Nunca `null`: `0` si ninguna venta de hoy tiene costo (no es una estimación). */
  gananciaHoyMinor: number
  /** Partidas de ventas de hoy sin `unitCostMinor`. */
  lineasSinCostoHoy: number
  incidenciasPendientes: number
  deudasPendientes: DashboardDebtSummary
  productosPocaExistencia: DashboardLowStockSummary
}
