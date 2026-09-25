/**
 * Base de datos local (IndexedDB) de La Marchanta: `la-marchanta` v1.
 *
 * - `pending-sales`   (keyPath `id`): la cola de ventas offline (ver sales-queue.ts).
 * - `catalog-snapshot` (clave fija `current`): la última copia del catálogo activo,
 *   para poder vender aunque se recargue la app sin internet.
 *
 * Reglas:
 * - La conexión se abre PEREZOSAMENTE y se reutiliza.
 * - IndexedDB puede no existir o lanzar (modo privado, permisos, disco lleno):
 *   `openLocalDb` lanza `LocalDbUnavailableError` y NUNCA deja una promesa rota
 *   en caché, así que un fallo pasajero no inutiliza la base para siempre.
 * - Nada aquí finge éxito: quien guarda una venta debe enterarse si no se pudo.
 */
import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { CreateSalePayload } from '@/types/sale.types'
import type { Product } from '@/types/product.types'

export const DB_NAME = 'la-marchanta'
export const DB_VERSION = 1
export const PENDING_SALES_STORE = 'pending-sales'
export const CATALOG_SNAPSHOT_STORE = 'catalog-snapshot'
const SNAPSHOT_KEY = 'current'

/** Estado de una venta en la cola. */
export type PendingSaleState = 'pending' | 'needs_review'

/** Registro de la cola offline. El `payload` se congela al encolar y no cambia. */
export interface PendingSale {
  id: string
  /** Cuerpo exacto de POST /sales (mismo `id`, `occurredAt`, partidas y efectivo en cada reintento). */
  payload: CreateSalePayload
  /** ISO 8601; ordena la cola junto con `id`. */
  createdAt: string
  state: PendingSaleState
  attempts: number
  /** Último motivo (texto amable en español) de un intento fallido o de una revisión pendiente. */
  lastError?: string
  lastAttemptAt?: string
  /** Nombre de quien vendió, solo para mostrarlo. */
  sellerName?: string
  /** Total y cambio calculados en el dispositivo, solo para mostrarlos (el servidor recalcula). */
  totalMinorEstimate: number
  changeMinorEstimate: number
}

/** Copia local del catálogo activo. */
export interface CatalogSnapshot {
  /** ISO 8601 del momento en que se guardó. */
  savedAt: string
  items: Product[]
}

interface CatalogSnapshotRecord extends CatalogSnapshot {
  key: typeof SNAPSHOT_KEY
}

interface LaMarchantaDB extends DBSchema {
  'pending-sales': { key: string; value: PendingSale }
  'catalog-snapshot': { key: string; value: CatalogSnapshotRecord }
}

export type LocalDb = IDBPDatabase<LaMarchantaDB>

export class LocalDbUnavailableError extends Error {
  /** Error original del navegador (SecurityError, QuotaExceeded...), si lo hubo. */
  readonly originalError: unknown

  constructor(originalError?: unknown) {
    super('IndexedDB no está disponible en este navegador')
    this.name = 'LocalDbUnavailableError'
    this.originalError = originalError
  }
}

let dbPromise: Promise<LocalDb> | null = null

/** Abre (o reutiliza) la base. Lanza `LocalDbUnavailableError` si no se puede. */
export function openLocalDb(): Promise<LocalDb> {
  if (dbPromise) return dbPromise

  const opening = (async () => {
    if (typeof indexedDB === 'undefined' || !indexedDB) {
      throw new LocalDbUnavailableError()
    }
    try {
      const db = await openDB<LaMarchantaDB>(DB_NAME, DB_VERSION, {
        upgrade(database) {
          if (!database.objectStoreNames.contains(PENDING_SALES_STORE)) {
            database.createObjectStore(PENDING_SALES_STORE, { keyPath: 'id' })
          }
          if (!database.objectStoreNames.contains(CATALOG_SNAPSHOT_STORE)) {
            database.createObjectStore(CATALOG_SNAPSHOT_STORE, { keyPath: 'key' })
          }
        },
        // Otra pestaña pide subir de versión: soltamos la conexión para no bloquearla.
        blocking() {
          closeLocalDb()
        },
        // El navegador cerró la conexión por su cuenta: la próxima operación reabre.
        terminated() {
          dbPromise = null
        },
      })
      return db
    } catch (cause) {
      throw new LocalDbUnavailableError(cause)
    }
  })()

  dbPromise = opening
  // Una apertura fallida no se queda en caché: el siguiente intento vuelve a probar.
  opening.catch(() => {
    if (dbPromise === opening) dbPromise = null
  })
  return opening
}

/** Cierra la conexión y olvida la caché; la próxima operación reabre (útil tras un cambio de entorno o en tests). */
export function closeLocalDb(): void {
  const closing = dbPromise
  dbPromise = null
  closing?.then((db) => db.close()).catch(() => undefined)
}

/**
 * Guarda el snapshot del catálogo (reemplaza el anterior). Devuelve `false` si
 * no se pudo guardar; nunca lanza.
 */
export async function saveCatalogSnapshot(
  items: Product[],
  savedAt: string = new Date().toISOString(),
): Promise<boolean> {
  try {
    const db = await openLocalDb()
    // JSON round-trip: quita proxies reactivos de Vue, que IndexedDB no puede clonar.
    const plain = JSON.parse(JSON.stringify(items)) as Product[]
    await db.put(CATALOG_SNAPSHOT_STORE, { key: SNAPSHOT_KEY, savedAt, items: plain })
    return true
  } catch {
    return false
  }
}

/** Último snapshot guardado, o `null` si no hay o IndexedDB no está disponible. Nunca lanza. */
export async function loadCatalogSnapshot(): Promise<CatalogSnapshot | null> {
  try {
    const db = await openLocalDb()
    const record = await db.get(CATALOG_SNAPSHOT_STORE, SNAPSHOT_KEY)
    if (!record || !Array.isArray(record.items)) return null
    return { savedAt: record.savedAt, items: record.items }
  } catch {
    return null
  }
}
