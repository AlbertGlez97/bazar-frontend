<template>
  <section
    class="agreement-payments"
    aria-labelledby="agreement-payments-title"
    data-test="agreement-payments"
  >
    <h2
      id="agreement-payments-title"
      ref="heading"
      tabindex="-1"
    >
      Pagos
    </h2>
    <p data-test="payments-intro">
      Aquí se anota lo que ya se pagó fuera del sistema. {{ PAYMENT_ONLY_RECORDS_COPY }} Lo acordado no es lo mismo que lo pagado.
    </p>
    <p
      v-if="notice"
      role="status"
      data-test="payment-notice"
    >
      {{ notice }}
    </p>
    <p
      v-if="agreementStatus === 'voided'"
      data-test="payments-voided-notice"
    >
      {{ VOIDED_AGREEMENT_PAYMENTS_COPY }}
    </p>
    <p
      v-if="store.loading && !summary"
      role="status"
      data-test="payments-loading"
    >
      Consultando los pagos…
    </p>
    <AppAlert
      v-if="store.error"
      type="error"
      title="No se pudieron consultar los pagos"
      data-test="payments-error"
    >
      <p>{{ store.error }}</p>
      <AppButton
        type="button"
        variant="ghost"
        :disabled="!online || store.loading"
        data-test="retry-payments"
        @click="emit('reload')"
      >
        Reintentar consulta de pagos
      </AppButton>
    </AppAlert>
    <AppAlert
      v-if="store.pendingPayment?.agreementId === agreementId"
      type="warning"
      title="Pago sin confirmar"
      data-test="pending-payment-alert"
    >
      <p>La respuesta de un pago no se confirmó. Revisa y reintenta exactamente el mismo pago; no se duplicará.</p>
      <AppButton
        type="button"
        data-test="open-pending-payment"
        @click="openPendingPayment"
      >
        Revisar pago pendiente
      </AppButton>
    </AppAlert>
    <AppAlert
      v-if="pendingReversalPayment"
      type="warning"
      title="Anulación de pago sin confirmar"
      data-test="pending-reversal-alert"
    >
      <p>La respuesta de una anulación no se confirmó. Reintenta exactamente la misma anulación; no se duplicará.</p>
      <AppButton
        type="button"
        data-test="open-pending-reversal"
        @click="openPendingReversal"
      >
        Revisar anulación pendiente
      </AppButton>
    </AppAlert>
    <template v-if="summary">
      <AppCard>
        <h3>Estado de pago del acuerdo</h3>
        <AppBadge
          :color="paymentProgressColor(summary.status)"
          data-test="payment-status"
        >
          {{ paymentProgressLabel(summary.status) }}
        </AppBadge>
        <dl class="payment-figures">
          <div>
            <dt>Acordado</dt><dd data-test="summary-agreed">
              {{ formatMinorMoney(summary.agreedMinor) }}
            </dd>
          </div>
          <div>
            <dt>Pagado</dt><dd data-test="summary-paid">
              {{ formatMinorMoney(summary.paidMinor) }}
            </dd>
          </div>
          <div>
            <dt>Pendiente</dt><dd data-test="summary-pending">
              {{ formatMinorMoney(summary.pendingMinor) }}
            </dd>
          </div>
        </dl>
      </AppCard>
      <ul
        class="payment-people"
        data-test="payment-participants"
      >
        <li
          v-for="person in summary.participants"
          :key="person.memberId"
        >
          <AppCard data-test="payment-person">
            <h3>{{ person.memberName }}</h3>
            <AppBadge
              :color="paymentProgressColor(person.status)"
              data-test="participant-payment-status"
            >
              {{ paymentProgressLabel(person.status) }}
            </AppBadge>
            <dl class="payment-figures">
              <div>
                <dt>Acordado</dt><dd data-test="person-agreed">
                  {{ formatMinorMoney(person.agreedMinor) }}
                </dd>
              </div>
              <div>
                <dt>Pagado</dt><dd data-test="person-paid">
                  {{ formatMinorMoney(person.paidMinor) }}
                </dd>
              </div>
              <div>
                <dt>Pendiente</dt><dd data-test="person-pending">
                  {{ formatMinorMoney(person.pendingMinor) }}
                </dd>
              </div>
            </dl>
            <AppButton
              v-if="agreementStatus === 'active' && (person.status === 'UNPAID' || person.status === 'PARTIALLY_PAID')"
              type="button"
              data-test="open-register-payment"
              :aria-label="'Registrar pago de ' + person.memberName"
              :disabled="registerBlocked"
              @click="openRegister(person)"
            >
              Registrar pago
            </AppButton>
            <p v-if="person.status === 'PAID'">
              Esta persona ya recibió todo lo acordado.
            </p>
            <h4>Historial de pagos</h4>
            <p
              v-if="!paymentsOf(person.memberId).length"
              data-test="payment-history-empty"
            >
              Todavía no hay pagos registrados para esta persona.
            </p>
            <ul
              v-else
              class="payment-history"
              data-test="payment-history"
            >
              <li
                v-for="payment in paymentsOf(person.memberId)"
                :key="payment.id"
                data-test="payment-row"
              >
                <p class="payment-history__main">
                  <strong data-test="payment-amount">{{ formatMinorMoney(payment.amountMinor) }}</strong>
                  <span data-test="payment-date">{{ formatPaymentDate(payment.occurredAt) }}</span>
                  <AppBadge
                    v-if="payment.status === 'voided'"
                    color="red"
                    data-test="payment-voided-badge"
                  >
                    ANULADO
                  </AppBadge>
                </p>
                <p v-if="payment.note">
                  Nota: {{ payment.note }}
                </p>
                <p>Registrado por {{ payment.createdBy.name }}</p>
                <template v-if="payment.reversal">
                  <p data-test="payment-reversal-reason">
                    Motivo: {{ payment.reversal.reason }}
                  </p>
                  <p>Anulado el {{ formatPaymentDate(payment.reversal.occurredAt) }} por {{ payment.reversal.createdBy.name }}.</p>
                </template>
                <AppButton
                  v-if="payment.status === 'active'"
                  type="button"
                  variant="ghost"
                  data-test="open-reverse-payment"
                  :aria-label="'Anular pago de ' + formatMinorMoney(payment.amountMinor) + ' de ' + payment.participantName"
                  :disabled="reverseBlocked"
                  @click="openReverse(payment)"
                >
                  Anular pago
                </AppButton>
              </li>
            </ul>
            <p v-if="person.status === 'NOT_DUE'">
              Esta persona no tiene un monto acordado, así que no se pueden registrar pagos.
            </p>
          </AppCard>
        </li>
      </ul>
    </template>
    <AgreementPaymentForm
      v-model="registerOpen"
      :participant="formParticipant"
      :busy="store.saving"
      :error="store.saveError"
      :online="online"
      :pending="pendingForThisAgreement"
      @submit="submitRegister"
      @retry="retryRegister"
    />
    <AgreementPaymentReverseForm
      v-model="reverseOpen"
      :payment="reverseTarget"
      :busy="store.reversing"
      :error="store.reverseError"
      :online="online"
      :pending="pendingReversePayload"
      @confirm="confirmReverse"
      @retry="retryReverse"
    />
  </section>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { AppAlert, AppBadge, AppButton, AppCard } from '@/components'
