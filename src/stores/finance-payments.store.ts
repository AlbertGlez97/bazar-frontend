import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { v7 } from 'uuid'
import { FinancePaymentsService } from '@/services/finance-payments.service'
import { currentQueueOrigin } from '@/services/queue-origin'
import { useAuthStore } from './auth.store'
import { useSessionStore } from './session.store'
import { agreementErrorCode } from '@/utils/finance-agreements'
import { OFFLINE_READ_MESSAGE, OFFLINE_REGISTER_MESSAGE, OFFLINE_REVERSE_MESSAGE,
  PAYMENT_ACCESS_MESSAGE, PaymentFormError, isUncertainPaymentFailure, normalizePaymentFields, paymentErrorMessage,
  paymentReasonText } from '@/utils/finance-payments'
import type { FinanceOrigin } from '@/services/contributions-records'
import type { AgreementPaymentSummary, CreatePaymentPayload, DistributionPayment, PaymentFields,
  ReversePaymentPayload } from '@/types/finance-payment.types'

interface RegisterAttempt { origin: FinanceOrigin; agreementId: string; fields: PaymentFields; payload: CreatePaymentPayload }
interface ReverseAttempt { origin: FinanceOrigin; paymentId: string; payload: ReversePaymentPayload }
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const sameOrigin = (a: FinanceOrigin | null, b: FinanceOrigin): boolean => !!a &&
  a.accountId === b.accountId && a.apiBase === b.apiBase && a.memberId === b.memberId && a.deviceId === b.deviceId
const unconfirmedMessage = 'Hay un intento sin confirmar. Reintenta exactamente ese mismo intento antes de hacer otro.'

/**
 * Online-only, memory-only payment history and exact uncertain attempts.
 * Totals always come from the server; nothing here is persisted, queued or computed optimistically.
 */
