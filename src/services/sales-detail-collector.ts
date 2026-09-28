import ReportsService from './reports.service'
import type { SalesDetailQuery, SalesDetailResponse, SalesDetailRow, SalesDetailTotals } from '@/types/report.types'

/** `limit` máximo de GET /reports/sales-detail (contrato §9: 1..100, def. 20). */
export const SALES_DETAIL_PAGE_SIZE = 100
/**
 * 100 páginas de 100 = 10,000 filas (producto, vendedor): mismo orden de
 * magnitud que el tope de `sales-report-collector.ts` para GET /sales
 * (100 páginas / 10,000 ventas) — tope de seguridad contra una descarga
 * interminable, nunca un ciclo sin límite.
 */
export const DEFAULT_MAX_PAGES = 100

export interface CollectedSalesDetail {
  /** Filas `(productId, memberId)` del periodo completo, en el orden que devuelve la API. */
  rows: SalesDetailRow[]
  /** Del periodo completo (igual en cualquier página): se toma de la primera respuesta, sin recalcular nada. */
  totals: SalesDetailTotals
  /** `true` si se llegó al tope de páginas sin terminar de recorrer el periodo. */
  truncated: boolean
  pagesFetched: number
}

export interface CollectSalesDetailOptions {
  /** Inyectable para pruebas; por defecto `ReportsService.getSalesDetail`. */
  getSalesDetail?: (query: SalesDetailQuery) => Promise<SalesDetailResponse>
  pageSize?: number
  maxPages?: number
}

const EMPTY_TOTALS: SalesDetailTotals = { ingresoMinor: 0, gananciaMinor: 0, lineasSinCosto: 0 }

/**
 * Reúne TODAS las filas de GET /reports/sales-detail de un periodo: a
 * diferencia de sales-by-period/sales-by-member, este reporte pagina (máx.
 * `limit: 100`), pero un reporte exportable (PDF/Excel) o el desglose en
 * pantalla necesitan el periodo completo. A diferencia de
 * `collectSalesInRange` (GET /sales), este endpoint SÍ filtra por fecha en el
 * servidor, así que no hace falta detectar el límite del rango: solo se
 * pagina hasta agotar las filas o llegar al tope de páginas.
 *
 * `totals` representa siempre el periodo COMPLETO (no la página actual, regla
 * distinta a la de cada fila — ver contrato §9), así que se toma tal cual de
 * la primera respuesta.
 */
export async function collectSalesDetail(
  range: { from: string; to: string },
  options: CollectSalesDetailOptions = {},
): Promise<CollectedSalesDetail> {
  const getSalesDetail = options.getSalesDetail ?? ((query: SalesDetailQuery) => ReportsService.getSalesDetail(query))
  const pageSize = options.pageSize ?? SALES_DETAIL_PAGE_SIZE
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES

  const rows: SalesDetailRow[] = []
  let totals: SalesDetailTotals = EMPTY_TOTALS
  let pagesFetched = 0

  while (pagesFetched < maxPages) {
    const page = pagesFetched + 1
    const response = await getSalesDetail({ from: range.from, to: range.to, page, limit: pageSize })
    if (page === 1) totals = response.totals
    rows.push(...response.items)
    pagesFetched = page

    const exhausted = response.items.length < pageSize || page * pageSize >= response.total
    if (exhausted) return { rows, totals, truncated: false, pagesFetched }
  }

  return { rows, totals, truncated: true, pagesFetched }
}
