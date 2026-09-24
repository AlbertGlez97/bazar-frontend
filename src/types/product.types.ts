// Contrato real de bazar-api para el módulo Products (doc/api-contract-for-
// frontend.md §5). Dinero en centavos MXN (unitPriceMinor/purchaseCostMinor);
// la conversión a pesos vive en utils/money.ts.
export type ProductType = 'unica' | 'cantidad'

export interface Product {
  id: string
  name: string
  tipo: ProductType
  unitPriceMinor: number
  initialStock: number
  stock: number
  category: string | null
  purchaseCostMinor: number | null
  supplier: string | null
  notes: string | null
  createdAt: string
  active: boolean
  /** Ruta pública relativa, ej. "/uploads/products/<uuid>.png", o null */
  image: string | null
}

export interface ProductListParams {
  page?: number
  limit?: number
  search?: string
  /** Solo tiene efecto real si quien pregunta es un socio activo (ver §5) */
  includeInactive?: boolean
}

export interface ProductListResponse {
  items: Product[]
  total: number
  page: number
  limit: number
}

// POST /products (solo socios). `initialStock` es requerido si tipo="cantidad"
// y se ignora (se fuerza a 1) del lado del servidor si tipo="unica".
export interface CreateProductPayload {
  name: string
  tipo: ProductType
  unitPriceMinor: number
  initialStock?: number
  category?: string
  purchaseCostMinor?: number
  supplier?: string
  notes?: string
}

// PATCH /products/:id (solo socios). Todos opcionales, pero al menos uno es
// obligatorio. `null` en category/purchaseCostMinor/supplier/notes los borra;
// `null` en unitPriceMinor es 400 (no se puede "borrar" el precio). NO admite
// tipo/initialStock/stock/image/active (inmutables desde este endpoint).
export interface UpdateProductPayload {
  name?: string
  unitPriceMinor?: number
  category?: string | null
  purchaseCostMinor?: number | null
  supplier?: string | null
  notes?: string | null
}

// Payload que emite ProductForm — agrega el archivo de imagen (opcional,
// se sube en una llamada aparte a POST /products/:id/image) a los campos
// propios de creación o edición.
export type ProductFormSubmitPayload =
  | (CreateProductPayload & { imageFile: File | null })
  | (UpdateProductPayload & { imageFile: File | null })
