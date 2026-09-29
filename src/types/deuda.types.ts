// Contrato real de bazar-api para el módulo Deudas (doc/api-contract-for-
// frontend.md §10, verificado literalmente contra los DTOs reales; ver
// odd/tasks/ajustes-ux-incidencias-fiado.md). Una Deuda es de UN SOLO producto
// y cantidad — nunca un carrito. `fiado` y `apartado` se tratan idéntico en el
// servidor (ambos descuentan stock de inmediato al crearse); es solo una
// etiqueta para el socio.
export type DeudaType = 'fiado' | 'apartado'
export type DeudaStatus = 'pendiente' | 'saldada'

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
 * Forma cruda de una Deuda. `deudor` NO viene en la respuesta de `POST
 * /deudas` (solo en el listado, el detalle y el abono); `abonos` siempre
 * viene, vacío en la creación. No hay campo de saldo: se calcula en el
 * cliente como `totalMinor - suma(abonos[].montoMinor)`.
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
  createdByMemberId: string
  createdAt: string
  abonos: Abono[]
  deudor?: Deudor
}

/**
 * Body de `POST /deudas`: exactamente uno de `deudorId` (deudor existente) o
 * `deudor` (crea uno nuevo en la misma transacción) — ninguno o los dos es
 * 400. No existe ningún campo de abono inicial (confirmado ausente del DTO).
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
}

/** Body de `POST /deudas/:id/abonos`. La respuesta es la DEUDA completa, no el abono suelto. */
export interface CreateAbonoPayload {
  /** Entero en centavos, `Min(1)`. */
  montoMinor: number
  nota?: string
}
