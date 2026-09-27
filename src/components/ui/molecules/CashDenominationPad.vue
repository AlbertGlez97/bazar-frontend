<template>
  <!-- Molécula: selector de billetes combinable. Controlada por quien la usa
       (`CashInput`): no guarda estado propio, solo reporta toques con
       `tap` y pinta la cuenta que le pasan por `counts`. Cada botón se
       identifica por color + número, sin ícono genérico de dinero. -->
  <div class="cash-denomination-pad">
    <button
      v-for="bill in BILLS"
      :key="bill"
      type="button"
      class="cash-denomination-pad__btn"
      :style="{ background: `var(--color-denom-${bill})` }"
      :disabled="disabled"
      :aria-label="ariaLabelFor(bill)"
      @click="emit('tap', bill)"
    >
      <span class="cash-denomination-pad__amount">${{ bill }}</span>
      <span
        v-if="countOf(bill) > 0"
        class="cash-denomination-pad__badge"
      >×{{ countOf(bill) }}</span>
    </button>
  </div>
</template>

<script lang="ts">
/** Billetes combinables: solo los de uso diario en México (sin monedas, a propósito). */
export const BILLS = [20, 50, 100, 200, 500, 1000] as const
</script>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  /** Cuántas veces se tocó cada billete, controlado por quien usa el pad. */
  counts: Partial<Record<number, number>>
  disabled?: boolean
}>(), {
  disabled: false,
})

const emit = defineEmits<{
  tap: [denomination: number]
}>()

function countOf(bill: number): number {
  return props.counts[bill] ?? 0
}

function ariaLabelFor(bill: number): string {
  const n = countOf(bill)
  return n > 0 ? `Billete de $${bill}, agregado ${n} veces` : `Billete de $${bill}`
}
</script>

<style scoped>
.cash-denomination-pad { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); }

.cash-denomination-pad__btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2.75rem;
  min-height: 2.75rem;
  padding: var(--spacing-xs) var(--spacing-md);
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  font-weight: 800;
  color: var(--color-on-primary);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  touch-action: manipulation;
  transition: filter var(--transition);
}
.cash-denomination-pad__btn:hover:not(:disabled) { filter: brightness(1.08); }
.cash-denomination-pad__btn:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }
.cash-denomination-pad__btn:disabled { opacity: 0.5; cursor: not-allowed; }

.cash-denomination-pad__amount { pointer-events: none; }

.cash-denomination-pad__badge {
  position: absolute;
  top: 2px;
  right: 6px;
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: var(--color-on-primary);
  pointer-events: none;
}
</style>
