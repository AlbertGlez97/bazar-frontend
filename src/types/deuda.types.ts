// Contrato real de bazar-api para el módulo Deudas (doc/api-contract-for-
// frontend.md §10, verificado literalmente contra los DTOs reales; ver
// odd/tasks/deudas-view-cuotas-abono-inicial.md, BE-15). Una Deuda es de UN
// SOLO producto y cantidad — nunca un carrito. `fiado` y `apartado` se tratan
// idéntico en el servidor (ambos descuentan stock de inmediato al crearse);
// es solo una etiqueta para el socio.
export type DeudaType = 'fiado' | 'apartado'
export type DeudaStatus = 'pendiente' | 'saldada'
export type DeudaOrderBy = 'createdAt' | 'saldoPendiente' | 'cuotaVencida'
export type DeudaSortOrder = 'asc' | 'desc'

/** Pago parcial contra una Deuda. Nunca excede el saldo pendiente. */
export interface Abono {
  id: string
  deudaId: string
  /** Interno, ignorable. */
  contextId: string
  montoMinor: number
  receivedByMemberId: string
  receivedAt: string
  nota: string | null
}

/** Registro informal de quien debe: nombre, teléfono y notas opcionales, sin identidad formal. */
export interface Deudor {
  id: string
  nombre: string
  telefono: string | null
  notas: string | null
  contextId: string
  createdAt: string
}

/**
 * Cuota planeada (BE-15): calendario de pagos PURAMENTE INFORMATIVO — nunca
 * afecta el saldo ni el `status` de la deuda. El saldo real sigue siendo
 * `totalMinor - suma(abonos[].montoMinor)`.
 */
export interface CuotaPlaneada {
  id: string
  deudaId: string
  /** Interno, ignorable. */
  contextId: string
  fechaEsperada: string
  montoEsperadoMinor: number
  createdAt: string
}

/** Una cuota planeada a crear (input de `POST /deudas` o `POST .../cuotas`). */
export interface CuotaPlaneadaInput {
  fechaEsperada: string
  /** Entero en centavos, 1..2147483647. */
  montoEsperadoMinor: number
}

/**
 * Forma cruda de una Deuda. `deudor` NO viene en la respuesta de `POST
 * /deudas` (solo en el listado, el detalle y el abono); `abonos` y
 * `cuotasPlaneadas` siempre vienen (vacíos si no aplica). No hay campo de
 * saldo: se calcula en el cliente como `totalMinor - suma(abonos[].montoMinor)`.
 */
export interface Deuda {
  id: string
  type: DeudaType
  deudorId: string
  productId: string
  /** Interno, ignorable. */
  contextId: string
  cantidad: number
  /** Total original (precio del producto al crear × cantidad); no baja con los abonos. */
  totalMinor: number
  status: DeudaStatus
  /** BE-15; snapshot de `Product.purchaseCostMinor` al crear la deuda, nunca estimado ni recalculado. */
  unitCostMinor: number | null
  /** BE-15; instante exacto de liquidación, `null` si sigue pendiente (o se liquidó antes de BE-15). */
  saldadaAt: string | null
  createdByMemberId: string
  createdAt: string
  abonos: Abono[]
  deudor?: Deudor
  /** BE-15; calendario informativo. Presente en todas las respuestas que incluyen `abonos`. */
  cuotasPlaneadas: CuotaPlaneada[]
}

/**
 * Body de `POST /deudas`: exactamente uno de `deudorId` (deudor existente) o
 * `deudor` (crea uno nuevo en la misma transacción) — ninguno o los dos es
 * 400. `abonoInicialMinor` es REQUERIDO desde BE-15 (puede ser `0`); si es
 * mayor a 0 crea el primer abono en la misma transacción atómica — nunca una
 * segunda llamada aparte. `cuotasPlaneadas` es opcional y nunca afecta el
 * saldo/`status`.
 */
export interface CreateDeudaPayload {
  type: DeudaType
  productId: string
  /** Entero, `Min(1)`. */
  cantidad: number
  deudorId?: string
  deudor?: {
    nombre: string
    telefono?: string
    notas?: string
  }
  /** BE-15, requerido; entero 0..2147483647. `0` = sin abono inicial. */
  abonoInicialMinor: number
  /** BE-15, opcional; calendario informativo creado en la misma transacción. */
  cuotasPlaneadas?: CuotaPlaneadaInput[]
}

/** Body de `POST /deudas/:id/abonos`. La respuesta es la DEUDA completa, no el abono suelto. */
export interface CreateAbonoPayload {
  /** Entero en centavos, `Min(1)`. */
  montoMinor: number
  nota?: string
}

/** Body de `PATCH /deudas/:id/cuotas/:cuotaId`: ambos campos opcionales (edición parcial). */
export interface UpdateCuotaPlaneadaPayload {
  fechaEsperada?: string
  montoEsperadoMinor?: number
}

/** Query de `GET /deudas` (BE-15 extiende `sort`/`orderBy`/`atrasado`). */
export interface DeudaListParams {
  status?: DeudaStatus
  /** Nombre del deudor, coincidencia parcial. */
  search?: string
  /** Solo aplica con `orderBy=createdAt` (default del servidor). */
  sort?: DeudaSortOrder
  orderBy?: DeudaOrderBy
  atrasado?: boolean
  page?: number
  limit?: number
}

export interface DeudaListResponse {
  items: Deuda[]
  total: number
  page: number
  limit: number
}
