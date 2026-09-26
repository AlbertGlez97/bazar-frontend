/**
 * Cómo se muestra el catálogo en la pantalla de venta.
 * - `grid`: tarjetas grandes con foto (la de siempre).
 * - `list`: filas compactas, varios productos a la vista sin tanto desplazamiento.
 */
export type SaleCatalogView = 'grid' | 'list'

export function isSaleCatalogView(value: unknown): value is SaleCatalogView {
  return value === 'grid' || value === 'list'
}
