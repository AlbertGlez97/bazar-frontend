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
  /**
   * Costo de compra. El servidor NO lo manda a quien no es socio (la clave no
   * aparece), así que puede faltar; `null` sí significa "todavía sin costo".
   */
  purchaseCostMinor?: number | null
  supplier: string | null
  notes: string | null
  /** Marca (máx. 40). Ausente en un catálogo guardado antes de que existiera. */
  brand?: string | null
  /** Talla, tamaño o capacidad (máx. 40); el color va dentro: "Azul · 28". */
  presentation?: string | null
  /** Descripción breve (máx. 200). */
  description?: string | null
  createdAt: string
  active: boolean
  /** Ruta pública relativa, ej. "/uploads/products/<uuid>.png", o null */
  image: string | null
}

/**
 * POST /products/:id/restock — suma piezas a un producto por cantidad (solo
 * socios). `quantity` es lo que se SUMA, no la nueva existencia. Sin
 * `unitCostMinor` el costo del producto no se toca; con él, el servidor lo
 * promedia (ponderado) con la existencia que ya había.
 */
export interface RestockProductPayload {
  quantity: number
  /** Costo unitario de ESTA compra, en centavos. */
  unitCostMinor?: number
  note?: string
}

/** Constancia de una reposición (solo se agrega, nunca se edita). */
export interface StockMovement {
  id: string
  productId: string
  memberId: string
  type: 'REPOSICION'
  quantity: number
  stockBefore: number
  stockAfter: number
  unitCostMinor: number | null
  note: string | null
  createdAt: string
  contextId: string
}

export interface RestockProductResult {
  product: Product
  movement: StockMovement
}

export interface ProductListParams {
  page?: number
  limit?: number
  search?: string
  /** Solo tiene efecto real si quien pregunta es un socio activo (ver §5) */
  includeInactive?: boolean
  /** "Poca existencia": solo productos con stock <= umbral. Ausente = sin filtro. */
  umbral?: number
  /** Solo productos con stock 0. Ausente = sin filtro (el servidor trata `false` igual). */
  agotados?: boolean
  /** Solo productos sin costo de compra. Ausente = sin filtro. */
  sinCosto?: boolean
  /** Solo productos de este tipo. Ausente = ambos. */
  tipo?: 'unica' | 'cantidad'
  /** Solo productos de esta marca (igualdad exacta, sin distinguir mayúsculas). Ausente = sin filtro. */
  brand?: string
}

/** GET /products/suggestions (solo socios): lo que ya se usó, para sugerirlo en el formulario. */
export interface ProductSuggestions {
  brands: string[]
  presentations: string[]
  /** Ausente si el servidor es anterior a las categorías sugeridas. */
  categories?: string[]
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
  brand?: string
  presentation?: string
  description?: string
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
  brand?: string | null
  presentation?: string | null
  description?: string | null
}

// Payload que emite ProductForm — agrega el archivo de imagen (opcional,
// se sube en una llamada aparte a POST /products/:id/image) a los campos
// propios de creación o edición.
export type ProductFormSubmitPayload =
  | (CreateProductPayload & {
      imageFile: File | null
      /** "Crear otro igual": ruta de la foto a copiar (subiéndola como archivo nuevo) si no se eligió otra. */
      copyImageFrom?: string
    })
  | (UpdateProductPayload & { imageFile: File | null })

/**
 * Punto de partida de "Crear otro igual": lo que se copia de un producto para dar de
 * alta otro. Sin presentación ni existencia (cada combinación tiene las suyas) y sin
 * identidad (id, fechas, estado). La foto no se comparte: `imageUrl` solo dice cuál
 * copiar, subiéndola como archivo nuevo.
 */
export interface ProductDraft {
  /** Producto del que se copió. */
  sourceId: string
  name: string
  tipo: ProductType
  brand: string | null
  category: string | null
  unitPriceMinor: number
  purchaseCostMinor: number | null
  supplier: string | null
  notes: string | null
  description: string | null
  /** Ruta de la foto a copiar, o null. */
  imageUrl: string | null
}
