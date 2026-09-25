import { defineStore } from 'pinia'
import { onScopeDispose, ref } from 'vue'
import SalesService from '@/services/sales.service'
import * as salesQueue from '@/services/sales-queue'
import type { PendingSale } from '@/services/sales-queue'
import { createSalesSync } from '@/services/sales-sync'
import type { SyncSummary } from '@/services/sales-sync'
import { createSyncScheduler } from '@/services/sales-sync-scheduler'

/**
 * Estado reactivo de la cola de ventas offline para la UI (indicador de
 * "X ventas pendientes de sincronizar") y arranque de la sincronización.
 *
 * Uso desde el shell autenticado:
 *   `onMounted(() => sales.start())` / `onUnmounted(() => sales.stop())`
 * Los contadores se refrescan solos tras cada cambio de la cola (encolar,
 * enviar, revisar, descartar) y tras cada corrida.
 */
export const useSalesQueueStore = defineStore('sales-queue', () => {
  const pendingCount = ref(0)
  const needsReviewCount = ref(0)
  /** Ventas que el servidor no aceptó; `lastError` trae el motivo amable. */
  const needsReviewRecords = ref<PendingSale[]>([])
  const isSyncing = ref(false)
  const lastSummary = ref<SyncSummary | null>(null)
  /** `false` si IndexedDB no respondió en la última lectura (los contadores pueden estar desactualizados). */
  const storageAvailable = ref(true)

  const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false

  const engine = createSalesSync({
    createSale: (payload) => SalesService.createSale(payload),
    queue: salesQueue,
    isOnline,
    // Sin sesión un 401 sacaría a la persona al login; no se intenta.
    canSync: () => !!localStorage.getItem('access_token'),
    locks: typeof navigator !== 'undefined' && 'locks' in navigator ? navigator.locks : null,
    now: () => new Date().toISOString(),
  })

  async function refreshCounts(): Promise<void> {
    try {
      const records = await salesQueue.list()
      pendingCount.value = records.filter((record) => record.state === 'pending').length
      const review = records.filter((record) => record.state === 'needs_review')
      needsReviewCount.value = review.length
      needsReviewRecords.value = review
      storageAvailable.value = true
    } catch {
      // Conserva los últimos contadores conocidos.
      storageAvailable.value = false
    }
  }

  const scheduler = createSyncScheduler({
    sync: engine.syncPendingSales,
    countPending: () => salesQueue.count(),
    isOnline,
    target: typeof window !== 'undefined' ? window : null,
    onSyncStart: () => { isSyncing.value = true },
    onSyncEnd: (summary) => {
      isSyncing.value = false
      lastSummary.value = summary
      void refreshCounts()
    },
  })

  const stopListening = salesQueue.onQueueChange(() => {
    void refreshCounts()
    void scheduler.notifyChange()
  })
  onScopeDispose(() => {
    stopListening()
    scheduler.stop()
  })

  /** Empieza a sincronizar: ahora mismo, al volver la conexión y cada 30 s mientras haya pendientes. */
  async function start(): Promise<void> {
    await refreshCounts()
    await scheduler.start()
  }

  function stop(): void {
    scheduler.stop()
  }

  /** Sincroniza ya (botón "Reintentar"). */
  async function syncNow(): Promise<SyncSummary> {
    const summary = await scheduler.syncNow()
    await refreshCounts()
    return summary
  }

  /** La persona ya leyó una venta en revisión y la descarta. `false` si no era `needs_review`. */
  async function dismissReview(id: string): Promise<boolean> {
    const dismissed = await salesQueue.dismissReview(id)
    await refreshCounts()
    return dismissed
  }

  return {
    pendingCount, needsReviewCount, needsReviewRecords, isSyncing, lastSummary, storageAvailable,
    refreshCounts, start, stop, syncNow, dismissReview,
  }
})
