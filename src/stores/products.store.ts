import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import ProductsService from '@/services/products.service'
import type {
  CreateProductPayload,
  Product,
  ProductListParams,
  UpdateProductPayload,
} from '@/types/product.types'

export const useProductsStore = defineStore('products', () => {
  const items = ref<Product[]>([])
  const total = ref(0)
  const page = ref(1)
  const limit = ref(20)
  const search = ref('')
  const includeInactive = ref(false)
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

    loading.value = true
    error.value = null
    try {
      const query = (pageNumber: number) => ProductsService.listProducts({
        page: pageNumber,
        limit: limit.value,
        search: search.value || undefined,
        includeInactive: includeInactive.value || undefined,
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
      error.value = 'No se pudo cargar el catálogo de productos'
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
    items, total, page, limit, search, includeInactive, loading, error, totalPages,
    fetchProducts, createProduct, updateProduct, uploadProductImage,
    deactivateProduct, reactivateProduct,
  }
})
