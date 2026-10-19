import { LOW_STOCK_UMBRAL, PRODUCT_TEXT_LIMITS } from '@/config/catalog'
import { VOICE } from '@/config/voice'
import { collapseSpaces } from '@/utils/short-text'
import type { ProductListParams } from '@/types/product.types'
import type { ProductFilterChip, ProductFilterKey, ProductFilters, ProductTipoFilter } from '@/types/product-filters.types'

/** Parámetros de la URL (`?pocaExistencia=1&tipo=unica…`), tal como los entrega vue-router. */
type QueryInput = Record<string, unknown>

const TIPOS: readonly ProductTipoFilter[] = ['unica', 'cantidad']

export function emptyProductFilters(): ProductFilters {
  return { pocaExistencia: false, agotados: false, inactivos: false, tipo: undefined, sinCosto: false, marca: undefined }
}

/** La marca de la URL, limpia como la guarda el servidor; vacía o de más de 40 caracteres = sin filtro. */
function readBrand(value: unknown): string | undefined {
  const text = firstValue(value)
  if (typeof text !== 'string') return undefined
  const brand = collapseSpaces(text)
  return brand !== '' && brand.length <= PRODUCT_TEXT_LIMITS.brand ? brand : undefined
}

/** Con un parámetro repetido (`?a=1&a=0`) gana el primero. */
function firstValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value
}

const isOn = (value: unknown) => firstValue(value) === '1'

/**
 * Lee los filtros de la URL. `allowInactive` es falso por defecto: ver
 * inactivos es cosa de socios, y una URL compartida no debe dar a un
 * colaborador un filtro que no puede ver ni apagar.
 */
export function parseProductFilters(query: QueryInput, options: { allowInactive?: boolean } = {}): ProductFilters {
  const tipo = firstValue(query.tipo)
  return {
    pocaExistencia: isOn(query.pocaExistencia),
    agotados: isOn(query.agotados),
    inactivos: options.allowInactive === true && isOn(query.inactivos),
    tipo: TIPOS.find((candidate) => candidate === tipo),
    sinCosto: isOn(query.sinCosto),
    marca: readBrand(query.marca),
  }
}

/** Escribe solo lo activo: sin filtros la URL queda limpia. */
export function serializeProductFilters(filters: ProductFilters): Record<string, string> {
  const query: Record<string, string> = {}
  if (filters.pocaExistencia) query.pocaExistencia = '1'
  if (filters.agotados) query.agotados = '1'
  if (filters.inactivos) query.inactivos = '1'
  if (filters.tipo) query.tipo = filters.tipo
  if (filters.sinCosto) query.sinCosto = '1'
  if (filters.marca) query.marca = filters.marca
  return query
}

export function activeFilterChips(filters: ProductFilters): ProductFilterChip[] {
  const labels = VOICE.productFilters
  const chips: ProductFilterChip[] = []
  if (filters.pocaExistencia) chips.push({ key: 'pocaExistencia', label: labels.lowStock })
  if (filters.agotados) chips.push({ key: 'agotados', label: labels.soldOut })
  if (filters.inactivos) chips.push({ key: 'inactivos', label: labels.inactive })
  if (filters.tipo) chips.push({ key: 'tipo', label: labels[filters.tipo] })
  if (filters.sinCosto) chips.push({ key: 'sinCosto', label: labels.noCost })
  if (filters.marca) chips.push({ key: 'marca', label: labels.brandChip(filters.marca) })
  return chips
}

export function countActiveFilters(filters: ProductFilters): number {
  return activeFilterChips(filters).length
}

/** Copia de `filters` con un solo filtro apagado. */
export function clearFilter(filters: ProductFilters, key: ProductFilterKey): ProductFilters {
  return { ...filters, [key]: emptyProductFilters()[key] }
}

/**
 * Parámetros de GET /products. Todas las llaves van siempre, con `undefined`
 * para "apagado": el store solo reemplaza lo que ve mencionado (`'k' in params`),
 * así que omitir una llave dejaría puesto el filtro anterior.
 */
export function toProductListParams(filters: ProductFilters): Required<Pick<ProductListParams, 'includeInactive'>>
  & Pick<ProductListParams, 'umbral' | 'agotados' | 'sinCosto' | 'tipo' | 'brand'> {
  return {
    includeInactive: filters.inactivos,
    umbral: filters.pocaExistencia ? LOW_STOCK_UMBRAL : undefined,
    agotados: filters.agotados ? true : undefined,
    sinCosto: filters.sinCosto ? true : undefined,
    tipo: filters.tipo,
    brand: filters.marca,
  }
}
