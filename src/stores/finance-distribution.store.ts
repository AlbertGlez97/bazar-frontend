import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { FinanceDistributionService } from '@/services/finance-distribution.service'
import { FinanceOverviewService } from '@/services/finance-overview.service'
import { isContractError, isMissingRoute, overviewErrorMessage, overviewExclusiveTo } from '@/utils/finance-overview'
import { sameRequest, simulationErrorMessage, type SimulatorPeriod } from '@/utils/finance-distribution'
import type { DistributionSimulation, DistributionSimulationRequest } from '@/types/finance-distribution.types'

/** What the simulator needs from the overview: the amount it may start from. */
export interface SimulatorBase {
  /** Inclusive picker days this base was read for. */
  period: SimulatorPeriod
  potentiallyAvailableMinor: number
  status: 'complete' | 'partial'
}

/**
 * Ephemeral, online-only simulator state (Finanzas > Simulador). Nothing is
 * persisted anywhere: the last result lives in memory only and is wiped by
 * `reset()` when the session or attribution changes (see `auth.store`). The
 * pre-base is read through the overview service WITHOUT touching the Resumen
 * store. Request-id guards make sure a slow response can never replace a newer
 * state, nor repopulate the store after a reset.
 */
export const useFinanceDistributionStore = defineStore('finance-distribution', () => {
  const base = ref<SimulatorBase | null>(null)
  const baseLoading = ref(false)
  const baseError = ref('')
  /** False when retrying cannot help (unexpected shape, route missing). */
  const baseRetryable = ref(true)
  /** Set by a failed refresh of the SAME period (so `base` is an older confirmed copy). */
  const baseRefreshFailed = ref(false)

  const result = ref<DistributionSimulation | null>(null)
  /** The exact body that produced `result`; the view compares it with the current inputs. */
  const resultRequest = ref<DistributionSimulationRequest | null>(null)
  const simulating = ref(false)
  const error = ref('')
  // Eligibility is independent of dismissible presentation errors.
  const resultInvalidated = ref(false)
  let latestBase = 0
  let latestSimulation = 0

  const baseIsStale = computed(() => baseRefreshFailed.value && !!base.value)

  function baseMatchesResult(): boolean {
    const current = base.value
    const simulation = result.value
    return !!current && !!simulation &&
      current.period.from === simulation.period.from &&
      overviewExclusiveTo(current.period.to) === simulation.period.to &&
      current.potentiallyAvailableMinor === simulation.financialBase.potentiallyAvailableMinor &&
      current.status === simulation.financialBase.status
  }

  /** Callers must also check access, connection and unapplied picker edits. */
  function isResultEligible(request: DistributionSimulationRequest | null): boolean {
    return !!result.value && !resultInvalidated.value && !simulating.value &&
      !baseLoading.value && !baseError.value && !baseIsStale.value &&
      sameRequest(request, resultRequest.value) && baseMatchesResult()
  }

  /** Preserve the displayed snapshot, but revoke it and any in-flight recalculation. */
  function invalidateResult() {
    latestSimulation++
    resultInvalidated.value = true
    simulating.value = false
  }

  async function loadBase(period: SimulatorPeriod): Promise<void> {
    const id = ++latestBase
    baseLoading.value = true
    baseError.value = ''
    // An amount read for another period would mislead: only the same period keeps its last copy.
    const current = base.value
    if (current && (current.period.from !== period.from || current.period.to !== period.to)) {
      base.value = null
      baseRefreshFailed.value = false
    }
    try {
      const overview = await FinanceOverviewService.get(period.from, overviewExclusiveTo(period.to))
      if (id !== latestBase) return
      base.value = {
        period: { ...period },
        potentiallyAvailableMinor: overview.result.potentiallyAvailableMinor,
        status: overview.result.status,
      }
      baseRefreshFailed.value = false
      baseRetryable.value = true
      if (result.value && !baseMatchesResult()) invalidateResult()
    } catch (cause) {
      if (id !== latestBase) return
      baseError.value = overviewErrorMessage(cause)
      baseRetryable.value = !isContractError(cause) && !isMissingRoute(cause)
      baseRefreshFailed.value = true
      invalidateResult()
    } finally {
      if (id === latestBase) baseLoading.value = false
    }
  }

  /** Runs one simulation. Resolves true only when the server answered with a valid, current result. */
  async function simulate(request: DistributionSimulationRequest): Promise<boolean> {
    if (simulating.value) return false // no double submit
    const id = ++latestSimulation
    simulating.value = true
    resultInvalidated.value = true
    error.value = ''
    try {
      const simulation = await FinanceDistributionService.simulate(request)
      if (id !== latestSimulation) return false
      result.value = simulation
      resultRequest.value = { ...request }
      resultInvalidated.value = false
      return true
    } catch (cause) {
      if (id !== latestSimulation) return false
      // The last successful result (if any) stays visible, marked as an older configuration.
      error.value = simulationErrorMessage(cause, request.workBasis)
      return false
    } finally {
      if (id === latestSimulation) simulating.value = false
    }
  }

  function clearError() {
    error.value = ''
  }

  /** "Nueva simulación": forgets the result and ignores any request still in flight. */
  function clearResult() {
    latestSimulation++
    result.value = null
    resultRequest.value = null
    resultInvalidated.value = false
    simulating.value = false
    error.value = ''
  }

  function reset() {
    latestBase++
    latestSimulation++
    base.value = null
    baseLoading.value = false
    baseError.value = ''
    baseRetryable.value = true
    baseRefreshFailed.value = false
    result.value = null
    resultRequest.value = null
    resultInvalidated.value = false
    simulating.value = false
    error.value = ''
  }

  return {
    base,
    baseLoading,
    baseError,
    baseRetryable,
    baseIsStale,
    result,
    resultRequest,
    simulating,
    error,
    loadBase,
    simulate,
    isResultEligible,
    invalidateResult,
    clearError,
    clearResult,
    reset,
  }
})
