/**
 * Arma los datos del catálogo en Word. PURO: sin Word, sin red, sin DOM.
 *
 * - LISTA BLANCA: el generador solo recibe `CatalogSource` (nombre, marca, presentación,
 *   descripción, precio de venta, existencia, tipo, categoría y foto). `toCatalogSource`
 *   copia esos campos UNO POR UNO; el costo, el proveedor y las notas nunca pasan, y la
 *   salida se construye también campo por campo (no se esparce ningún objeto de entrada).
 * - Variantes: cada combinación (talla, color…) es un producto aparte en la base y NO hay
 *   un id de grupo. "Agrupar variantes" junta por nombre + marca + categoría normalizados
 *   (sin acentos, minúsculas, espacios juntos).
 *   LIMITACIÓN CONOCIDA (a propósito, sin `groupId` ni migración): una marca vacía en un
 *   registro y llena en otro NO los agrupa; y los nombres que incluyen la variante
 *   ("Playera azul" / "Playera roja") tampoco, porque son nombres distintos.
 * - Categorías: una por producto, un nivel. Sin categoría -> "Otros", siempre al final;
 *   las demás por orden alfabético es-MX. Dentro de cada una, productos por nombre.
 */
import type {
  CatalogCategory,
  CatalogData,
  CatalogDataOptions,
  CatalogEntry,
  CatalogFilter,
  CatalogSource,
  CatalogVariant,
  StockMode,
} from '@/types/catalog.types'
import type { Product } from '@/types/product.types'
import { normalizeKey } from '@/utils/text-normalize'

export const OTHERS_CATEGORY = 'Otros'
export const STANDARD_PRESENTATION = 'Estándar'
export const DEFAULT_LOW_STOCK_THRESHOLD = 3
const LOCALE = 'es-MX'

export const DEFAULT_CATALOG_DATA_OPTIONS: CatalogDataOptions = {
  groupVariants: true,
  stockMode: 'exact',
  lowStockThreshold: DEFAULT_LOW_STOCK_THRESHOLD,
  filter: { mode: 'all' },
}

/** Los únicos campos que salen de un producto hacia el catálogo (copiados uno por uno). */
export function toCatalogSource(product: Product): CatalogSource {
  return {
    id: product.id,
    name: product.name,
    brand: product.brand ?? null,
    presentation: product.presentation ?? null,
    description: product.description ?? null,
    unitPriceMinor: product.unitPriceMinor,
    stock: product.stock,
    tipo: product.tipo,
    category: product.category ?? null,
    image: product.image ?? null,
  }
}

const compareText = (a: string, b: string) => a.localeCompare(b, LOCALE, { sensitivity: 'base', numeric: true })

/** Texto sin espacios de más; `null` si queda vacío. */
function clean(text: string | null | undefined): string | null {
  const value = (text ?? '').trim().split(/\s+/).join(' ')
  return value === '' ? null : value
}

/** La escritura más frecuente (en un empate, la primera por orden alfabético y, si solo difieren en mayúsculas, por código); `null` si no hay. */
function mostFrequent(values: readonly (string | null)[]): string | null {
  const counts = new Map<string, number>()
  for (const value of values) if (value !== null) counts.set(value, (counts.get(value) ?? 0) + 1)
  const ranked = [...counts.entries()].sort(([a, countA], [b, countB]) => countB - countA || compareText(a, b) || (a < b ? -1 : a > b ? 1 : 0))
  return ranked[0]?.[0] ?? null
}

/** Texto de existencia de una variante según el modo. */
export function stockLabel(
  source: Pick<CatalogSource, 'stock' | 'tipo'>,
  mode: StockMode,
  lowStockThreshold: number = DEFAULT_LOW_STOCK_THRESHOLD,
): string {
  if (mode === 'hidden') return ''
  if (source.stock <= 0) return 'Agotado'
  if (mode === 'availability') return source.stock <= lowStockThreshold ? 'Últimas piezas' : 'Disponible'
  return source.tipo === 'unica' ? 'Pieza única' : String(source.stock)
}

/**
 * Llave de una categoría para comparar y para el filtro; cadena vacía = "Otros" (sin
 * categoría, o una categoría que alguien escribió como "otros": son lo mismo).
 */
export function categoryKey(category: string | null): string {
  const key = normalizeKey(category ?? '')
  return key === normalizeKey(OTHERS_CATEGORY) ? '' : key
}

