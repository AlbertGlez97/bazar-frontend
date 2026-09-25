<template>
  <!-- Molécula: total, efectivo y cambio. Todo llega en centavos ya calculado
       por el store; aquí solo se formatea y se decide qué estado mostrar.
       El total y el cambio son los números más grandes de la pantalla. -->
  <section
    class="cart-summary"
    :data-state="state"
    aria-label="Resumen de la venta"
  >
    <div class="cart-summary__row">
      <span class="cart-summary__label">
        Total
        <span
          v-if="itemCount > 0"
          class="cart-summary__count"
        >· {{ itemCount === 1 ? '1 pieza' : `${itemCount} piezas` }}</span>
      </span>
      <span class="cart-summary__total">${{ minorToDisplay(totalMinor) }}</span>
    </div>

    <p
      v-if="state === 'missing' || state === 'ok'"
      class="cart-summary__cash"
    >
      Recibido ${{ minorToDisplay(cashMinor) }}
    </p>

    <!-- Región viva: cada cambio de estado se anuncia sin mover el foco -->
    <p
      class="cart-summary__status"
      :class="`cart-summary__status--${state}`"
      role="status"
      aria-live="polite"
    >
      {{ statusText }}
      <strong
        v-if="state === 'ok' && changeMinor > 0"
        class="cart-summary__change"
      >${{ minorToDisplay(changeMinor) }}</strong>
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { minorToDisplay } from '@/utils/money'

const props = defineProps<{
  /** Piezas en el carrito */
  itemCount: number
  totalMinor: number
  /** Efectivo que dieron; 0 = todavía no se escribe */
  cashMinor: number
  /** Cambio a entregar (nunca negativo) */
  changeMinor: number
  /** Lo que falta para cubrir el total (0 si ya alcanza) */
  missingMinor: number
}>()

type State = 'empty' | 'no-cash' | 'missing' | 'ok'

const state = computed<State>(() => {
  if (props.itemCount === 0) return 'empty'
  // Un total de $0 (producto regalado) se cobra sin efectivo: cuenta como alcanzado.
  if (props.cashMinor === 0 && props.totalMinor > 0) return 'no-cash'
  if (props.cashMinor < props.totalMinor) return 'missing'
  return 'ok'
})

const statusText = computed(() => {
  switch (state.value) {
    case 'empty': return 'Toca un producto para empezar.'
    case 'no-cash': return 'Escribe cuánto te dan.'
    case 'missing': return `Faltan $${minorToDisplay(props.missingMinor)}.`
    default: return props.changeMinor > 0 ? 'Cambio:' : 'Justo, sin cambio.'
  }
})
</script>

<style scoped>
.cart-summary {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--color-surface-alt);
  border-radius: var(--radius-lg);
}

.cart-summary__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--spacing-md);
}
.cart-summary__label { font-size: var(--font-size-md); font-weight: 700; color: var(--color-text-muted); }
.cart-summary__count { font-weight: 500; }
.cart-summary__total {
  font-family: var(--font-display);
  font-size: 2.5rem;
  font-weight: 800;
  line-height: 1.05;
  color: var(--color-text);
}

.cart-summary__cash { margin: 0; font-size: var(--font-size-md); color: var(--color-text-muted); }

/* Estado: siempre con palabras y un símbolo de borde, no solo color */
.cart-summary__status {
  margin: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  border-left: 6px solid var(--color-border-strong);
  background: var(--color-surface);
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--color-text);
}
.cart-summary__status--missing {
  border-left-color: var(--color-warning);
  background: var(--color-warning-soft);
  color: var(--color-warning);
}
.cart-summary__status--ok {
  border-left-color: var(--color-success);
  background: var(--color-success-soft);
  color: var(--color-success);
}
.cart-summary__status--empty,
.cart-summary__status--no-cash { color: var(--color-text-muted); font-weight: 600; }

.cart-summary__change {
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: 800;
  line-height: 1.1;
}
</style>
