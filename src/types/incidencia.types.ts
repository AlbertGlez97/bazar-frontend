// Contrato real de bazar-api para el módulo Incidencias (doc/api-contract-for-
// frontend.md §7, verificado literalmente contra los DTOs reales). Solo socios
// (`SocioGuard` a nivel de controlador). Una incidencia nace sola, al procesar
// una venta: conflicto de stock (`conflicto_stock`) o fecha `occurredAt` fuera
// de rango (`incidencia_fecha`). Nunca se crea a mano desde el frontend.
import type { SaleItem } from './sale.types'

export type IncidenciaType = 'conflicto_stock' | 'incidencia_fecha'
export type IncidenciaResolutionStatus = 'pendiente' | 'resuelta'
export type IncidenciaSortOrder = 'asc' | 'desc'

/** Forma de una incidencia (registro crudo), tal como la devuelve GET /incidencias — sin la venta. */
export interface Incidencia {
  id: string
  saleId: string
  /** Interno, ignorable. */
  contextId: string
  type: IncidenciaType
  /** Texto explicativo generado por el servidor. */
  reason: string
  detectedAt: string
  resolutionStatus: IncidenciaResolutionStatus
  resolvedByMemberId: string | null
  resolvedAt: string | null
  resolutionNotes: string | null
}

/**
 * Partida de la venta anidada de GET /incidencias/:id: registro crudo de
 * Prisma, a diferencia de `SaleItem` (§6) trae también `saleId`/`contextId`.
 */
export interface IncidenciaSaleItem extends SaleItem {
  saleId: string
  contextId: string
}

/**
 * Venta anidada que SOLO devuelve GET /incidencias/:id (registro crudo de
 * Prisma, incluye `contextId`/`requestFingerprint`, que en `Sale` normal son
 * opcionales/ignorables).
 */
export interface IncidenciaSale {
  id: string
  memberId: string
  deviceId: string
  occurredAt: string
  receivedAt: string
  currency: 'MXN'
  status: 'completada' | 'rechazada_por_conflicto'
  totalMinor: number | null
  cashReceivedMinor: number
  changeMinor: number | null
  conflictReason: string | null
  conflictDetectedAt: string | null
  contextId: string
  requestFingerprint: string | null
  items: IncidenciaSaleItem[]
}

/** GET /incidencias/:id: la incidencia MÁS su venta anidada — solo aquí se expone la venta. */
export interface IncidenciaWithSale extends Incidencia {
  sale: IncidenciaSale
}

/** Query de GET /incidencias. `resolutionStatus` ausente = todas. `sort` por `detectedAt`, default `desc`. */
export interface IncidenciaListParams {
  type?: IncidenciaType
  resolutionStatus?: IncidenciaResolutionStatus
  /** Nombre del VENDEDOR de la venta relacionada, no del resolutor. */
  search?: string
  sort?: IncidenciaSortOrder
  page?: number
  limit?: number
}

export interface IncidenciaListResponse {
  items: Incidencia[]
  total: number
  page: number
  limit: number
}

/** Body de PATCH /incidencias/:id/resolver. Requerido, 1..2000 caracteres. */
export interface ResolverIncidenciaPayload {
  resolutionNotes: string
}
