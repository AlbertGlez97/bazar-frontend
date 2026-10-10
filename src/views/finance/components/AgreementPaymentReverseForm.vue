<template>
  <AppModal
    :model-value="modelValue"
    title="Anular pago"
    manage-focus
    hide-footer
    :hide-close="busy"
    :close-on-backdrop="!busy"
    @update:model-value="close"
  >
    <form
      v-if="payment"
      class="payment-reverse"
      novalidate
      :aria-busy="busy"
      @submit.prevent="submit"
    >
      <p data-test="reverse-summary">
        Vas a anular el pago de {{ formatMinorMoney(payment.amountMinor) }} de {{ payment.participantName }}
        del {{ formatPaymentDate(payment.occurredAt) }}. El pago no se borra: queda en el historial como ANULADO y el
        pendiente de la persona vuelve a subir. Esto no devuelve dinero; solo corrige el registro. Para corregir un
        error, anula el pago y luego registra el pago correcto.
      </p>
      <p
        v-if="pending"
        role="status"
        data-test="reverse-pending-notice"
      >
        La respuesta no se confirmó. Reintentar enviará exactamente el mismo motivo, fecha e identificador; no creará otra anulación.
      </p>
      <AppTextarea
        id="payment-reverse-reason"
        v-model="reason"
        label="Motivo de anulación"
        required
        :maxlength="1000"
        :rows="4"
        :disabled="busy || !!pending"
      />
      <p
        v-if="!online"
        role="alert"
        data-test="reverse-offline"
      >
        {{ OFFLINE_REVERSE_MESSAGE }}
      </p>
      <p
        v-if="busy"
        role="status"
      >
        Confirmando la anulación…
      </p>
      <p
        v-if="error || formError"
        ref="errorBox"
        role="alert"
        tabindex="-1"
        data-test="reverse-error"
      >
        {{ formError || error }}
      </p>
      <div class="payment-reverse__actions">
        <AppButton
          v-if="pending"
          type="button"
          data-test="retry-payment-reverse"
          :disabled="!online || busy"
          :loading="busy"
          @click="retry"
        >
          Reintentar la misma anulación
        </AppButton>
        <AppButton
          v-else
          type="submit"
          data-test="confirm-payment-reverse"
          :disabled="!online || busy || !reason.trim() || reason.trim().length > 1000"
          :loading="busy"
        >
          Confirmar anulación del pago
        </AppButton>
        <AppButton
          type="button"
          variant="ghost"
          data-test="cancel-payment-reverse"
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
import { nextTick, ref, watch } from 'vue'
import { AppButton, AppModal, AppTextarea } from '@/components'
import { formatMinorMoney } from '@/utils/money'
import { OFFLINE_REVERSE_MESSAGE, PaymentFormError, formatPaymentDate, paymentErrorMessage, paymentReasonText } from '@/utils/finance-payments'
import type { DistributionPayment, ReversePaymentPayload } from '@/types/finance-payment.types'

const props = defineProps<{
  modelValue: boolean
  payment: DistributionPayment | null
  busy: boolean
  error: string
  online: boolean
  pending: ReversePaymentPayload | null
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; confirm: [reason: string]; retry: [] }>()
const reason = ref(''), formError = ref(''), errorBox = ref<HTMLElement | null>(null)
watch(() => props.modelValue, (open) => { if (open) { reason.value = props.pending?.reason ?? ''; formError.value = '' } }, { immediate: true })
watch(() => props.pending, (pending) => { if (pending) reason.value = pending.reason })
watch(() => props.error, async (error) => { if (error && props.modelValue) { await nextTick(); errorBox.value?.focus() } })
function close(open: boolean) { if (!props.busy) emit('update:modelValue', open) }
function retry() { if (props.online && !props.busy && props.pending) emit('retry') }
async function submit() {
  if (!props.online || props.busy || props.pending) return
  try { emit('confirm', paymentReasonText(reason.value)); formError.value = '' }
  catch (cause) {
    formError.value = cause instanceof PaymentFormError ? cause.message : paymentErrorMessage(cause)
    await nextTick(); errorBox.value?.focus()
  }
}
</script>
<style scoped>
.payment-reverse { display: grid; gap: var(--spacing-md); overflow-wrap: anywhere; min-width: 0; }
.payment-reverse p { margin: 0; }
.payment-reverse__actions { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); }
[role='alert'] { color: var(--color-danger); }
</style>
