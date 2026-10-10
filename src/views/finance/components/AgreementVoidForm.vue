<template>
  <AppModal
    :model-value="modelValue"
    title="Anular acuerdo"
    manage-focus
    hide-footer
    :hide-close="busy"
    :close-on-backdrop="!busy"
    @update:model-value="close"
  >
    <form
      class="void-form"
      novalidate
      :aria-busy="busy"
      @submit.prevent="submit"
    >
      <p>Vas a anular {{ folio }}. El documento y sus montos se conservarán sin cambios. No registra pagos ni modifica aportaciones, gastos, jornadas o reservas.</p>
      <p
        v-if="payments === 'yes'"
        role="note"
        data-test="void-payments-warning"
      >
        Este acuerdo tiene pagos registrados. Si lo anulas, esos pagos no se borran ni se revierten: se conservan como historial.
      </p>
      <p
        v-else-if="payments === 'unknown'"
        role="note"
        data-test="void-payments-unknown"
      >
        No pudimos comprobar si este acuerdo tiene pagos registrados. Si los tiene, se conservarán como historial.
      </p>
      <p
        v-if="pending"
        role="status"
      >
        La respuesta no se confirmó. Reintentar enviará exactamente el mismo motivo, fecha e identificador; no creará otra anulación.
      </p>
      <p
        v-if="!allowed"
        role="status"
      >
        Necesitas conexión, acceso vigente y ningún otro intento pendiente para continuar.
      </p>
      <AppTextarea
        id="agreement-void-reason"
        v-model="reason"
        label="Motivo de anulación"
        required
        :maxlength="1000"
        :rows="4"
        :disabled="busy || !!pending"
      />
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
      >
        {{ formError || error }}
      </p>
      <div class="void-actions">
        <AppButton
          v-if="pending"
          type="button"
          data-test="retry-void"
          :disabled="!allowed || busy"
          :loading="busy"
          @click="retry"
        >
          Reintentar la misma anulación
        </AppButton>
        <AppButton
          v-else
          type="submit"
          data-test="confirm-void"
          :disabled="!allowed || busy || !reason.trim() || reason.trim().length > 1000"
          :loading="busy"
        >
          Confirmar anulación
        </AppButton>
        <AppButton
          type="button"
          variant="ghost"
          data-test="cancel-void"
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
import { agreementReason, agreementErrorMessage } from '@/utils/finance-agreements'
import type { ReverseAgreementPayload } from '@/types/finance-agreement.types'
const props = withDefaults(defineProps<{
  modelValue: boolean; folio: string; allowed: boolean; busy: boolean; error: string; pending: ReverseAgreementPayload | null
  /** Whether payments are linked to the agreement; the void itself is unchanged and payments are always kept. */
  payments?: 'yes' | 'no' | 'unknown'
}>(), { payments: 'no' })
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; confirm: [reason: string]; retry: [] }>()
const reason = ref(''), formError = ref(''), errorBox = ref<HTMLElement | null>(null)
watch(() => props.modelValue, open => { if (open) { reason.value = props.pending?.reason ?? ''; formError.value = '' } }, { immediate: true })
watch(() => props.pending, pending => { if (pending) reason.value = pending.reason })
watch(() => props.error, async error => { if (error && props.modelValue) { await nextTick(); errorBox.value?.focus() } })
function close(open: boolean) { if (!props.busy) emit('update:modelValue', open) }
function retry() { if (props.allowed && !props.busy && props.pending) emit('retry') }
async function submit() {
  if (!props.allowed || props.busy || props.pending) return
  try { emit('confirm', agreementReason(reason.value)); formError.value = '' }
  catch (error) { formError.value = agreementErrorMessage(error); await nextTick(); errorBox.value?.focus() }
}
</script>
<style scoped>
.void-form { display: grid; gap: var(--spacing-md); overflow-wrap: anywhere; }
.void-actions { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); }
[role='alert'] { color: var(--color-danger); }
</style>
