<template>
  <li
    ref="root"
    class="reserve-card"
    :class="{ 'reserve-card--reversed': reversed, 'reserve-card--other': notCounted }"
    data-test="reserve-card"
  >
    <div class="reserve-card__head">
      <h3 class="reserve-card__name">
        {{ item.name }}
      </h3>
      <AppBadge
        :color="reversed ? 'gray' : 'green'"
        data-test="status-badge"
      >
        {{ reversed ? 'Anulada' : 'Activa' }}
      </AppBadge>
    </div>
    <p
      class="reserve-card__amount"
      data-test="amount"
    >
      {{ formatMinorMoney(item.amountMinor) }}
    </p>
    <p class="reserve-card__meta">
      Período: {{ formatReservePeriod(item.periodFrom, item.periodTo) }}
    </p>
    <p
      v-if="notCounted"
      class="reserve-card__flag"
      data-test="not-counted"
    >
      No cuentan en este período
    </p>
    <p
      v-if="item.note"
      class="reserve-card__meta"
      data-test="note"
    >
      Nota: {{ item.note }}
    </p>
    <p
      v-if="reversed && item.reversal"
      class="reserve-card__meta"
      data-test="reversal"
    >
      Anulada el {{ formatBusinessDate(item.reversal.occurredAt) }}. Motivo: {{ item.reversal.reason }}
    </p>

    <AppButton
      v-if="!reversed && !open"
      variant="ghost"
      class="reserve-card__cancel"
      :aria-label="`Anular reserva ${item.name}`"
      data-test="cancel-open"
      @click="openPanel"
    >
      Anular
    </AppButton>

    <form
      v-if="!reversed && open"
      class="reserve-card__panel"
      role="group"
      :aria-labelledby="titleId"
      data-test="cancel-panel"
      @submit.prevent="confirm"
      @keydown.esc.stop="closePanel"
    >
      <p
        :id="titleId"
        class="reserve-card__panel-title"
      >
        Anular la reserva "{{ item.name }}"
      </p>
      <p class="reserve-card__meta">
        Anular no se puede deshacer. Si necesitas cambiar algo, anula esta reserva y crea una nueva.
      </p>
      <div
        ref="reasonBox"
        data-test="cancel-reason"
      >
        <AppTextarea
          :id="reasonId"
          v-model="reason"
          label="Motivo de la anulación"
          :rows="2"
          :maxlength="RESERVE_REASON_MAX"
          :disabled="busy"
          :error="problem || undefined"
        />
      </div>
      <p
        v-if="error"
        role="alert"
        class="reserve-card__error"
        data-test="cancel-error"
      >
        {{ error }}
      </p>
      <p
        v-if="blocked"
        class="reserve-card__meta"
        role="status"
        data-test="cancel-blocked"
      >
        Espera a que termine la anulación en curso.
      </p>
      <div class="reserve-card__actions">
        <AppButton
          type="submit"
          variant="danger"
          :loading="busy"
          :disabled="blocked"
          data-test="cancel-confirm"
        >
          Confirmar anulación
        </AppButton>
        <AppButton
          type="button"
          variant="ghost"
          :disabled="busy"
          data-test="cancel-dismiss"
          @click="closePanel"
        >
          Conservar la reserva
        </AppButton>
      </div>
    </form>
  </li>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { AppBadge, AppButton, AppTextarea } from '@/components'
import { formatBusinessDate } from '@/utils/business-time'
import { formatMinorMoney } from '@/utils/money'
import {
  RESERVE_REASON_MAX,
  ReserveFormError,
  cancelReasonFromText,
  formatReservePeriod,
} from '@/utils/finance-reserves'
import type { ReserveListItem } from '@/types/finance-reserve.types'

const props = withDefaults(
  defineProps<{
    item: ReserveListItem
    /** Its period EXACTLY equals the selected one, so it counts in the overview. */
    matching?: boolean
    /** A cancellation request for THIS reserve is in flight. */
    busy?: boolean
    /** Failure of the last cancellation request for THIS reserve. */
    error?: string
    /** ANOTHER reserve's cancellation is in flight: this one cannot be confirmed yet. */
    blocked?: boolean
  }>(),
  { matching: true, busy: false, error: '', blocked: false },
)
const emit = defineEmits<{ cancel: [reason: string] }>()

const reversed = computed(() => props.item.status === 'reversed')
const notCounted = computed(() => !reversed.value && !props.matching)

const open = ref(false)
const reason = ref('')
const problem = ref('')
const titleId = useId()
const reasonId = useId()
const root = ref<HTMLElement | null>(null)
const reasonBox = ref<HTMLElement | null>(null)

async function openPanel() {
  open.value = true
  problem.value = ''
  await nextTick()
  reasonBox.value?.querySelector<HTMLElement>('textarea')?.focus()
}
async function closePanel() {
  if (props.busy) return
  open.value = false
  reason.value = ''
  problem.value = ''
  await nextTick()
  root.value?.querySelector<HTMLElement>('[data-test="cancel-open"]')?.focus()
}
function confirm() {
  if (props.busy || props.blocked) return
  try {
    emit('cancel', cancelReasonFromText(reason.value))
    problem.value = ''
  } catch (e) {
    if (!(e instanceof ReserveFormError)) throw e
    problem.value = e.message
  }
}

// Once the server confirms, the item turns "reversed" and the panel is gone.
watch(reversed, (value) => {
  if (value) {
    open.value = false
    reason.value = ''
  }
})
</script>

<style scoped>
.reserve-card {
  display: grid;
  gap: var(--spacing-xs);
  padding: var(--spacing-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  min-width: 0;
}
.reserve-card--reversed {
  background: var(--color-surface-alt);
}
.reserve-card--other {
  border-style: dashed;
}
.reserve-card__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
}
.reserve-card__name {
  margin: 0;
  font-size: var(--font-size-md);
  overflow-wrap: anywhere;
}
.reserve-card__amount {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--font-size-xl);
  font-weight: 700;
  overflow-wrap: anywhere;
}
.reserve-card--reversed .reserve-card__amount {
  text-decoration: line-through;
  color: var(--color-text-muted);
}
.reserve-card__meta {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  overflow-wrap: anywhere;
}
.reserve-card__flag {
  margin: 0;
  color: var(--color-warning);
  font-size: var(--font-size-sm);
  font-weight: 600;
}
.reserve-card__cancel {
  justify-self: start;
}
.reserve-card__panel {
  display: grid;
  gap: var(--spacing-sm);
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border);
}
.reserve-card__panel-title {
  margin: 0;
  font-weight: 600;
}
.reserve-card__error {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}
.reserve-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}
</style>
