import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { FinanceOverviewService } from '@/services/finance-overview.service'
import { WorkShiftsService } from '@/services/work-shifts.service'
import { currentQueueOrigin } from '@/services/queue-origin'
import { isContractError, isMissingRoute, overviewErrorMessage, overviewExclusiveTo } from '@/utils/finance-overview'
import type { FinanceOverview } from '@/types/finance-overview.types'
import type { WorkShiftSummary } from '@/types/work-shift.types'

/** Inclusive day keys, exactly as the range picker shows them. */
export interface OverviewPeriod {
  from: string
  to: string
}

/**
 * Online-only overview (Finanzas > Resumen). Nothing is stored on the device:
 * the last confirmed response lives in memory so a failed refresh can keep
 * showing it, labelled as the last confirmed one. A request-id guard makes
 * sure a slow response for an old period can never replace a newer one.
 */
export const useFinanceOverviewStore = defineStore('finance-overview', () => {
  const overview = ref<FinanceOverview | null>(null)
  /** Period (picker days) of `overview` and `partners`; they always belong together. */
  const period = ref<OverviewPeriod | null>(null)
  /** Per-partner jornadas for the SAME period, or null when unavailable. */
  const partners = ref<WorkShiftSummary | null>(null)
  const loading = ref(false)
  const error = ref('')
  /** False when retrying cannot help (the server answered with an unexpected shape). */
  const retryable = ref(true)
  /** Set by a failed refresh and cleared only by a successful load or reset, so it survives retries. */
  const refreshFailed = ref(false)
  let latest = 0

  /** True when the last refresh failed and `overview` is an older confirmed copy. */
  const isStale = computed(() => refreshFailed.value && !!overview.value)

  async function fetchPartners(from: string, toExclusive: string): Promise<WorkShiftSummary | null> {
    const origin = currentQueueOrigin()
    if (!origin) return null
    try {
      return await WorkShiftsService.summary(origin, { from, to: toExclusive })
    } catch {
      return null // degrade: the overview totals are still shown
    }
  }

  async function load(next: OverviewPeriod): Promise<void> {
    const id = ++latest
    loading.value = true
    error.value = ''
    const toExclusive = overviewExclusiveTo(next.to)
    // Optional detail starts concurrently but never delays publishing the overview.
    const partnerRequest = fetchPartners(next.from, toExclusive)
    try {
      const result = await FinanceOverviewService.get(next.from, toExclusive)
      if (id !== latest) return
      refreshFailed.value = false
      retryable.value = true
      overview.value = result
      period.value = { ...next }
      partners.value = null
      void partnerRequest.then((detail) => {
        if (id === latest) partners.value = detail
      })
    } catch (cause) {
      if (id !== latest) return
      error.value = overviewErrorMessage(cause)
      retryable.value = !isContractError(cause) && !isMissingRoute(cause)
      refreshFailed.value = true
      // Keep the last confirmed overview and its matching partners untouched.
    } finally {
      if (id === latest) loading.value = false
    }
  }

  function reset() {
    latest++
    overview.value = null
    period.value = null
    partners.value = null
    loading.value = false
    error.value = ''
    retryable.value = true
    refreshFailed.value = false
  }

  return { overview, period, partners, loading, error, retryable, isStale, load, reset }
})
