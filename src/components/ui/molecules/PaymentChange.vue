<template>
  <!-- Molécula: lo que sigue después de escribir el monto. En efectivo, el
       "Cambio" grande en verde (o lo que falta); con transferencia o tarjeta no
       hay cambio y solo avisa si falta algo. Región viva educada: cada cambio de
       estado se anuncia sin mover el foco. Siempre con palabras y un borde, no
       solo color. -->
  <section
    class="payment-change"
    :data-state="state"
    aria-label="Cambio"
  >
    <div
      class="payment-change__live"
      role="status"
      aria-live="polite"
    >
      <template v-if="state === 'change'">
        <p class="payment-change__label">
          {{ VOICE.cobro.change }}
        </p>
        <p class="payment-change__amount">
          {{ formatMinorMoney(changeMinor) }}
        </p>
      </template>
      <p
        v-else-if="message"
        class="payment-change__message"
      >
        {{ message }}
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { VOICE } from '@/config/voice'
import type { PaymentMethod } from '@/types/payment.types'
import { formatMinorMoney } from '@/utils/money'
import { isCashPayment } from '@/utils/payment-method'

const props = defineProps<{
  paymentMethod: PaymentMethod
  itemCount: number
  totalMinor: number
  /** Monto escrito (o cobrado, con transferencia/tarjeta). */
  amountMinor: number
  /** Cambio a devolver; 0 si no aplica. */
  changeMinor: number
  /** Lo que falta para cubrir el total; 0 si ya alcanza. */
  missingMinor: number
}>()

type State = 'empty' | 'no-amount' | 'missing' | 'change' | 'exact' | 'none'

const state = computed<State>(() => {
  if (props.itemCount === 0) return 'empty'
  if (props.missingMinor > 0) {
    // En efectivo, sin nada escrito todavía: se pide el monto en vez de decir "faltan $1,100.00".
    if (isCashPayment(props.paymentMethod) && props.amountMinor === 0) return 'no-amount'
    return 'missing'
  }
  if (!isCashPayment(props.paymentMethod)) return 'none'
  return props.changeMinor > 0 ? 'change' : 'exact'
})

const message = computed(() => {
  switch (state.value) {
    case 'no-amount': return VOICE.cobro.askAmount
    case 'missing': return VOICE.cobro.missing(formatMinorMoney(props.missingMinor))
    case 'exact': return VOICE.cobro.exact
    default: return ''
  }
})
</script>

<style scoped>
.payment-change {
  container-type: inline-size;
  min-width: 0;
  max-width: 100%;
}
.payment-change[data-state='empty'],
.payment-change[data-state='none'] { display: none; }

.payment-change__live {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  border-left: 6px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}
.payment-change__message {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--color-text);
}
.payment-change[data-state='missing'] .payment-change__live { border-left-color: var(--color-warning); }

/* El cambio: lo más importante después del total. Verde, con la palabra y un borde. */
.payment-change[data-state='change'] {
  color: var(--color-success);
}
.payment-change[data-state='change'] .payment-change__live {
  border-left: 6px solid var(--color-success);
  background: var(--color-success-soft);
}
.payment-change__label { margin: 0; font-size: var(--font-size-lg); font-weight: 800; }
.payment-change__amount {
  display: block;
  margin: 0;
  min-width: 0;
  max-width: 100%;
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 8vw, 3.5rem);
  font-size: clamp(1.5rem, 11cqi, 3.5rem);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1.05;
  white-space: nowrap;
}
</style>
