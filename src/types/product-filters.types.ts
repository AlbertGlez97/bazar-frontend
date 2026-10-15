/** Tipo de producto por el que se puede filtrar el catálogo. */
export type ProductTipoFilter = 'unica' | 'cantidad'

/**
 * Filtros del catálogo de Productos (panel "Filtros"). Todos apagados = el
 * catálogo de siempre. `tipo` es exclusivo: o una sola opción o ninguna.
 */
export interface ProductFilters {
  /** stock <= umbral (el mismo umbral que usa el resumen de Inicio). */
  pocaExistencia: boolean
  /** Solo productos con stock 0. */
  agotados: boolean
  /** Incluye productos desactivados (solo lo respeta el servidor para socios). */
  inactivos: boolean
  tipo: ProductTipoFilter | undefined
  /** Solo productos sin costo de compra. */
  sinCosto: boolean
}

export type ProductFilterKey = keyof ProductFilters

/** Un filtro activo, listo para mostrarse como chip. */
export interface ProductFilterChip {
  key: ProductFilterKey
  label: string
}
