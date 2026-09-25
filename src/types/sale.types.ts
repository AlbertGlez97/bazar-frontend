// Contrato real de bazar-api para el módulo Sales (doc/api-contract-for-
// frontend.md §1.6 y §6). Dinero en centavos MXN (enteros). `contextId` y
// `requestFingerprint` llegan en las respuestas pero son internos: se declaran
// opcionales y el frontend no debe usarlos ni enviarlos (enviar `contextId` es 400).

export type SaleStatus = 'completada' | 'rechazada_por_conflicto'

export type SaleSortOrder = 'asc' | 'desc'

/** Partida de una venta ya guardada por el servidor. */
export interface SaleItem {
  id: string
  productId: string
  quantity: number
  /** Precio COBRADO por el servidor (no el que mandó el cliente). */
  unitPriceMinor: number
  subtotalMinor: number
  createdAt: string
}

/** Venta tal como la devuelven POST /sales, GET /sales y GET /sales/:id. */
export interface Sale {
  id: string
  memberId: string
  deviceId: string
  /** Fecha declarada por el reloj del dispositivo (ISO 8601). */
  occurredAt: string
  /** Reloj del servidor; ancla de reportes y comisiones. */
  receivedAt: string
  currency: 'MXN'
  /** LEER SIEMPRE: un 201 puede traer `rechazada_por_conflicto`. */
  status: SaleStatus
  /** `null` si la venta quedó rechazada por conflicto. */
  totalMinor: number | null
  cashReceivedMinor: number
  /** `null` si la venta quedó rechazada por conflicto. */
  changeMinor: number | null
  /** Solo en rechazadas (texto técnico del servidor, en español). */
  conflictReason: string | null
  conflictDetectedAt: string | null
  /** `[]` en rechazadas. */
  items: SaleItem[]
  /** Interno, ignorable. */
  contextId?: string
  /** Interno, ignorable. */
  requestFingerprint?: string | null
}

/** Partida del cuerpo de POST /sales. Cualquier otro campo es 400. */
export interface CreateSaleItemPayload {
  productId: string
  /** Entero 1..100000. */
  quantity: number
  /** Solo trazabilidad: el servidor lo ignora para cobrar y para la idempotencia. */
  unitPriceMinor?: number
}

/** Cuerpo de POST /sales. Propiedades desconocidas (también en `items`) son 400. */
export interface CreateSalePayload {
  /** UUID generado por el cliente (v7): es la clave de idempotencia. */
  id: string
  /** Debe coincidir con el header `x-member-id`. */
  memberId: string
  /** Debe coincidir con el header `x-device-id`. */
  deviceId: string
  /** Instante ISO 8601 completo (con `Z`). Se congela al primer intento. */
  occurredAt: string
  currency: 'MXN'
  /** Entero 0..2147483647. */
  cashReceivedMinor: number
  /** 1..500 partidas. */
  items: CreateSaleItemPayload[]
}

/**
 * Resultado de `createSale`. Discrimina por `body.status`, NUNCA por el código
 * HTTP: un 201 puede ser una venta rechazada por conflicto (§1.6).
 * `httpStatus` es 201 (venta nueva) o 200 (reenvío idempotente); `replayed`
 * lo resume.
 */
export type CreateSaleResult =
  | { outcome: 'completed'; httpStatus: number; replayed: boolean; sale: Sale }
  | { outcome: 'conflict'; httpStatus: number; replayed: boolean; sale: Sale }

/** Query de GET /sales (solo socios). No existe filtro por fecha. */
export interface SaleListParams {
  status?: SaleStatus
  /** Coincidencia parcial sobre el NOMBRE DEL VENDEDOR, no sobre el id de la venta. */
  search?: string
  /** Ordena por `receivedAt`; el servidor usa `desc` por defecto. */
  sort?: SaleSortOrder
  page?: number
  limit?: number
}

export interface SaleListResponse {
  items: Sale[]
  total: number
  page: number
  limit: number
}
