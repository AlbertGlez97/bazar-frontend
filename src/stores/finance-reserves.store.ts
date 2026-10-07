import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v7 } from 'uuid'
import { FinanceReservesService } from '@/services/finance-reserves.service'
import { currentQueueOrigin } from '@/services/queue-origin'
import { VOICE } from '@/config/voice'
import { useFinanceOverviewStore } from './finance-overview.store'
import {
  isConflict,
  isUncertainFailure,
  reserveErrorMessage,
  reserveExclusiveTo,
  type ReservePeriod,
} from '@/utils/finance-reserves'
import type { FinanceOrigin } from '@/services/contributions-records'
import type {
  ReserveFields,
  ReserveFilter,
  ReserveListItem,
  ReserveStatus,
} from '@/types/finance-reserve.types'

export const RESERVES_PAGE_SIZE = 20

/** What the list shows: the picked period (EXACT match) or every period, and one status. */
export interface ReservesQuery {
  /** Inclusive day keys, as the picker shows them. */
  range: ReservePeriod
  scope: 'period' | 'all'
  status: ReserveStatus
}

/** A write attempt keeps its id AND audit instant: a retry must be byte-identical to be a replay. */
interface Attempt {
  id: string
  occurredAt: string
}
const newAttempt = (): Attempt => ({ id: v7(), occurredAt: new Date().toISOString() })

function filterFor(query: ReservesQuery): ReserveFilter {
  const filter: ReserveFilter = { status: query.status, limit: RESERVES_PAGE_SIZE }
  if (query.scope === 'period') {
    filter.from = query.range.from
    filter.to = reserveExclusiveTo(query.range.to)
  }
  return filter
}

/**
 * Online-only reserves (Finanzas > Reservas). Nothing is stored on the device:
 * saving needs a connection and is never reported as done unless the server
 * confirmed it. The id of a create / cancel is generated once and REUSED by
 * every retry after a network or server failure, so retrying can never create
 * (or cancel) twice. A request-id guard stops a slow response for an old query
 * from replacing a newer one.
 */
