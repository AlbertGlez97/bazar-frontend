import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import ProductsService from '@/services/products.service'
import { loadCatalogSnapshot, saveCatalogSnapshot } from '@/services/local-db'
import { VOICE, isNetworkError } from '@/config/voice'
import type { Product } from '@/types/product.types'

/**
 * Catálogo local de la pantalla de venta.
 *
 * `products.store` solo guarda la PÁGINA actual (20 por defecto, máx. 100), así
 * que no sirve para vender: aquí se cargan TODOS los productos activos
 * paginando con `limit=100`, se guardan en IndexedDB y el filtrado (búsqueda y
 * categoría) es local e instantáneo. Sin red, se usa la última copia guardada.
 */

/** Máximo del contrato para `limit` en GET /products. */
const PAGE_LIMIT = 100

/** Lo mínimo que `applySoldItems` necesita de una línea vendida (compatible con `CartLine`). */
export interface SoldItem {
  productId: string
  quantity: number
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

/** Minúsculas, sin acentos y sin espacios en los extremos: "  CAFÉ " -> "cafe". */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export const useSaleCatalogStore = defineStore('sale-catalog', () => {
  const products = ref<Product[]>([])
  const loading = ref(false)
  /** Mensaje amable si no hay catálogo que mostrar (falló la carga y no hay copia guardada). */
  const error = ref<string | null>(null)
  /** ISO 8601 de la última carga real del servidor (o de la copia guardada si se usa esa). */
  const lastLoadedAt = ref<string | null>(null)
  /** `true` si lo que se muestra es la copia guardada y no una carga fresca del servidor. */
  const isFromSnapshot = ref(false)
  const search = ref('')
  /** Categoría exacta; la cadena vacía significa "todas". */
  const category = ref('')

  let inFlight: Promise<void> | null = null

  /** Trae todas las páginas; si cualquiera falla, falla todo (nunca un catálogo a medias). */
  async function fetchAllActive(): Promise<Product[]> {
    const byId = new Map<string, Product>()
    let page = 1
    for (;;) {
      const response = await ProductsService.listProducts({ page, limit: PAGE_LIMIT })
      // La paginación por offset no es un snapshot: dedupe por id por si el catálogo cambió entre páginas.
      for (const item of response.items) byId.set(item.id, item)
      if (response.items.length === 0 || byId.size >= response.total || page * PAGE_LIMIT >= response.total) break
      page += 1
    }
    return [...byId.values()]
  }

  async function runLoad(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const fresh = await fetchAllActive()
      const loadedAt = new Date().toISOString()
      products.value = fresh
      lastLoadedAt.value = loadedAt
      isFromSnapshot.value = false
      await saveCatalogSnapshot(fresh, loadedAt)
    } catch (cause) {
      // Lo que ya hay en memoria es al menos tan reciente como el snapshot.
      if (products.value.length > 0) {
        isFromSnapshot.value = true
        return
      }
      const snapshot = await loadCatalogSnapshot()
      if (snapshot) {
        products.value = snapshot.items
        lastLoadedAt.value = snapshot.savedAt
        isFromSnapshot.value = true
      } else {
        error.value = isNetworkError(cause) ? VOICE.networkError : VOICE.genericError
      }
    } finally {
      loading.value = false
    }
  }

  /**
   * Carga el catálogo activo completo. Nunca lanza: el resultado queda en
   * `products`, `error`, `isFromSnapshot` y `lastLoadedAt`. Llamadas
   * simultáneas comparten la misma petición.
   */
  function load(): Promise<void> {
    if (inFlight) return inFlight
    const current = runLoad().finally(() => {
      if (inFlight === current) inFlight = null
    })
    inFlight = current
    return current
  }

  // ── Filtros (locales) ───────────────────────────────────────────────────
  /** Categorías distintas, no vacías, ordenadas en español. */
  const categories = computed(() => {
    const distinct = new Set<string>()
    for (const item of products.value) {
      const name = item.category?.trim()
      if (name) distinct.add(name)
    }
    return [...distinct].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
  })

  /** Productos que cumplen búsqueda (subcadena en el nombre, sin acentos ni mayúsculas) y categoría, en el orden del servidor. */
  const filtered = computed(() => {
    const needle = normalize(search.value)
    return products.value.filter((item) => {
      if (category.value && item.category?.trim() !== category.value) return false
      return !needle || normalize(item.name).includes(needle)
    })
  })

  function setSearch(text: string): void {
    search.value = text
  }

  function setCategory(name: string): void {
    category.value = name
  }

  // ── Búsqueda por id (QR) ────────────────────────────────────────────────
  /** Producto por id, sin distinguir mayúsculas y recortando espacios. */
  function getById(id: string): Product | null {
    const wanted = id.trim().toLowerCase()
    if (!wanted) return null
    return products.value.find((item) => item.id.toLowerCase() === wanted) ?? null
  }

  /**
   * Producto para el texto de un QR. El contenido esperado es el id del
   * producto, pero también se acepta un id dentro de una URL o con prefijo.
   * `null` si no corresponde a un producto de este catálogo.
   */
  function findByScannedText(text: string): Product | null {
    const direct = getById(text)
    if (direct) return direct
    const embedded = UUID_RE.exec(text)
    return embedded ? getById(embedded[0]) : null
  }

  // ── Stock local ─────────────────────────────────────────────────────────
  /**
   * Descuenta lo vendido del stock local (`unica` -> 0; `cantidad` resta sin
   * bajar de 0) y vuelve a guardar el snapshot. La fecha del snapshot sigue
   * siendo la de la última carga real. Nunca lanza.
   */
  async function applySoldItems(items: SoldItem[]): Promise<void> {
    if (items.length === 0) return
    const sold = new Map<string, number>()
    for (const item of items) sold.set(item.productId, (sold.get(item.productId) ?? 0) + item.quantity)

    products.value = products.value.map((item) => {
      const quantity = sold.get(item.id)
      if (quantity === undefined) return item
      const stock = item.tipo === 'unica' ? 0 : Math.max(0, item.stock - quantity)
      return { ...item, stock }
    })
    await saveCatalogSnapshot(products.value, lastLoadedAt.value ?? undefined)
  }

  return {
    products, loading, error, lastLoadedAt, isFromSnapshot, search, category,
    categories, filtered,
    load, setSearch, setCategory, getById, findByScannedText, applySoldItems,
  }
})
