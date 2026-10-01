/**
 * Cola de ventas offline sobre IndexedDB (`pending-sales`).
 *
 * Una venta entra a la cola con el cuerpo de POST /sales ya CONGELADO (mismo
 * `id`, `occurredAt`, partidas y efectivo): así cada reintento es idéntico y el
 * servidor lo reconoce como reenvío idempotente (§1.6). Un registro solo sale
 * de la cola tras una respuesta definitiva del servidor o si una persona lo
 * descarta a propósito (`dismissReview`).
 *
 * Política de errores: `enqueue` devuelve `{ ok: false }` si no se pudo guardar
 * (para que el cobro NUNCA finja que la venta quedó a salvo); el resto lanza
 * `LocalDbUnavailableError` cuando IndexedDB no responde y el llamador decide.
 */
import { PENDING_SALES_STORE, openLocalDb } from './local-db'
import type { PendingOperation } from './local-db'
import type { CreateSalePayload } from '@/types/sale.types'

export type { PendingSale, PendingDebt, PendingOperation, PendingSaleState } from './local-db'

export interface EnqueueInput {
  /** Cuerpo exacto de POST /sales; se guarda una copia. */
  payload: CreateSalePayload
  /** ISO 8601; por omisión, ahora. */
  createdAt?: string
  sellerName?: string
  totalMinorEstimate: number
  changeMinorEstimate: number
}

export type EnqueueResult =
  | { ok: true; record: PendingOperation; alreadyQueued: boolean }
  | { ok: false; reason: 'storage-unavailable' }

// ── Avisos de cambio ────────────────────────────────────────────────────────
// La UI (store de la cola) se entera de cada cambio para refrescar sus contadores.
type Listener = () => void
const listeners = new Set<Listener>()

/** Suscribe a los cambios de la cola. Devuelve la función para darse de baja. */
export function onQueueChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function notifyChange(): void {
  for (const listener of [...listeners]) {
    try {
      listener()
    } catch {
      // Un listener defectuoso no debe romper la operación ni a los demás.
    }
  }
}

function clonePlain<T>(value: T): T {
  // JSON round-trip: copia profunda y sin proxies reactivos (IndexedDB no los clona).
  return JSON.parse(JSON.stringify(value)) as T
}

function byCreation(a: PendingOperation, b: PendingOperation): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * Encola una venta. Idempotente por `id`: si ya existe NO se crea otra ni se
 * toca su cuerpo congelado (devuelve el registro guardado con `alreadyQueued`).
 */
export interface EnqueueDebtInput {
  payload: import('./local-db').PendingDebt['payload']
  origin: import('./local-db').PendingDebt['origin']
  createdAt?: string
  sellerName?: string
  totalMinorEstimate: number
  pendingMinorEstimate: number
}

export function enqueue(input: EnqueueInput): Promise<EnqueueResult> {
  return enqueueOperation(input)
}

export function enqueueDebt(input: EnqueueDebtInput): Promise<EnqueueResult> {
  return enqueueOperation(input, true)
}

async function enqueueOperation(input: EnqueueInput | EnqueueDebtInput, debt = false): Promise<EnqueueResult> {
  try {
    const db = await openLocalDb()
    const tx = db.transaction(PENDING_SALES_STORE, 'readwrite')
    const existing = await tx.store.get(input.payload.id)
    if (existing) {
      await tx.done
      return { ok: true, record: existing, alreadyQueued: true }
    }

    const common = {
      id: input.payload.id,
      createdAt: input.createdAt ?? new Date().toISOString(),
      state: 'pending' as const,
      attempts: 0,
      totalMinorEstimate: input.totalMinorEstimate,
      ...(input.sellerName ? { sellerName: input.sellerName } : {}),
    }
    const record: PendingOperation = debt
      ? { ...common, kind: 'debt', payload: clonePlain((input as EnqueueDebtInput).payload),
          origin: clonePlain((input as EnqueueDebtInput).origin), pendingMinorEstimate: (input as EnqueueDebtInput).pendingMinorEstimate }
      : { ...common, payload: clonePlain((input as EnqueueInput).payload), changeMinorEstimate: (input as EnqueueInput).changeMinorEstimate }
    await tx.store.add(record)
    await tx.done
    notifyChange()
    return { ok: true, record, alreadyQueued: false }
  } catch {
    return { ok: false, reason: 'storage-unavailable' }
  }
}

/** Todos los registros, del más antiguo al más nuevo (por `createdAt` y luego `id`). */
export async function list(): Promise<PendingOperation[]> {
  const db = await openLocalDb()
  return (await db.getAll(PENDING_SALES_STORE)).sort(byCreation)
}

async function countByState(state: PendingOperation['state']): Promise<number> {
  return (await list()).filter((record) => record.state === state).length
}

/** Ventas `pending` (por enviar). */
export function count(): Promise<number> {
  return countByState('pending')
}

/** Ventas `needs_review` (el servidor no las aceptó; una persona debe revisarlas). */
export function countNeedsReview(): Promise<number> {
  return countByState('needs_review')
}

/** Lee-modifica-escribe un registro dentro de una sola transacción. `false` si no existe o `change` devuelve `null`. */
async function update(id: string, change: (record: PendingOperation) => PendingOperation | null): Promise<boolean> {
  const db = await openLocalDb()
  const tx = db.transaction(PENDING_SALES_STORE, 'readwrite')
  const current = await tx.store.get(id)
  const next = current ? change(current) : null
  if (!next) {
    await tx.done
    return false
  }
  await tx.store.put(next)
  await tx.done
  notifyChange()
  return true
}

/** Pasa la venta a `needs_review` con el motivo (texto amable) y deja de reintentarse. */
export function markNeedsReview(id: string, reason: string): Promise<boolean> {
  return update(id, (record) => ({ ...record, state: 'needs_review', lastError: reason }))
}

/** Anota un intento fallido (sigue `pending`): suma `attempts` y guarda el motivo y la hora. */
export function recordAttempt(id: string, reason: string, at: string = new Date().toISOString()): Promise<boolean> {
  return update(id, (record) => ({
    ...record,
    attempts: record.attempts + 1,
    lastError: reason,
    lastAttemptAt: at,
  }))
}

/** Borra el registro (tras una respuesta definitiva del servidor). */
export async function remove(id: string): Promise<boolean> {
  const db = await openLocalDb()
  const tx = db.transaction(PENDING_SALES_STORE, 'readwrite')
  const existing = await tx.store.get(id)
  if (!existing) {
    await tx.done
    return false
  }
  await tx.store.delete(id)
  await tx.done
  notifyChange()
  return true
}

/**
 * La persona ya leyó una venta en `needs_review` y la descarta. Solo funciona
 * con `needs_review`: una venta `pending` todavía no llegó al servidor y jamás
 * se descarta desde aquí.
 */
export async function dismissReview(id: string): Promise<boolean> {
  const db = await openLocalDb()
  const tx = db.transaction(PENDING_SALES_STORE, 'readwrite')
  const existing = await tx.store.get(id)
  if (!existing || existing.state !== 'needs_review') {
    await tx.done
    return false
  }
  await tx.store.delete(id)
  await tx.done
  notifyChange()
  return true
}