import { useFinancePaymentsStore } from '@/stores/finance-payments.store'
import { formatMinorMoney } from '@/utils/money'
import { PAYMENT_ONLY_RECORDS_COPY, VOIDED_AGREEMENT_PAYMENTS_COPY, formatPaymentDate, paymentProgressColor,
  paymentProgressLabel } from '@/utils/finance-payments'
import AgreementPaymentForm from './AgreementPaymentForm.vue'
import AgreementPaymentReverseForm from './AgreementPaymentReverseForm.vue'
import type { AgreementStatus } from '@/types/finance-agreement.types'
import type { AgreementPaymentSummary, DistributionPayment, ParticipantPaymentSummary, PaymentFields } from '@/types/finance-payment.types'

const props = defineProps<{
  agreementId: string
  agreementStatus: AgreementStatus
  summary: AgreementPaymentSummary | null
  online: boolean
}>()
const emit = defineEmits<{ reload: []; changed: [] }>()
const store = useFinancePaymentsStore()
const heading = ref<HTMLElement | null>(null)
const registerOpen = ref(false), reverseOpen = ref(false), notice = ref('')
const registerPerson = ref<ParticipantPaymentSummary | null>(null), reverseTarget = ref<DistributionPayment | null>(null)

const history = computed(() => store.agreementId === props.agreementId ? store.items : [])
const paymentsOf = (memberId: string) => history.value.filter((payment) => payment.participantMemberId === memberId)
const pendingForThisAgreement = computed(() =>
  store.pendingPayment?.agreementId === props.agreementId ? store.pendingPayment.payload : null)
