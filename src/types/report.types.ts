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

/** Un abono real recibido en el periodo (BE-15), de una Deuda activa o ya saldada. */
export interface AbonoRecibidoRow {
  /** ISO 8601, = `Abono.receivedAt`. */
  fecha: string
  deudor: string
  montoMinor: number
  type: 'fiado' | 'apartado'
}

/**
 * Una Deuda liquidada en el periodo (BE-15): `saldadaAt` cae en el rango (no
 * `createdAt`). `gananciaMinor` nunca se estima: `null` cuando `unitCostMinor`
 * de la deuda es `null` (mismo criterio que `sales-detail`).
 */
export interface DeudaLiquidadaRow {
  id: string
  type: 'fiado' | 'apartado'
  deudor: string
  totalMinor: number
  saldadaAt: string
  gananciaMinor: number | null
  gananciaDisponible: boolean
}

/**
 * GET /reports/sales-by-period. `from`/`to` vuelven normalizados como
 * instantes UTC. BE-15 extiende este endpoint (en vez de crear uno nuevo)
 * con dos tablas de deudas y el total combinado.
 */
export interface SalesByPeriodReport {
  from: string
  to: string
  totalSoldMinor: number
  saleCount: number
  /** BE-15. Todo Abono real con `receivedAt` en el periodo. */
  abonosRecibidos: AbonoRecibidoRow[]
  /** BE-15. Suma de `abonosRecibidos[].montoMinor`; `0` si no hubo. */
  abonosRecibidosMinor: number
  /** BE-15. Deudas cuyo `saldadaAt` cae en el periodo. */
  deudasLiquidadas: DeudaLiquidadaRow[]
  /** BE-15. `totalSoldMinor + abonosRecibidosMinor`, ya sumado por el servidor. */
  totalIngresadoMinor: number
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

/** Query de GET /reports/sales-detail: mismo rango + paginación (máx. `limit: 100`, contrato §9). */
export interface SalesDetailQuery extends ReportRangeParams {
  page?: number
  limit?: number
}

/**
 * Una fila de GET /reports/sales-detail: TODAS las partidas del periodo
 * agrupadas por par (producto, vendedor) — no una fila por venta ni por
 * partida individual.
 */
export interface SalesDetailRow {
  productId: string
  productName: string
  /** Quien vendió (socio o colaborador). */
  memberId: string
  memberName: string | null
  /** Suma de `quantity` de todas las partidas del par. */
  units: number
  /** Suma de `subtotalMinor` de todas las partidas del par (siempre presente, no depende del costo). */
  ingresoMinor: number
  /** `null` cuando `gananciaDisponible` es `false`. */
  costoMinor: number | null
  /** `null` cuando `gananciaDisponible` es `false`. */
  gananciaMinor: number | null
  /** `true` solo si TODAS las partidas agrupadas en esta fila tienen `unitCostMinor`. */
  gananciaDisponible: boolean
}

/** `totals` de GET /reports/sales-detail: SIEMPRE del periodo completo, igual en cualquier página. */
export interface SalesDetailTotals {
  /** Suma de `subtotalMinor` de TODAS las partidas del periodo. */
  ingresoMinor: number
  /** Suma de ganancia solo sobre partidas con costo; nunca `null`, `0` (no una estimación) si ninguna lo tiene. */
  gananciaMinor: number
  /** Partidas (`SaleItem`, no filas) del periodo sin `unitCostMinor`. */
  lineasSinCosto: number
}

/**
 * GET /reports/sales-detail. A diferencia de `sales-by-period`/`sales-by-member`,
 * ESTE reporte sí pagina (`page`/`limit`, máx. `limit: 100`) — juntar el
 * periodo completo requiere recorrer todas las páginas (`sales-detail-collector.ts`).
 */
export interface SalesDetailResponse {
  items: SalesDetailRow[]
  /** Filas `(productId, memberId)` del periodo completo (no `SaleItem`). */
  total: number
  page: number
  limit: number
  totals: SalesDetailTotals
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

/** Una fila del desglose por producto y vendedor (D4), con el nombre ya resuelto (nunca `null`). */
export interface SalesReportDetailRow {
  productId: string
  productName: string
  memberId: string
  memberName: string
  units: number
  ingresoMinor: number
  /** `null` cuando `gananciaDisponible` es `false` — nunca se muestra como `0`. */
  gananciaMinor: number | null
  gananciaDisponible: boolean
}

export interface SalesReportDetailTotals {
  ingresoMinor: number
  gananciaMinor: number
  lineasSinCosto: number
}

/**
 * Desglose de ganancia real por producto/vendedor (D4), armado desde
 * `GET /reports/sales-detail`. Opcional: solo está presente cuando se pidió
 * (`buildSalesReport({ detail })`) — un reporte sin este campo se comporta
 * exactamente como antes de D4.
 */
export interface SalesReportDetail {
  rows: SalesReportDetailRow[]
  totals: SalesReportDetailTotals
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
  /** Ver `SalesReportDetail` (D4). `undefined` cuando no se pidió el desglose. */
  detail?: SalesReportDetail
  /**
   * Abonos/deudas liquidadas del periodo (BE-15), tal cual los devuelve
   * `sales-by-period` — a diferencia de `detail`, SIEMPRE presentes (no son
   * opcionales: el endpoint los trae desde que existe BE-15, sin pedirlo aparte).
   */
  abonosRecibidos: AbonoRecibidoRow[]
  abonosRecibidosMinor: number
  deudasLiquidadas: DeudaLiquidadaRow[]
  /** `totalSoldMinor + abonosRecibidosMinor`. */
  totalIngresadoMinor: number
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
