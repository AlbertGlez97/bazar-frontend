import api from './api'
import type {
  Product,
  ProductListParams,
  ProductListResponse,
  CreateProductPayload,
  UpdateProductPayload,
} from '@/types/product.types'

const ProductsService = {
  /** GET /products — cualquier Member autenticado (solo AuthGuard). */
  async listProducts(params: ProductListParams = {}): Promise<ProductListResponse> {
    const { data } = await api.get<ProductListResponse>('/products', { params })
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
