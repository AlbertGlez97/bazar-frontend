/**
 * Programador de la sincronización de ventas: decide CUÁNDO llamar al motor
 * (sales-sync.ts). Framework-agnóstico; el store de Pinia lo envuelve.
 *
 * Disparadores:
 * - al iniciar (`start()`), de inmediato;
 * - evento `online` de la ventana (también reinicia el backoff);
 * - un temporizador cada 30 s SOLO mientras haya pendientes y haya red, con
 *   backoff exponencial ante fallos consecutivos (30 s, 60 s, 120 s... tope 5 min);
 * - `notifyChange()` cuando la cola cambia (p. ej. tras encolar una venta).
 *
 * Con la cola vacía o sin red no hay temporizadores: la app queda en calma.
 */
import type { SyncStopReason, SyncSummary } from './sales-sync'

export const DEFAULT_SYNC_INTERVAL_MS = 30_000
export const DEFAULT_SYNC_MAX_BACKOFF_MS = 300_000

/** Estos motivos NO son un fallo que amerite esperar más. */
const NOT_A_FAILURE: ReadonlySet<SyncStopReason | null> = new Set([null, 'offline', 'locked-elsewhere'])

export interface SchedulerDeps {
  /** Corrida del motor (nunca debería lanzar; si lo hace cuenta como fallo). */
  sync: () => Promise<SyncSummary>
  /** Ventas `pending` ahora mismo. */
  countPending: () => Promise<number>
  isOnline: () => boolean
  /** Origen de los eventos `online`/`offline` (`window`); `null` si no hay. */
  target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> | null
  onSyncStart?: () => void
  onSyncEnd?: (summary: SyncSummary) => void
  intervalMs?: number
  maxBackoffMs?: number
  /** Inyectables para tests; por omisión los globales. */
  setTimer?: (callback: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

export interface SyncScheduler {
  /** Empieza a escuchar y hace una primera revisión. Idempotente. */
  start: () => Promise<void>
  /** Deja de escuchar y cancela el temporizador. */
  stop: () => void
  /** Avisa que la cola cambió: arma el temporizador si hay pendientes. */
  notifyChange: () => Promise<void>
  /** Sincroniza ya (botón "Reintentar"); funciona aunque no esté iniciado. */
  syncNow: () => Promise<SyncSummary>
}

export function createSyncScheduler(deps: SchedulerDeps): SyncScheduler {
  const intervalMs = deps.intervalMs ?? DEFAULT_SYNC_INTERVAL_MS
  const maxBackoffMs = deps.maxBackoffMs ?? DEFAULT_SYNC_MAX_BACKOFF_MS
  const setTimer = deps.setTimer ?? ((callback, ms) => setTimeout(callback, ms))
  const clearTimer = deps.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>))

  let started = false
  let timer: unknown = null
  let failures = 0

  function cancelTimer(): void {
    if (timer !== null) {
      clearTimer(timer)
      timer = null
    }
  }

  /** 30 s tras un éxito o el primer fallo; luego se duplica hasta el tope. */
  function nextDelay(): number {
    return Math.min(maxBackoffMs, intervalMs * 2 ** Math.max(0, failures - 1))
  }

  function arm(): void {
    if (!started || timer !== null || !deps.isOnline()) return
    timer = setTimer(() => {
      timer = null
      void tick()
    }, nextDelay())
  }

  async function safeCountPending(): Promise<number> {
    try {
      return await deps.countPending()
    } catch {
      return 0
    }
  }

  async function runSync(): Promise<SyncSummary> {
    deps.onSyncStart?.()
    let summary: SyncSummary
    try {
      summary = await deps.sync()
    } catch {
      summary = { synced: 0, needsReview: 0, remainingPending: await safeCountPending(), stoppedBecause: 'storage' }
    }
    deps.onSyncEnd?.(summary)

    failures = NOT_A_FAILURE.has(summary.stoppedBecause) ? 0 : failures + 1
    if (started && summary.remainingPending > 0) arm()
    return summary
  }

  async function tick(): Promise<void> {
    if (!started) return
    cancelTimer()
    if (!deps.isOnline()) return
    if ((await safeCountPending()) === 0) {
      failures = 0
      return
    }
    await runSync()
  }

  function handleOnline(): void {
    failures = 0
    void tick()
  }

  function handleOffline(): void {
    cancelTimer()
  }

  async function start(): Promise<void> {
    if (started) return
    started = true
    deps.target?.addEventListener('online', handleOnline)
    deps.target?.addEventListener('offline', handleOffline)
    await tick()
  }

  function stop(): void {
    started = false
    deps.target?.removeEventListener('online', handleOnline)
    deps.target?.removeEventListener('offline', handleOffline)
    cancelTimer()
  }

  async function notifyChange(): Promise<void> {
    if (!started || timer !== null || !deps.isOnline()) return
    if ((await safeCountPending()) > 0) arm()
  }

  async function syncNow(): Promise<SyncSummary> {
    if (!deps.isOnline()) {
      return { synced: 0, needsReview: 0, remainingPending: await safeCountPending(), stoppedBecause: 'offline' }
    }
    cancelTimer()
    return runSync()
  }

  return { start, stop, notifyChange, syncNow }
}
