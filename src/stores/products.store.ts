import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import ProductsService from '@/services/products.service'
import type {
  CreateProductPayload,
  Product,
  ProductListParams,
  RestockProductPayload,
  RestockProductResult,
  UpdateProductPayload,
} from '@/types/product.types'

// El umbral vive en `config` (para que la UI y los utils no dependan del store);
// se sigue exportando desde aquí para quien ya lo importaba de este módulo.
export { LOW_STOCK_UMBRAL } from '@/config/catalog'

export const useProductsStore = defineStore('products', () => {
  const items = ref<Product[]>([])
  const total = ref(0)
  const page = ref(1)
  const limit = ref(20)
  const search = ref('')
  const includeInactive = ref(false)
  // `undefined` = sin filtro de poca existencia (el de siempre); un número = solo
  // productos con stock <= umbral. Se guarda como filtro activo, igual que
  // includeInactive: paginar o buscar de nuevo lo mantiene sin repetirlo.
  const umbral = ref<number | undefined>(undefined)
  // Mismo criterio para los demás filtros del panel: persisten al paginar o
  // buscar y se apagan pasando `undefined` explícito.
  const agotados = ref(false)
  const sinCosto = ref(false)
  const tipo = ref<ProductListParams['tipo']>(undefined)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit.value)))

  /**
   * Recarga el listado. Los params dados actualizan los filtros guardados
   * en el store (así paginar o buscar de nuevo reusa el último criterio sin
   * tener que repetirlo desde la vista).
   */
  async function fetchProducts(params: ProductListParams = {}) {
    if (params.page !== undefined) page.value = params.page
    if (params.search !== undefined) search.value = params.search
    if (params.includeInactive !== undefined) includeInactive.value = params.includeInactive
    // `'umbral' in params` (no `!== undefined`) para poder apagar el filtro
    // pasando `{ umbral: undefined }` explícito, distinto de no mencionarlo.
    if ('umbral' in params) umbral.value = params.umbral
    if ('agotados' in params) agotados.value = params.agotados === true
    if ('sinCosto' in params) sinCosto.value = params.sinCosto === true
    if ('tipo' in params) tipo.value = params.tipo

    loading.value = true
    error.value = null
    try {
      const query = (pageNumber: number) => ProductsService.listProducts({
        page: pageNumber,
        limit: limit.value,
        search: search.value || undefined,
        includeInactive: includeInactive.value || undefined,
        umbral: umbral.value,
        agotados: agotados.value || undefined,
        sinCosto: sinCosto.value || undefined,
        tipo: tipo.value,
      })
      let response = await query(page.value)

      // Si la página pedida quedó fuera de rango (p. ej. se desactivó el único
      // producto de la última página), la API responde una página vacía aunque
      // aún haya productos y la paginación se ocultaría, dejando al usuario
      // atascado: se reposiciona en la última página que sí existe.
      const lastPage = Math.max(1, Math.ceil(response.total / response.limit))
      if (response.items.length === 0 && response.total > 0 && response.page > lastPage) {
        response = await query(lastPage)
      }

      items.value = response.items
      total.value = response.total
      page.value = response.page
      limit.value = response.limit
    } catch (cause) {
      error.value = 'No pudimos cargar tu catálogo. Intenta de nuevo.'
      throw cause
    } finally {
      loading.value = false
    }
  }

  async function createProduct(payload: CreateProductPayload): Promise<Product> {
    const product = await ProductsService.createProduct(payload)
    await fetchProducts()
    return product
  }

  async function updateProduct(id: string, payload: UpdateProductPayload): Promise<Product> {
    const product = await ProductsService.updateProduct(id, payload)
    await fetchProducts()
    return product
  }

  async function uploadProductImage(id: string, file: File): Promise<Product> {
    const product = await ProductsService.uploadProductImage(id, file)
    await fetchProducts()
    return product
  }

  async function restockProduct(id: string, payload: RestockProductPayload): Promise<RestockProductResult> {
    const result = await ProductsService.restockProduct(id, payload)
    await fetchProducts()
    return result
  }

  async function deactivateProduct(id: string): Promise<Product> {
    const product = await ProductsService.deactivateProduct(id)
    await fetchProducts()
    return product
  }

  async function reactivateProduct(id: string): Promise<Product> {
    const product = await ProductsService.reactivateProduct(id)
    await fetchProducts()
    return product
  }

  return {
    items, total, page, limit, search, includeInactive, umbral, agotados, sinCosto, tipo, loading, error, totalPages,
    fetchProducts, createProduct, updateProduct, uploadProductImage,
    restockProduct, deactivateProduct, reactivateProduct,
  }
})