export const useFinancePaymentsStore = defineStore('finance-payments', () => {
  const auth = useAuthStore()
  const session = useSessionStore()
  const agreementId = ref<string | null>(null)
  const items = ref<DistributionPayment[]>([])
  const summary = ref<AgreementPaymentSummary | null>(null)
  const loading = ref(false), error = ref('')
  const saving = ref(false), saveError = ref('')
  const registered = ref<DistributionPayment | null>(null)
  const reversing = ref(false), reverseError = ref('')
  const reversedPayment = ref<DistributionPayment | null>(null)
  const registerAttempt = ref<RegisterAttempt | null>(null)
  const reverseAttempt = ref<ReverseAttempt | null>(null)
  const pendingPayment = computed(() => registerAttempt.value ? {
    agreementId: registerAttempt.value.agreementId, payload: copy(registerAttempt.value.payload),
  } : null)
  const pendingReversal = computed(() => reverseAttempt.value ? {
    paymentId: reverseAttempt.value.paymentId, payload: copy(reverseAttempt.value.payload),
  } : null)
  let generation = 0, loadRevision = 0

  function origin(): FinanceOrigin | null {
    if (!auth.token || session.member?.role !== 'socio' || session.member.active !== true) return null
    const current = currentQueueOrigin()
    return current ? { ...current } : null
  }
  const online = () => navigator.onLine
  const current = (run: number, selected: FinanceOrigin) => run === generation && sameOrigin(origin(), selected)

  async function load(id: string): Promise<boolean> {
    const revision = ++loadRevision, run = generation, selected = origin()
    if (agreementId.value !== id) { items.value = []; summary.value = null }
    agreementId.value = id
    loading.value = false
    error.value = ''
    if (!selected) { error.value = PAYMENT_ACCESS_MESSAGE; return false }
    if (!online()) { error.value = OFFLINE_READ_MESSAGE; return false }
    loading.value = true
    try {
      const list = await FinancePaymentsService.list(selected, id)
      if (!current(run, selected) || revision !== loadRevision) return false
      items.value = list.items
      summary.value = list.paymentSummary
      return true
    } catch (cause) {
      if (current(run, selected) && revision === loadRevision) error.value = paymentErrorMessage(cause)
      return false
    } finally {
      if (current(run, selected) && revision === loadRevision) loading.value = false
    }
  }

  async function refreshAfter(id: string, selected: FinanceOrigin, run: number) {
    if (current(run, selected)) await load(id)
  }

  async function sendRegister(attempt: RegisterAttempt): Promise<DistributionPayment | null> {
    const run = generation
    saving.value = true
    saveError.value = ''
    try {
      const payment = await FinancePaymentsService.create(copy(attempt.origin), attempt.agreementId, copy(attempt.payload))
      if (!current(run, attempt.origin)) return null
      registerAttempt.value = null
      registered.value = payment
      saving.value = false
      await refreshAfter(attempt.agreementId, attempt.origin, run)
      return payment
    } catch (cause) {
      if (!current(run, attempt.origin)) return null
      saveError.value = paymentErrorMessage(cause)
      if (!isUncertainPaymentFailure(cause)) registerAttempt.value = null
      return null
    } finally {
      if (current(run, attempt.origin)) saving.value = false
    }
  }
  async function register(id: string, fields: PaymentFields): Promise<DistributionPayment | null> {
    if (saving.value || reversing.value) return null
    saveError.value = ''
    if (reverseAttempt.value) { saveError.value = unconfirmedMessage; return null }
    if (!online()) { saveError.value = OFFLINE_REGISTER_MESSAGE; return null }
    const selected = origin()
    if (!selected) { saveError.value = PAYMENT_ACCESS_MESSAGE; return null }
    let normalized: PaymentFields
    try {
      normalized = normalizePaymentFields(fields)
      if (Date.parse(normalized.occurredAt) > Date.now()) throw new PaymentFormError('La fecha del pago no puede estar en el futuro.')
    } catch (cause) { saveError.value = paymentErrorMessage(cause); return null }
    const previous = registerAttempt.value
    if (previous) {
      if (previous.agreementId !== id || !sameOrigin(selected, previous.origin) || JSON.stringify(normalized) !== JSON.stringify(previous.fields)) {
        saveError.value = unconfirmedMessage
        return null
      }
      return sendRegister(previous)
    }
    const attempt: RegisterAttempt = {
      origin: selected, agreementId: id, fields: copy(normalized), payload: {
        id: v7(), ...normalized, createdByMemberId: selected.memberId, deviceId: selected.deviceId,
      },
    }
    registerAttempt.value = attempt
    registered.value = null
    return sendRegister(attempt)
  }
  /** Replays the exact retained body; the server answers 200 when the first attempt had already succeeded. */
  async function retryRegister(): Promise<DistributionPayment | null> {
    const attempt = registerAttempt.value
    if (!attempt || saving.value || reversing.value) return null
    saveError.value = ''
    if (!online()) { saveError.value = OFFLINE_REGISTER_MESSAGE; return null }
    const selected = origin()
    if (!selected || !sameOrigin(selected, attempt.origin)) { saveError.value = PAYMENT_ACCESS_MESSAGE; return null }
    return sendRegister(attempt)
  }

  async function reverse(paymentId: string, reasonText: string): Promise<DistributionPayment | null> {
    if (saving.value || reversing.value) return null
    reverseError.value = ''
    if (registerAttempt.value) { reverseError.value = unconfirmedMessage; return null }
    if (!online()) { reverseError.value = OFFLINE_REVERSE_MESSAGE; return null }
    const selected = origin()
    if (!selected) { reverseError.value = PAYMENT_ACCESS_MESSAGE; return null }
    let reason: string
    try { reason = paymentReasonText(reasonText) }
    catch (cause) { reverseError.value = paymentErrorMessage(cause); return null }
    const previous = reverseAttempt.value
    if (previous && (previous.paymentId !== paymentId || previous.payload.reason !== reason || !sameOrigin(selected, previous.origin))) {
      reverseError.value = 'Hay una anulación sin confirmar. Reintenta el mismo pago y motivo antes de cambiarlos.'
      return null
    }
    const attempt: ReverseAttempt = previous ?? { origin: selected, paymentId, payload: {
      id: v7(), reason, occurredAt: new Date().toISOString(), createdByMemberId: selected.memberId, deviceId: selected.deviceId,
    } }
    reverseAttempt.value = attempt
    const run = generation
    reversing.value = true
    try {
      const payment = await FinancePaymentsService.reverse(copy(attempt.origin), paymentId, copy(attempt.payload))
      if (!current(run, selected)) return null
      reverseAttempt.value = null
      reversedPayment.value = payment
      reversing.value = false
      await refreshAfter(payment.agreementId, selected, run)
      return payment
    } catch (cause) {
      if (!current(run, selected)) return null
      reverseError.value = paymentErrorMessage(cause)
      if (!isUncertainPaymentFailure(cause)) reverseAttempt.value = null
      if (agreementErrorCode(cause) === 'FINANCE_PAYMENT_ALREADY_VOIDED' && agreementId.value) {
        reversing.value = false
        await refreshAfter(agreementId.value, selected, run)
      }
      return null
    } finally {
      if (current(run, selected)) reversing.value = false
    }
  }

  function clearMessages() { error.value = ''; saveError.value = ''; reverseError.value = '' }
  function reset() {
    generation++; loadRevision++
    agreementId.value = null; items.value = []; summary.value = null
    registered.value = null; reversedPayment.value = null
    registerAttempt.value = null; reverseAttempt.value = null
    loading.value = false; saving.value = false; reversing.value = false
    clearMessages()
  }
  // Store-owned synchronous invalidation also applies when no agreement view is mounted.
  watch([() => auth.token, () => session.owner?.accountId, () => session.owner?.apiBase,
    () => session.memberId, () => session.deviceId, () => session.deviceToken,
    () => session.member?.role, () => session.member?.active], reset, { flush: 'sync' })
  return { agreementId, items, summary, loading, error, saving, saveError, registered, reversing, reverseError, reversedPayment,
    pendingPayment, pendingReversal, load, register, retryRegister, reverse, clearMessages, reset }
})