function passesFilter(source: CatalogSource, filter: CatalogFilter): boolean {
  switch (filter.mode) {
    case 'all':
      return true
    case 'in-stock':
      return source.stock > 0
    case 'categories': {
      const wanted = new Set(filter.categories.map(categoryKey))
      return wanted.has(categoryKey(source.category))
    }
    case 'manual':
      return filter.ids.includes(source.id)
  }
}

function toVariant(source: CatalogSource, options: CatalogDataOptions): CatalogVariant {
  return {
    id: source.id,
    presentation: clean(source.presentation) ?? STANDARD_PRESENTATION,
    unitPriceMinor: source.unitPriceMinor,
    stock: source.stock,
    tipo: source.tipo,
    stockLabel: stockLabel(source, options.stockMode, options.lowStockThreshold),
  }
}

/** "Estándar" primero y luego por presentación (orden natural: "2" antes que "10"). */
function compareVariants(a: CatalogVariant, b: CatalogVariant): number {
  const aStandard = a.presentation === STANDARD_PRESENTATION
  const bStandard = b.presentation === STANDARD_PRESENTATION
  if (aStandard !== bStandard) return aStandard ? -1 : 1
  return compareText(a.presentation, b.presentation)
}

function toEntry(group: readonly CatalogSource[], options: CatalogDataOptions): CatalogEntry {
  const ordered = group.map((source) => ({ source, variant: toVariant(source, options) }))
  ordered.sort((a, b) => compareVariants(a.variant, b.variant))
  return {
    name: mostFrequent(group.map((source) => clean(source.name))) ?? '',
    brand: mostFrequent(group.map((source) => clean(source.brand))),
    description: ordered.map(({ source }) => clean(source.description)).find((text) => text !== null) ?? null,
    // La foto del grupo es la de la primera variante (en el orden mostrado) que tenga.
    image: ordered.map(({ source }) => source.image).find((image) => !!image) ?? null,
    variants: ordered.map(({ variant }) => variant),
  }
}

/** Junta los registros por nombre + marca + categoría normalizados; sin agrupar, cada uno va solo. */
function groupRecords(records: readonly CatalogSource[], groupVariants: boolean): CatalogSource[][] {
  if (!groupVariants) return records.map((record) => [record])
  const groups = new Map<string, CatalogSource[]>()
  for (const record of records) {
    const key = [record.name, record.brand, record.category].map((part) => normalizeKey(part ?? '')).join('\u0001')
    const group = groups.get(key)
    if (group) group.push(record)
    else groups.set(key, [record])
  }
  return [...groups.values()]
}

export function buildCatalogData(
  sources: readonly CatalogSource[],
  options: CatalogDataOptions = DEFAULT_CATALOG_DATA_OPTIONS,
): CatalogData {
  const records = sources.filter((source) => passesFilter(source, options.filter))

  // Categorías: una sola por producto; se agrupan por su llave normalizada.
  const byCategory = new Map<string, CatalogSource[]>()
  for (const record of records) {
    const key = categoryKey(record.category)
    const bucket = byCategory.get(key)
    if (bucket) bucket.push(record)
    else byCategory.set(key, [record])
  }

  const categories: CatalogCategory[] = []
  for (const [key, bucket] of byCategory) {
    const entries = groupRecords(bucket, options.groupVariants).map((group) => toEntry(group, options))
    entries.sort((a, b) => compareText(a.name, b.name))
    const isOthers = key === ''
    categories.push({ name: isOthers ? OTHERS_CATEGORY : (mostFrequent(bucket.map((r) => clean(r.category))) ?? OTHERS_CATEGORY), isOthers, entries })
  }
  categories.sort((a, b) => Number(a.isOthers) - Number(b.isOthers) || compareText(a.name, b.name))

  const entries = categories.flatMap((category) => category.entries)
  return {
    categories,
    productCount: entries.length,
    recordCount: records.length,
    mergedCount: records.length - entries.length,
    photoCount: entries.filter((entry) => entry.image !== null).length,
  }
}

/** Categorías que se pueden elegir en el filtro (con "Otros" al final si hay productos sin categoría). */
export function listCatalogCategories(sources: readonly CatalogSource[]): string[] {
  return buildCatalogData(sources, { ...DEFAULT_CATALOG_DATA_OPTIONS, groupVariants: false }).categories.map((category) => category.name)
}
