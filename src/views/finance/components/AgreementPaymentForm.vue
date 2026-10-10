<template>
  <AppModal
    :model-value="modelValue"
    title="Registrar pago"
    manage-focus
    hide-footer
    :hide-close="busy"
    :close-on-backdrop="!busy"
    @update:model-value="close"
  >
    <form
      v-if="participant"
      class="payment-form"
      novalidate
      :aria-busy="busy"
      @submit.prevent="submit"
    >
      <p data-test="payment-records-only">
        {{ PAYMENT_ONLY_RECORDS_COPY }} Registra solo pagos reales.
      </p>
      <dl class="payment-form__figures">
        <div>
          <dt>Participante</dt><dd data-test="form-participant">
            {{ participant.memberName }}
          </dd>
        </div>
        <div>
          <dt>Acordado</dt><dd data-test="form-agreed">
            {{ formatMinorMoney(participant.agreedMinor) }}
          </dd>
        </div>
        <div>
          <dt>Ya pagado</dt><dd data-test="form-paid">
            {{ formatMinorMoney(participant.paidMinor) }}
          </dd>
        </div>
        <div>
          <dt>Pendiente</dt><dd data-test="form-pending">
            {{ formatMinorMoney(participant.pendingMinor) }}
          </dd>
        </div>
      </dl>
      <p
        v-if="pending"
        role="status"
        data-test="payment-pending-notice"
      >
        La respuesta no se confirmó. Reintentar enviará exactamente el mismo pago, fecha e identificador; no creará otro pago.
      </p>
      <div class="payment-form__amount">
        <AppInput
          id="payment-amount"
          v-model="amountText"
          label="Monto del pago (MXN)"
          inputmode="decimal"
          autocomplete="off"
          placeholder="0.00"
          required
          :disabled="busy || !!pending"
        />
        <AppButton
          type="button"
          variant="ghost"
          data-test="use-pending"
          :disabled="busy || !!pending || participant.pendingMinor < 1"
          @click="usePending"
        >
          Usar pendiente completo
        </AppButton>
      </div>
      <AppInput
        id="payment-when"
        v-model="whenText"
        type="datetime-local"
        label="Fecha y hora del pago (hora de México, UTC−6)"
        required
        :max="maxWhen"
        :disabled="busy || !!pending"
      />
      <AppTextarea
        id="payment-note"
        v-model="note"
        label="Nota (opcional)"
        :maxlength="1000"
        :rows="3"
        :disabled="busy || !!pending"
      />
      <p
        v-if="!online"
        role="alert"
        data-test="payment-offline"
      >
        {{ OFFLINE_REGISTER_MESSAGE }}
      </p>
      <p
        v-if="busy"
        role="status"
      >
        Registrando el pago…
      </p>
      <p
        v-if="error || formError"
        ref="errorBox"
        role="alert"
        tabindex="-1"
        data-test="payment-error"
      >
        {{ formError || error }}
      </p>
      <div class="payment-form__actions">
        <AppButton
          v-if="pending"
          type="button"
          data-test="retry-payment"
          :disabled="!online || busy"
          :loading="busy"
          @click="retry"
        >
          Reintentar el mismo pago
        </AppButton>
        <AppButton
          v-else
          type="submit"
          data-test="submit-payment"
          :disabled="!online || busy"
          :loading="busy"
        >
          Registrar pago
        </AppButton>
        <AppButton
          type="button"
          variant="ghost"
          data-test="cancel-payment"
          :disabled="busy"
          @click="close(false)"
        >
          Cancelar
        </AppButton>
      </div>
    </form>
  </AppModal>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { AppButton, AppInput, AppModal, AppTextarea } from '@/components'
import { formatMinorMoney, minorToDisplay, parseMoneyText } from '@/utils/money'
import { OFFLINE_REGISTER_MESSAGE, PAYMENT_ONLY_RECORDS_COPY, businessDateTimeInput, instantFromBusinessInput,
  overpaymentMessage } from '@/utils/finance-payments'
import type { CreatePaymentPayload, ParticipantPaymentSummary, PaymentFields } from '@/types/finance-payment.types'

const props = defineProps<{
  modelValue: boolean
  participant: ParticipantPaymentSummary | null
  busy: boolean
  error: string
  online: boolean
  pending: CreatePaymentPayload | null
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; submit: [fields: PaymentFields]; retry: [] }>()
const amountText = ref(''), whenText = ref(''), note = ref(''), formError = ref(''), errorBox = ref<HTMLElement | null>(null)
const maxWhen = computed(() => props.modelValue ? businessDateTimeInput() : undefined)

function fill() {
  formError.value = ''
  if (props.pending) {
    amountText.value = minorToDisplay(props.pending.amountMinor)
    whenText.value = businessDateTimeInput(new Date(props.pending.occurredAt))
    note.value = props.pending.note ?? ''
  } else {
    amountText.value = ''; whenText.value = businessDateTimeInput(); note.value = ''
  }
}
watch(() => props.modelValue, (open) => { if (open) fill() }, { immediate: true })
watch(() => props.pending, (pending) => { if (pending && props.modelValue) fill() })
watch(() => props.error, async (error) => { if (error && props.modelValue) { await nextTick(); errorBox.value?.focus() } })

/** Only fills the amount; it never submits. */
function usePending() {
  if (props.participant && !props.busy && !props.pending) { amountText.value = minorToDisplay(props.participant.pendingMinor); formError.value = '' }
}
function close(open: boolean) { if (!props.busy) emit('update:modelValue', open) }
function retry() { if (props.online && !props.busy && props.pending) emit('retry') }
async function fail(message: string) { formError.value = message; await nextTick(); errorBox.value?.focus() }
async function submit() {
  const person = props.participant
  if (!person || !props.online || props.busy || props.pending) return
  const minor = parseMoneyText(amountText.value)
  if (minor === null) return fail('Escribe un monto válido, por ejemplo 1,250.50.')
  if (minor < 1) return fail('El monto debe ser mayor a cero.')
  if (minor > person.pendingMinor) return fail(overpaymentMessage(person.agreedMinor, person.paidMinor, person.pendingMinor))
  const occurredAt = instantFromBusinessInput(whenText.value)
  if (!occurredAt) return fail('Escribe una fecha y hora válidas para el pago.')
  if (Date.parse(occurredAt) > Date.now()) return fail('La fecha del pago no puede estar en el futuro.')
  if (note.value.trim().length > 1000) return fail('La nota admite hasta 1000 caracteres.')
  formError.value = ''
  emit('submit', { participantMemberId: person.memberId, amountMinor: minor, occurredAt, note: note.value.trim() || null })
}
</script>
<style scoped>
.payment-form { display: grid; gap: var(--spacing-md); overflow-wrap: anywhere; min-width: 0; }
.payment-form p { margin: 0; }
.payment-form__figures { display: grid; gap: var(--spacing-sm); margin: 0; }
.payment-form__figures div { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--spacing-sm); }
.payment-form__figures dt { color: var(--color-text-muted); }
.payment-form__figures dd { margin: 0; font-weight: 600; font-variant-numeric: tabular-nums; }
.payment-form__amount { display: grid; gap: var(--spacing-sm); }
.payment-form__actions { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); }
[role='alert'] { color: var(--color-danger); }
</style>
