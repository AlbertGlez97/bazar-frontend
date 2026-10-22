import type { ProductListResponse } from '@/types/product.types'

/** Máximo del contrato para `limit` en GET /products. */
export const PRODUCTS_PAGE_LIMIT = 100

/**
 * Recorre todas las páginas de GET /products (de a `PRODUCTS_PAGE_LIMIT`). Si cualquiera
 * falla, falla todo (nunca una lista a medias). La paginación por offset no es un
 * snapshot: se quita lo repetido por id por si la lista cambió entre páginas.
 */
export async function fetchAllProductPages<T extends { id: string }>(
  fetchPage: (page: number, limit: number) => Promise<Pick<ProductListResponse, 'total'> & { items: T[] }>,
): Promise<T[]> {
  const byId = new Map<string, T>()
  let page = 1
  for (;;) {
    const response = await fetchPage(page, PRODUCTS_PAGE_LIMIT)
    for (const item of response.items) byId.set(item.id, item)
    if (response.items.length === 0 || byId.size >= response.total || page * PRODUCTS_PAGE_LIMIT >= response.total) break
    page += 1
  }
  return [...byId.values()]
}
