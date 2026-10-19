import api from './api'
import type {
  Product,
  ProductListParams,
  ProductListResponse,
  ProductSuggestions,
  CreateProductPayload,
  UpdateProductPayload,
  RestockProductPayload,
  RestockProductResult,
} from '@/types/product.types'

const ProductsService = {
  /** GET /products — cualquier Member autenticado (solo AuthGuard). */
  async listProducts(params: ProductListParams = {}): Promise<ProductListResponse> {
    const { data } = await api.get<ProductListResponse>('/products', { params })
    return data
  },

  /** GET /products/suggestions — solo socios: marcas y presentaciones ya usadas (máx. 200 de cada una). */
  async getSuggestions(): Promise<ProductSuggestions> {
    const { data } = await api.get<ProductSuggestions>('/products/suggestions')
    return data
  },

  /** GET /products/:id — devuelve el producto aunque esté inactivo. */
  async getProduct(id: string): Promise<Product> {
    const { data } = await api.get<Product>(`/products/${id}`)
    return data
  },

  /** POST /products — solo socios (SocioGuard). */
  async createProduct(payload: CreateProductPayload): Promise<Product> {
    const { data } = await api.post<Product>('/products', payload)
    return data
  },

  /** PATCH /products/:id — solo socios; al menos un campo es obligatorio. */
  async updateProduct(id: string, payload: UpdateProductPayload): Promise<Product> {
    const { data } = await api.patch<Product>(`/products/${id}`, payload)
    return data
  },

  /**
   * POST /products/:id/image — solo socios, multipart con un único campo
   * "image". OJO: la instancia de api.ts fija `Content-Type: application/
   * json` por defecto para todas las peticiones; hay que anular ese header
   * (dejarlo `undefined`) para esta llamada en particular, si no Axios no
   * deja que el navegador genere el boundary del multipart y el request
   * llega roto al backend.
   */
  async uploadProductImage(id: string, file: File): Promise<Product> {
    const form = new FormData()
    form.append('image', file)
    const { data } = await api.post<Product>(`/products/${id}/image`, form, {
      headers: { 'Content-Type': undefined },
    })
    return data
  },

  /**
   * Baja la foto de un producto (su ruta pública, del mismo origen) y la entrega como
   * un archivo NUEVO, para subirla a otro producto sin compartir la ruta. Lanza si no
   * hay red, si el servidor responde error o si lo que llega no es una imagen.
   */
  async fetchImageFile(imageUrl: string, name: string): Promise<File> {
    const response = await fetch(imageUrl)
    if (!response.ok) throw new Error(`No se pudo bajar la foto (${response.status})`)
    const type = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    if (!type.startsWith('image/')) throw new Error('El archivo descargado no es una imagen')
    const blob = await response.blob()
    const safeName = name.replace(/[\\/\r\n]+/g, ' ').trim().slice(0, 60) || 'foto'
    return new File([blob], `${safeName}.png`, { type })
  },

  /**
   * POST /products/:id/restock — solo socios, solo productos por cantidad.
   * Va directo al servidor (no a una cola offline): en Gestión se necesita
   * internet y la persona tiene que ver si se pudo o no.
   */
  async restockProduct(id: string, payload: RestockProductPayload): Promise<RestockProductResult> {
    const { data } = await api.post<RestockProductResult>(`/products/${id}/restock`, payload)
    return data
  },

  /** DELETE /products/:id — solo socios; borrado lógico (active=false), idempotente. */
  async deactivateProduct(id: string): Promise<Product> {
    const { data } = await api.delete<Product>(`/products/${id}`)
    return data
  },

  /** PATCH /products/:id/reactivate — solo socios; idempotente. */
  async reactivateProduct(id: string): Promise<Product> {
    const { data } = await api.patch<Product>(`/products/${id}/reactivate`)
    return data
  },
}

export default ProductsService
