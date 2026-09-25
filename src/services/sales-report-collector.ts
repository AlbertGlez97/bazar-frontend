import SalesService from './sales.service'
import type { Sale, SaleListParams, SaleListResponse } from '@/types/sale.types'

/** 100 páginas de 100 = 10,000 ventas: tope de seguridad contra una descarga interminable. */
export const DEFAULT_MAX_PAGES = 100
/** `limit` máximo de GET /sales (contrato §1.5). */
export const SALES_PAGE_SIZE = 100

export interface CollectedSales {
  /** Ventas completadas con `from <= receivedAt <= to`, en el orden en que llegaron (nuevas primero). */
  sales: Sale[]
  /** `true` si se llegó al tope de páginas sin terminar de recorrer el rango. */
  truncated: boolean
  pagesFetched: number
}

export interface CollectOptions {
  /** Inyectable para pruebas; por defecto `SalesService.listSales`. */
  listSales?: (params: SaleListParams) => Promise<SaleListResponse>
  pageSize?: number
  maxPages?: number
}

/**
 * Reúne el detalle de ventas de un rango. GET /sales NO tiene filtro por fecha
 * (solo `status`, `search`, `sort`, `page`, `limit`), así que se pagina de la
 * más nueva a la más vieja y se detiene en cuanto una página alcanza ventas
 * anteriores a `from`: todo lo que sigue es aún más viejo.
 *
 * `range` son los extremos NORMALIZADOS (instantes UTC) que devolvió
 * sales-by-period, o sea el mismo ancla (`receivedAt`) y los mismos límites
 * inclusivos que el reporte; así detalle y total salen del mismo periodo.
 *
 * La paginación por offset no es un snapshot (§1.5): si entra una venta
 * mientras se lee, la última de una página reaparece al inicio de la
 * siguiente. Se deduplica por `id`. Un error de red se propaga: un detalle
 * parcial jamás debe pasar por completo.
 */
export async function collectSalesInRange(
  range: { from: string; to: string },
  options: CollectOptions = {},
): Promise<CollectedSales> {
  const listSales = options.listSales ?? ((params: SaleListParams) => SalesService.listSales(params))
  const pageSize = options.pageSize ?? SALES_PAGE_SIZE
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES
  const from = Date.parse(range.from)
  const to = Date.parse(range.to)

  const seen = new Set<string>()
  const sales: Sale[] = []
  let pagesFetched = 0

  while (pagesFetched < maxPages) {
    const page = pagesFetched + 1
    const response = await listSales({ status: 'completada', sort: 'desc', page, limit: pageSize })
    pagesFetched = page

    let reachedOlder = false
    for (const sale of response.items) {
      const receivedAt = Date.parse(sale.receivedAt)
      if (receivedAt < from) {
        reachedOlder = true
        continue
      }
      if (receivedAt > to || sale.status !== 'completada' || seen.has(sale.id)) continue
      seen.add(sale.id)
      sales.push(sale)
    }

    const exhausted = response.items.length < pageSize || page * pageSize >= response.total
    if (reachedOlder || exhausted) return { sales, truncated: false, pagesFetched }
  }

  return { sales, truncated: true, pagesFetched }
}