const pendingReversalPayment = computed(() => history.value.find((payment) => payment.id === store.pendingReversal?.paymentId) ?? null)
const formParticipant = computed(() => {
  const pending = pendingForThisAgreement.value
  if (!pending) return registerPerson.value
  return props.summary?.participants.find((person) => person.memberId === pending.participantMemberId) ?? registerPerson.value
})
const pendingReversePayload = computed(() =>
  reverseTarget.value && store.pendingReversal?.paymentId === reverseTarget.value.id ? store.pendingReversal.payload : null)
const busy = computed(() => store.saving || store.reversing)
const registerBlocked = computed(() => busy.value || !!store.pendingPayment || !!store.pendingReversal)
const reverseBlocked = computed(() => busy.value || !!store.pendingPayment || !!store.pendingReversal)

function openRegister(person: ParticipantPaymentSummary) {
  if (registerBlocked.value) return
  store.saveError = ''; notice.value = ''
  registerPerson.value = person
  registerOpen.value = true
}
function openPendingPayment() {
  if (busy.value || !pendingForThisAgreement.value) return
  store.saveError = ''; notice.value = ''
  registerOpen.value = true
}
function openReverse(payment: DistributionPayment) {
  if (reverseBlocked.value) return
  store.reverseError = ''; notice.value = ''
  reverseTarget.value = payment
  reverseOpen.value = true
}
function openPendingReversal() {
  if (busy.value || !pendingReversalPayment.value) return
  store.reverseError = ''; notice.value = ''
  reverseTarget.value = pendingReversalPayment.value
  reverseOpen.value = true
}
async function settle() {
  await nextTick()
  const active = document.activeElement
  if (!active || active === document.body) heading.value?.focus()
}
async function finishRegister(payment: DistributionPayment | null, id: string) {
  if (!payment || props.agreementId !== id) return
  registerOpen.value = false
  notice.value = store.error
    ? 'Pago registrado, pero no pudimos actualizar los totales. Actualiza la consulta de pagos.'
    : 'Pago registrado. Los totales se actualizaron desde el servidor.'
  emit('changed')
  await settle()
}
async function submitRegister(fields: PaymentFields) {
  const id = props.agreementId
  await finishRegister(await store.register(id, fields), id)
}
async function retryRegister() {
  const id = props.agreementId
  await finishRegister(await store.retryRegister(), id)
}
async function sendReverse(reason: string) {
  const id = props.agreementId, target = reverseTarget.value
  if (!target) return
  const payment = await store.reverse(target.id, reason)
  if (!payment || props.agreementId !== id) return
  reverseOpen.value = false
  notice.value = store.error
    ? 'Pago anulado, pero no pudimos actualizar los totales. Actualiza la consulta de pagos.'
    : 'Pago anulado. Se conserva en el historial como ANULADO y los totales se actualizaron desde el servidor.'
  emit('changed')
  await settle()
}
async function confirmReverse(reason: string) {
  if (store.pendingReversal) return
  await sendReverse(reason)
}
async function retryReverse() {
  const attempt = store.pendingReversal
  if (!attempt || attempt.paymentId !== reverseTarget.value?.id) return
  await sendReverse(attempt.payload.reason)
}
watch(() => props.agreementId, () => {
  registerOpen.value = false; reverseOpen.value = false; notice.value = ''
  registerPerson.value = null; reverseTarget.value = null
})
</script>
<style scoped>
.agreement-payments { display: grid; gap: var(--spacing-md); min-width: 0; overflow-wrap: anywhere; }
.agreement-payments p { margin: 0; }
.payment-people { display: grid; gap: var(--spacing-md); grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)); list-style: none; padding: 0; margin: 0; }
.payment-people > li { min-width: 0; }
.payment-figures { display: grid; gap: var(--spacing-sm); margin: var(--spacing-sm) 0; }
.payment-figures div { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--spacing-sm); }
.payment-figures dt { color: var(--color-text-muted); }
.payment-figures dd { margin: 0; font-weight: 700; font-variant-numeric: tabular-nums; }
.payment-history { display: grid; gap: var(--spacing-sm); list-style: none; padding: 0; margin: 0; }
.payment-history > li { display: grid; gap: var(--spacing-xs, 0.25rem); padding: var(--spacing-sm) 0; border-top: 1px solid var(--color-border); }
.payment-history__main { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-sm); }
h2, h3, h4 { margin: 0 0 var(--spacing-sm); }
h4 { margin-top: var(--spacing-md); }
</style>
