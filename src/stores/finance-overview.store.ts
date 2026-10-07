import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { FinanceOverviewService } from '@/services/finance-overview.service'
import { WorkShiftsService } from '@/services/work-shifts.service'
import { currentQueueOrigin } from '@/services/queue-origin'
import { isContractError, overviewErrorMessage, overviewExclusiveTo } from '@/utils/finance-overview'
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
    const [overviewResult, partnerResult] = await Promise.allSettled([
      FinanceOverviewService.get(next.from, toExclusive),
      fetchPartners(next.from, toExclusive),
    ])
    if (id !== latest) return // a newer request owns the state
    loading.value = false
    if (overviewResult.status === 'rejected') {
      error.value = overviewErrorMessage(overviewResult.reason)
      retryable.value = !isContractError(overviewResult.reason)
      refreshFailed.value = true
      return // keep the last confirmed overview and its partners untouched
    }
    refreshFailed.value = false
    retryable.value = true
    overview.value = overviewResult.value
    period.value = { ...next }
    partners.value = partnerResult.status === 'fulfilled' ? partnerResult.value : null
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