export const useFinanceReservesStore = defineStore('finance-reserves', () => {
  const items = ref<ReserveListItem[]>([])
  const nextCursor = ref<string | null>(null)
  /** Query `items` belong to. */
  const shown = ref<ReservesQuery | null>(null)
  const loading = ref(false)
  const loadingMore = ref(false)
  const error = ref('')
  const saving = ref(false)
  const saveError = ref('')
  /** Name of the reserve confirmed by the last successful create (for the status message). */
  const savedName = ref('')
  const cancelling = ref(false)
  /** Id of the reserve whose cancellation request is in flight (empty when none). */
  const cancellingId = ref('')
  const cancelError = ref('')
  /** Id of the reserve `cancelError` belongs to (empty when there is no error). */
  const cancelErrorId = ref('')
  /** Name of the reserve confirmed by the last successful cancellation. */
  const cancelledName = ref('')
  let latest = 0
  let lastQuery: ReservesQuery | null = null
  let createAttempt: Attempt | null = null
  const cancelAttempts = new Map<string, Attempt>()

  function origin(): FinanceOrigin | null {
    return currentQueueOrigin()
  }

  async function load(query: ReservesQuery): Promise<void> {
    const id = ++latest
    lastQuery = { ...query, range: { ...query.range } }
    loading.value = true
    loadingMore.value = false
    error.value = ''
    const current = origin()
    if (!current) {
      loading.value = false
      error.value = VOICE.apiErrors.contextLost
      return
    }
    try {
      const page = await FinanceReservesService.list(current, filterFor(query))
      if (id !== latest) return // a newer request owns the state
      items.value = page.items
      nextCursor.value = page.nextCursor
      shown.value = lastQuery
    } catch (e) {
      if (id !== latest) return
      error.value = reserveErrorMessage(e, 'list') // keep the last confirmed list
    } finally {
      if (id === latest) loading.value = false
    }
  }

  /** Next page of the SAME query, with the cursor unchanged. */
  async function loadMore(): Promise<void> {
    const cursor = nextCursor.value
    const query = shown.value
    const current = origin()
    if (!cursor || !query || !current || loading.value || loadingMore.value) return
    const id = latest
    loadingMore.value = true
    error.value = ''
    try {
      const page = await FinanceReservesService.list(current, { ...filterFor(query), cursor })
      if (id !== latest) return
      const known = new Set(items.value.map((i) => i.id))
      items.value = [...items.value, ...page.items.filter((i) => !known.has(i.id))]
      nextCursor.value = page.nextCursor
    } catch (e) {
      if (id !== latest) return
      error.value = reserveErrorMessage(e, 'list')
    } finally {
      if (id === latest) loadingMore.value = false
    }
  }

  /** Re-reads the list and, when the overview was already loaded, refreshes it so Resumen shows the new reserves. */
  async function refreshAfterWrite(): Promise<void> {
    const overview = useFinanceOverviewStore()
    if (overview.period) void overview.load({ ...overview.period })
    if (lastQuery) await load(lastQuery)
  }

  /** Creates a reserve. Returns true only when the server confirmed it (201 or an exact 200 replay). */
  async function create(fields: ReserveFields): Promise<boolean> {
    if (saving.value) return false
    saveError.value = ''
    savedName.value = ''
    const current = origin()
    if (!current) {
      saveError.value = VOICE.apiErrors.contextLost
      return false
    }
    createAttempt ??= newAttempt()
    const attempt = createAttempt
    saving.value = true
    try {
      const receipt = await FinanceReservesService.create(current, {
        id: attempt.id,
        ...fields,
        currency: 'MXN',
        occurredAt: attempt.occurredAt,
        createdByMemberId: current.memberId,
        deviceId: current.deviceId,
      })
      createAttempt = null // confirmed: the next reserve gets a fresh id
      savedName.value = receipt.name
    } catch (e) {
      saveError.value = reserveErrorMessage(e, 'create')
      // Only a definitive refusal frees the id; an uncertain one must be retried with the same id.
      if (!isUncertainFailure(e)) createAttempt = null
      if (isConflict(e) && lastQuery) void load(lastQuery)
      return false
    } finally {
      saving.value = false
    }
    await refreshAfterWrite()
    return true
  }

  /** Cancels a reserve. Returns true only when the server confirmed the cancellation. */
  async function cancel(reserve: Pick<ReserveListItem, 'id' | 'name'>, reason: string): Promise<boolean> {
    if (cancelling.value) return false
    cancelError.value = ''
    cancelErrorId.value = ''
    cancelledName.value = ''
    const current = origin()
    if (!current) {
      cancelError.value = VOICE.apiErrors.contextLost
      cancelErrorId.value = reserve.id
      return false
    }
    const attempt = cancelAttempts.get(reserve.id) ?? newAttempt()
    cancelAttempts.set(reserve.id, attempt)
    cancelling.value = true
    cancellingId.value = reserve.id
    try {
      await FinanceReservesService.cancel(current, reserve.id, {
        id: attempt.id,
        reason,
        occurredAt: attempt.occurredAt,
        createdByMemberId: current.memberId,
        deviceId: current.deviceId,
      })
      cancelAttempts.delete(reserve.id)
      cancelledName.value = reserve.name
    } catch (e) {
      cancelError.value = reserveErrorMessage(e, 'cancel')
      cancelErrorId.value = reserve.id
      if (!isUncertainFailure(e)) cancelAttempts.delete(reserve.id)
      if (isConflict(e) && lastQuery) void load(lastQuery)
      return false
    } finally {
      cancelling.value = false
      cancellingId.value = ''
    }
    await refreshAfterWrite()
    return true
  }

  /** Forgets the pending create id (the form was cleared on purpose). */
  function discardDraft() {
    createAttempt = null
    saveError.value = ''
  }
  function clearMessages() {
    saveError.value = ''
    savedName.value = ''
    cancelError.value = ''
    cancelErrorId.value = ''
    cancelledName.value = ''
  }

  function reset() {
    latest++
    lastQuery = null
    createAttempt = null
    cancelAttempts.clear()
    items.value = []
    nextCursor.value = null
    shown.value = null
    loading.value = false
    loadingMore.value = false
    error.value = ''
    saving.value = false
    saveError.value = ''
    savedName.value = ''
    cancelling.value = false
    cancellingId.value = ''
    cancelError.value = ''
    cancelErrorId.value = ''
    cancelledName.value = ''
  }

  return {
    items,
    nextCursor,
    shown,
    loading,
    loadingMore,
    error,
    saving,
    saveError,
    savedName,
    cancelling,
    cancellingId,
    cancelError,
    cancelErrorId,
    cancelledName,
    load,
    loadMore,
    create,
    cancel,
    discardDraft,
    clearMessages,
    reset,
  }
})
