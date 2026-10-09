import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { v7 } from 'uuid'
import { FinanceAgreementsService } from '@/services/finance-agreements.service'
import { currentQueueOrigin } from '@/services/queue-origin'
import { useAuthStore } from './auth.store'
import { useSessionStore } from './session.store'
import { agreementErrorCode, agreementErrorMessage, agreementReason, isSimulationChanged, isSimulationFingerprint,
  isUncertainAgreementFailure, normalizeAgreementFields } from '@/utils/finance-agreements'
import type { FinanceOrigin } from '@/services/contributions-records'
import type { AgreementFields, AgreementFilter, AgreementListItem, AgreementReversalReceipt,
  CreateAgreementPayload, DistributionAgreement, ReverseAgreementPayload } from '@/types/finance-agreement.types'

interface CreateAttempt { origin: FinanceOrigin; fields: AgreementFields; payload: CreateAgreementPayload }
interface ReverseAttempt { origin: FinanceOrigin; agreementId: string; payload: ReverseAgreementPayload }
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const sameOrigin = (a: FinanceOrigin | null, b: FinanceOrigin): boolean => !!a &&
  a.accountId === b.accountId && a.apiBase === b.apiBase && a.memberId === b.memberId && a.deviceId === b.deviceId

/** Online-only, memory-only snapshots and exact uncertain attempts; no automatic sends or financial movement. */
export const useFinanceAgreementsStore = defineStore('finance-agreements', () => {
  const auth = useAuthStore()
  const session = useSessionStore()
  const items = ref<AgreementListItem[]>([])
  const nextCursor = ref<string | null>(null)
  const shown = ref<AgreementFilter | null>(null)
  const loading = ref(false), loadingMore = ref(false), error = ref('')
  const detail = ref<DistributionAgreement | null>(null)
  const detailLoading = ref(false), detailError = ref(''), detailCurrent = ref(false)
  const saving = ref(false), saveError = ref('')
  const created = ref<DistributionAgreement | null>(null)
  const reversing = ref(false), reverseError = ref('')
  const reversed = ref<AgreementReversalReceipt | null>(null)
  const alreadyVoided = ref(false)
  const simulationChanged = ref(false)
  const createAttempt = ref<CreateAttempt | null>(null)
  const reverseAttempt = ref<ReverseAttempt | null>(null)
  const pendingCreate = computed(() => createAttempt.value ? copy(createAttempt.value.payload) : null)
  const pendingReversal = computed(() => reverseAttempt.value ? {
    agreementId: reverseAttempt.value.agreementId, payload: copy(reverseAttempt.value.payload),
  } : null)
  let generation = 0, listRevision = 0, detailRevision = 0
  let rejectedFingerprint = ''

  function origin(): FinanceOrigin | null {
    if (!auth.token || session.member?.role !== 'socio' || session.member.active !== true) return null
    const current = currentQueueOrigin()
    return current ? { ...current } : null
  }
  function online(): boolean {
    return navigator.onLine
  }
  function current(run: number, selected: FinanceOrigin): boolean {
    return run === generation && sameOrigin(origin(), selected)
  }
  const accessMessage = 'Confirma la sesión, la persona socia y el dispositivo antes de continuar.'
  const offlineMessage = 'Necesitas conexión para consultar o modificar acuerdos. No se enviará ningún intento sin conexión.'

  async function load(filter: AgreementFilter = {}): Promise<void> {
    const revision = ++listRevision, run = generation, selected = origin()
    loading.value = false
    loadingMore.value = false
    error.value = ''
    if (!selected || !online()) { error.value = selected ? offlineMessage : accessMessage; return }
    const query = copy(filter)
    loading.value = true
    try {
      const page = await FinanceAgreementsService.list(selected, query)
      if (!current(run, selected) || revision !== listRevision) return
      items.value = page.items
      nextCursor.value = page.nextCursor
      shown.value = query
    } catch (cause) {
      if (current(run, selected) && revision === listRevision) error.value = agreementErrorMessage(cause)
    } finally {
      if (current(run, selected) && revision === listRevision) loading.value = false
    }
  }
  async function loadMore(): Promise<void> {
    const selected = origin(), cursor = nextCursor.value, filter = shown.value
    if (!selected || !cursor || !filter || loading.value || loadingMore.value) return
    if (!online()) { error.value = offlineMessage; return }
    const revision = listRevision, run = generation
    loadingMore.value = true
    error.value = ''
    try {
      const page = await FinanceAgreementsService.list(selected, { ...copy(filter), cursor })
      if (!current(run, selected) || revision !== listRevision) return
      const known = new Set(items.value.map((item) => item.id))
      items.value = [...items.value, ...page.items.filter((item) => !known.has(item.id))]
      nextCursor.value = page.nextCursor
    } catch (cause) {
      if (current(run, selected) && revision === listRevision) error.value = agreementErrorMessage(cause)
    } finally {
      if (current(run, selected) && revision === listRevision) loadingMore.value = false
    }
  }
  async function loadDetail(id: string): Promise<DistributionAgreement | null> {
    const revision = ++detailRevision, run = generation, selected = origin()
    if (detail.value?.id !== id) detail.value = null
    detailCurrent.value = false
    detailLoading.value = false
    detailError.value = ''
    if (!selected || !online()) { detailError.value = selected ? offlineMessage : accessMessage; return null }
    detailLoading.value = true
    try {
      const document = await FinanceAgreementsService.get(selected, id)
      if (!current(run, selected) || revision !== detailRevision) return null
      detail.value = document
      detailCurrent.value = true
      return document
    } catch (cause) {
      if (current(run, selected) && revision === detailRevision) detailError.value = agreementErrorMessage(cause)
      return null
    } finally {
      if (current(run, selected) && revision === detailRevision) detailLoading.value = false
    }
  }

  async function sendCreate(attempt: CreateAttempt): Promise<DistributionAgreement | null> {
    const run = generation
    saving.value = true
    saveError.value = ''
    try {
      // A copy protects the retained body even if an adapter or caller mutates its argument.
      const document = await FinanceAgreementsService.create(copy(attempt.origin), copy(attempt.payload))
      if (!current(run, attempt.origin)) return null
      createAttempt.value = null
      created.value = document
      simulationChanged.value = false
      rejectedFingerprint = ''
      return document
    } catch (cause) {
      if (!current(run, attempt.origin)) return null
      saveError.value = agreementErrorMessage(cause, attempt.fields.workBasis)
      if (isSimulationChanged(cause)) {
        simulationChanged.value = true
        rejectedFingerprint = attempt.fields.simulationFingerprint
      }
      if (!isUncertainAgreementFailure(cause)) createAttempt.value = null
      return null
    } finally {
      if (current(run, attempt.origin)) saving.value = false
    }
  }
  async function create(fields: AgreementFields): Promise<DistributionAgreement | null> {
    if (saving.value || reversing.value) return null
    if (reverseAttempt.value) {
      saveError.value = 'Hay una anulación sin confirmar. Resuelve ese mismo intento antes de crear un acuerdo.'
      return null
    }
    const selected = origin()
    if (!selected || !online()) { saveError.value = selected ? offlineMessage : accessMessage; return null }
    let normalized: AgreementFields
    try { normalized = normalizeAgreementFields(fields) }
    catch (cause) { saveError.value = agreementErrorMessage(cause); return null }
    if (createAttempt.value) {
      if (!sameOrigin(selected, createAttempt.value.origin) || JSON.stringify(normalized) !== JSON.stringify(createAttempt.value.fields)) {
        saveError.value = 'Hay un intento sin confirmar. Reintenta ese mismo intento antes de cambiar sus datos.'
        return null
      }
      return sendCreate(createAttempt.value)
    }
    if (normalized.simulationFingerprint === rejectedFingerprint) {
      saveError.value = 'Calcula y confirma una nueva simulación antes de crear el acuerdo.'
      return null
    }
    const attempt: CreateAttempt = {
      origin: selected, fields: copy(normalized), payload: {
        ...normalized, id: v7(), occurredAt: new Date().toISOString(),
        createdByMemberId: selected.memberId, deviceId: selected.deviceId,
      },
    }
    createAttempt.value = attempt
    created.value = null
    return sendCreate(attempt)
  }
  /** Exact replay is safe even after financial drift; it must precede any new creation. */
  async function retryCreate(): Promise<DistributionAgreement | null> {
    const attempt = createAttempt.value, selected = origin()
    if (!attempt || saving.value || reversing.value || reverseAttempt.value) return null
    if (!selected || !sameOrigin(selected, attempt.origin) || !online()) {
      saveError.value = selected && online() ? accessMessage : offlineMessage
      return null
    }
    return sendCreate(attempt)
  }

  async function reverse(id: string, reasonText: string): Promise<AgreementReversalReceipt | null> {
    if (saving.value || reversing.value) return null
    if (createAttempt.value) {
      reverseError.value = 'Hay un acuerdo sin confirmar. Resuelve ese mismo intento antes de anular otro acuerdo.'
      return null
    }
    const selected = origin()
    if (!selected || !online()) { reverseError.value = selected ? offlineMessage : accessMessage; return null }
    let reason: string
    try { reason = agreementReason(reasonText) }
    catch (cause) { reverseError.value = agreementErrorMessage(cause); return null }
    const previous = reverseAttempt.value
    if (previous && (previous.agreementId !== id || previous.payload.reason !== reason || !sameOrigin(selected, previous.origin))) {
      reverseError.value = 'Hay una anulación sin confirmar. Reintenta el mismo acuerdo y motivo antes de cambiarlos.'
      return null
    }
    const attempt = previous ?? { origin: selected, agreementId: id, payload: {
      id: v7(), reason, occurredAt: new Date().toISOString(), createdByMemberId: selected.memberId, deviceId: selected.deviceId,
    } }
    reverseAttempt.value = attempt
    const run = generation
    reversing.value = true
    reverseError.value = ''
    alreadyVoided.value = false
    try {
      const receipt = await FinanceAgreementsService.reverse(copy(attempt.origin), id, copy(attempt.payload))
      if (!current(run, selected)) return null
      reverseAttempt.value = null
      reversed.value = receipt
      // The receipt's original remains active: never pretend that it is the live detail projection.
      detailRevision++
      detailCurrent.value = false
      detailLoading.value = false
      return receipt
    } catch (cause) {
      if (!current(run, selected)) return null
      reverseError.value = agreementErrorMessage(cause)
      alreadyVoided.value = agreementErrorCode(cause) === 'FINANCE_AGREEMENT_ALREADY_VOIDED'
      if (alreadyVoided.value) detailCurrent.value = false
      if (!isUncertainAgreementFailure(cause)) reverseAttempt.value = null
      return null
    } finally {
      if (current(run, selected)) reversing.value = false
    }
  }
  /** Call only after the server successfully recalculated a simulation; never discard an uncertain write. */
  function acceptSimulation(fingerprint: string) {
    if (!isSimulationFingerprint(fingerprint) || createAttempt.value || saving.value) return
    rejectedFingerprint = ''
    simulationChanged.value = false
  }
  function clearMessages() { error.value = ''; detailError.value = ''; saveError.value = ''; reverseError.value = '' }
  function reset() {
    generation++; listRevision++; detailRevision++
    items.value = []; nextCursor.value = null; shown.value = null
    detailCurrent.value = false; alreadyVoided.value = false
    detail.value = null; created.value = null; reversed.value = null
    createAttempt.value = null; reverseAttempt.value = null
    loading.value = false; loadingMore.value = false; detailLoading.value = false
    saving.value = false; reversing.value = false
    simulationChanged.value = false; rejectedFingerprint = ''
    clearMessages()
  }
  // Store-owned synchronous invalidation also applies when no agreement view is mounted.
  watch([() => auth.token, () => session.owner?.accountId, () => session.owner?.apiBase,
    () => session.memberId, () => session.deviceId, () => session.deviceToken,
    () => session.member?.role, () => session.member?.active], reset, { flush: 'sync' })
  return { items, nextCursor, shown, loading, loadingMore, error, detail, detailLoading, detailError,
    detailCurrent, alreadyVoided, saving, saveError, created, reversing, reverseError, reversed, simulationChanged,
    pendingCreate, pendingReversal, acceptSimulation, load, loadMore, loadDetail, create, retryCreate, reverse, clearMessages, reset }
})
