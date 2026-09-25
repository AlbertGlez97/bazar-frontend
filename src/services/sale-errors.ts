/**
 * Clasificación de errores de POST /sales (doc/api-contract-for-frontend.md
 * §1.6 y §1.8) y su traducción a la voz de La Marchanta.
 *
 * Es el ÚNICO lugar que decide qué hacer con un fallo de envío: la cola
 * offline y el flujo de cobro lo usan para no reintentar para siempre una
 * venta que el servidor ya rechazó (400/409) y, a la vez, no perder nunca una
 * venta por un fallo transitorio (red, 5xx, sesión).
 */
import { VOICE } from '@/config/voice'

export type SaleErrorKind =
  | 'network'          // sin respuesta: se reintenta (el resultado es desconocido)
  | 'server'           // 5xx / transitorio / respuesta que no es una venta: se reintenta
  | 'auth'             // 401 / 403: la venta se conserva; hay que volver a iniciar sesión
  | 'business'         // 400 y demás 4xx definitivos: NO se reintenta
  | 'conflict-payload' // 409: mismo id con otros datos; NO se reintenta

/** Contexto para el copy: cobro en vivo (carrito editable) o sincronización de una venta ya hecha. */
export type SaleErrorContext = 'checkout' | 'sync'

/**
 * Un 2xx cuya forma no es una venta reconocible (HTML de un portal cautivo o
 * de un proxy, `status` desconocido, id ajeno). Nunca se toma como éxito: se
 * clasifica `server` y la venta queda pendiente.
 */
export class UnexpectedSaleResponseError extends Error {
  readonly httpStatus: number

  constructor(httpStatus: number) {
    super(`Respuesta inesperada de POST /sales (HTTP ${httpStatus})`)
    this.name = 'UnexpectedSaleResponseError'
    this.httpStatus = httpStatus
  }
}

interface HttpLike {
  response?: { status?: number; data?: unknown }
}

function statusOf(error: unknown): number | undefined {
  const status = (error as HttpLike | null)?.response?.status
  return typeof status === 'number' ? status : undefined
}

/**
 * - Sin `response` (ERR_NETWORK, timeout, offline)     -> `network`
 * - `UnexpectedSaleResponseError`                        -> `server`
 * - 5xx, 408, 429 (transitorios)                        -> `server`
 * - 401, 403                                            -> `auth`
 * - 409                                                 -> `conflict-payload`
 * - 400 y cualquier otro 4xx (413, 404, 422...)         -> `business`
 *
 * Los otros 4xx son `business` a propósito: la cola se detiene ante `server`,
 * así que un 4xx que nunca cambiará dejaría toda la fila bloqueada detrás de
 * una sola venta.
 */
export function classifySaleError(error: unknown): SaleErrorKind {
  if (error instanceof UnexpectedSaleResponseError) return 'server'
  const status = statusOf(error)
  if (status === undefined) return 'network'
  if (status >= 500 || status === 408 || status === 429) return 'server'
  if (status === 401 || status === 403) return 'auth'
  if (status === 409) return 'conflict-payload'
  return 'business'
}

/** `message` del cuerpo del error, normalizado a arreglo (§1.8). `[]` si no hay uno utilizable. */
export function extractSaleErrorMessages(error: unknown): string[] {
  const data = (error as HttpLike | null)?.response?.data
  if (!data || typeof data !== 'object') return []
  const message = (data as { message?: unknown }).message
  if (message === undefined || message === null) return []
  const list = Array.isArray(message) ? message : [message]
  return list.filter((entry): entry is string => typeof entry === 'string')
}

/**
 * Texto para la persona. Nunca expone el mensaje crudo del servidor (inglés,
 * con ids): mapea los 400 documentados en §6 y cae en un mensaje genérico de
 * venta para cualquier otro.
 */
export function friendlySaleErrorMessage(error: unknown, context: SaleErrorContext = 'checkout'): string {
  const sync = context === 'sync'
  const kind = classifySaleError(error)

  if (kind === 'network') return VOICE.networkError
  if (kind === 'server') return VOICE.genericError
  if (kind === 'auth') return VOICE.sale.authNeeded
  if (kind === 'conflict-payload') return sync ? VOICE.sale.syncPayloadConflict : VOICE.sale.payloadConflict

  const text = extractSaleErrorMessages(error).join(' | ')
  if (/insufficient stock/i.test(text)) {
    return sync ? VOICE.sale.syncInsufficientStock : VOICE.sale.insufficientStock
  }
  if (/cash received is insufficient/i.test(text)) {
    return sync ? VOICE.sale.syncCashInsufficient : VOICE.sale.cashInsufficient
  }
  if (/is deactivated/i.test(text)) {
    return sync ? VOICE.sale.syncProductDeactivated : VOICE.sale.productDeactivated
  }
  if (/does not exist/i.test(text)) {
    return sync ? VOICE.sale.syncProductMissing : VOICE.sale.productMissing
  }
  return sync ? VOICE.sale.syncRejectedGeneric : VOICE.sale.rejectedGeneric
}
