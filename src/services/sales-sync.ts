/**
 * Motor de sincronización de la cola de ventas offline (contrato §1.6).
 * Framework-agnóstico: todo lo externo entra por `SalesSyncDeps`.
 *
 * Reglas (ninguna venta se pierde ni se reenvía a ciegas):
 * - Procesa SOLO las `pending`, en orden de creación y de UNA en UNA.
 * - Cada venta viaja con su cuerpo congelado y sus propios memberId/deviceId.
 * - 201/200 `completada`                  -> se borra de la cola.
 * - 201/200 `rechazada_por_conflicto`     -> `needs_review` (quien vendió creyó
 *   que estaba hecha: no puede desaparecer en silencio).
 * - 400 y 409 (definitivos)               -> `needs_review`, nunca se reintentan
 *   (§1.6: un stock ya agotado da 400, no un conflicto persistido) y la cola sigue.
 * - Red / 5xx / 401 / 403 / respuesta rara -> DETIENE la corrida; el registro
 *   queda `pending` con un intento más y los demás ni se tocan.
 * - Una sola corrida a la vez: candado en memoria + `navigator.locks` (entre
 *   pestañas) cuando existe. La idempotencia del servidor es la red de seguridad.
 */
import { VOICE } from '@/config/voice'
import { classifySaleError, friendlySaleErrorMessage } from './sale-errors'
import type { PendingSale } from './local-db'
import type { CreateSalePayload, CreateSaleResult } from '@/types/sale.types'

/** Por qué terminó antes de vaciar la cola (`null` = procesó todo lo que había). */
export type SyncStopReason =
  | 'offline'            // el navegador no tiene conexión
  | 'network'            // la petición no obtuvo respuesta
  | 'server'             // 5xx / respuesta inesperada
  | 'auth'               // 401 / 403
  | 'not-authenticated'  // no hay sesión para enviar
  | 'storage'            // IndexedDB falló
  | 'locked-elsewhere'   // otra pestaña está sincronizando

export interface SyncSummary {
  /** Ventas confirmadas por el servidor y quitadas de la cola en esta corrida. */
  synced: number
  /** Ventas que pasaron a `needs_review` en esta corrida. */
  needsReview: number
  /** `pending` que siguen en la cola al terminar. */
  remainingPending: number
  stoppedBecause: SyncStopReason | null
}

export interface SalesSyncDeps {
  createSale: (payload: CreateSalePayload) => Promise<CreateSaleResult>
  queue: {
    list: () => Promise<PendingSale[]>
    remove: (id: string) => Promise<boolean>
    markNeedsReview: (id: string, reason: string) => Promise<boolean>
    recordAttempt: (id: string, reason: string, at?: string) => Promise<boolean>
  }
  isOnline: () => boolean
  /** ¿Hay sesión para enviar? Sin ella no se intenta (un 401 sacaría a la persona al login). */
  canSync: () => boolean
  /** `navigator.locks` o `null` si no existe. */
  locks: LockManager | null
  /** Reloj como ISO 8601 (inyectable para tests). */
  now: () => string
}

export interface SalesSync {
  /** Procesa la cola. Llamadas simultáneas comparten la misma corrida. Nunca lanza. */
  syncPendingSales: () => Promise<SyncSummary>
  isRunning: () => boolean
}

const LOCK_NAME = 'la-marchanta-sales-sync'

const emptySummary = (stoppedBecause: SyncStopReason | null, remainingPending = 0): SyncSummary => ({
  synced: 0,
  needsReview: 0,
  remainingPending,
  stoppedBecause,
})

export function createSalesSync(deps: SalesSyncDeps): SalesSync {
  let inFlight: Promise<SyncSummary> | null = null

  async function countPending(fallback: number): Promise<number> {
    try {
      return (await deps.queue.list()).filter((record) => record.state === 'pending').length
    } catch {
      return fallback
    }
  }

  async function run(): Promise<SyncSummary> {
    if (!deps.isOnline()) {
      return emptySummary('offline', await countPending(0))
    }
    if (!deps.canSync()) {
      return emptySummary('not-authenticated', await countPending(0))
    }

    let records: PendingSale[]
    try {
      records = await deps.queue.list()
    } catch {
      return emptySummary('storage')
    }
    const pending = records.filter((record) => record.state === 'pending')

    let synced = 0
    let needsReview = 0
    let stoppedBecause: SyncStopReason | null = null

    for (const record of pending) {
      if (!deps.isOnline()) {
        stoppedBecause = 'offline'
        break
      }

      let result: CreateSaleResult
      try {
        result = await deps.createSale(record.payload)
      } catch (error) {
        const kind = classifySaleError(error)
        try {
          if (kind === 'business' || kind === 'conflict-payload') {
            // Respuesta definitiva: reintentar no cambiaría nada.
            await deps.queue.markNeedsReview(record.id, friendlySaleErrorMessage(error, 'sync'))
            needsReview++
            continue
          }
          await deps.queue.recordAttempt(record.id, friendlySaleErrorMessage(error, 'sync'), deps.now())
        } catch {
          stoppedBecause = 'storage'
          break
        }
        stoppedBecause = kind
        break
      }

      try {
        if (result.outcome === 'completed') {
          await deps.queue.remove(record.id)
          synced++
        } else {
          await deps.queue.markNeedsReview(record.id, VOICE.sale.conflict)
          needsReview++
        }
      } catch {
        // El servidor ya respondió pero no pudimos actualizar la cola: la
        // venta queda `pending` y su reenvío será un 200 idempotente.
        stoppedBecause = 'storage'
        break
      }
    }

    const remainingPending = await countPending(pending.length - synced - needsReview)
    return { synced, needsReview, remainingPending, stoppedBecause }
  }

  async function runExclusive(): Promise<SyncSummary> {
    const { locks } = deps
    if (!locks) return run()

    try {
      // `ifAvailable`: si otra pestaña ya sincroniza, no esperamos ni duplicamos.
      const summary = await locks.request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
        if (!lock) return null
        return run()
      })
      if (summary) return summary
      return emptySummary('locked-elsewhere', await countPending(0))
    } catch {
      // navigator.locks no disponible o roto: seguimos; la idempotencia cubre la carrera.
      return run()
    }
  }

  function syncPendingSales(): Promise<SyncSummary> {
    if (inFlight) return inFlight
    const current = runExclusive()
      .catch((): SyncSummary => emptySummary('storage'))
      .finally(() => {
        if (inFlight === current) inFlight = null
      })
    inFlight = current
    return current
  }

  return { syncPendingSales, isRunning: () => inFlight !== null }
}
