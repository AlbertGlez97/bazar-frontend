/**
 * Cómo se muestra el catálogo en la pantalla de Gestión (Productos).
 * - `grid`: tarjetas en cuadrícula (la de siempre).
 * - `list`: tarjetas apiladas en una sola columna, varias a la vista sin
 *   tanto desplazamiento horizontal.
 */
export type ManageCatalogView = 'grid' | 'list'

export function isManageCatalogView(value: unknown): value is ManageCatalogView {
  return value === 'grid' || value === 'list'
}
