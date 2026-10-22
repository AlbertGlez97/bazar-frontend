// Tipos del catálogo en Word (Gestión > Productos, solo socios).

/**
 * LISTA BLANCA de lo único que el generador del catálogo puede ver de un producto.
 * Nunca incluye `purchaseCostMinor`, `supplier` ni `notes`: se construye con
 * `toCatalogSource`, campo por campo, jamás copiando el objeto completo.
 */
export interface CatalogSource {
  id: string
  name: string
  brand: string | null
  presentation: string | null
  description: string | null
  /** Precio de venta en centavos. */
  unitPriceMinor: number
  stock: number
  tipo: 'unica' | 'cantidad'
  category: string | null
  /** Ruta relativa de la foto (mismo origen), o `null`. */
  image: string | null
}

/** Cómo se muestra la existencia: número exacto, disponibilidad o nada. */
export type StockMode = 'exact' | 'availability' | 'hidden'

/** Qué productos entran al catálogo. */
export type CatalogFilter =
  | { mode: 'all' }
  | { mode: 'categories'; categories: string[] }
  | { mode: 'in-stock' }
  | { mode: 'manual'; ids: string[] }

export interface CatalogDataOptions {
  groupVariants: boolean
  stockMode: StockMode
  /** "Últimas piezas": existencia mayor que 0 y menor o igual que este valor. */
  lowStockThreshold: number
  filter: CatalogFilter
}

/** Una fila de variante dentro de un producto. */
export interface CatalogVariant {
  id: string
  /** "Estándar" cuando el registro no tiene presentación. */
  presentation: string
  unitPriceMinor: number
  stock: number
  tipo: 'unica' | 'cantidad'
  /** Texto de existencia ya resuelto; cadena vacía si el modo es "ocultar". */
  stockLabel: string
}

/** Un producto del catálogo (un grupo de variantes, o un registro suelto). */
export interface CatalogEntry {
  name: string
  brand: string | null
  description: string | null
  /** Foto de la primera variante que tenga. */
  image: string | null
  variants: CatalogVariant[]
}

export interface CatalogCategory {
  name: string
  /** `true` para "Otros" (productos sin categoría): siempre al final. */
  isOthers: boolean
  entries: CatalogEntry[]
}

export interface CatalogData {
  categories: CatalogCategory[]
  /** Productos mostrados (grupos). */
  productCount: number
  /** Registros que entraron, antes de agrupar. */
  recordCount: number
  /** Registros que se juntaron con otro (`recordCount - productCount`). */
  mergedCount: number
  /** Fotos que habría que procesar (productos con foto). */
  photoCount: number
}
