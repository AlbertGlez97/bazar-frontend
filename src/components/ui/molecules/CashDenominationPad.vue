<template>
  <!-- Molécula: selector de billetes y monedas combinable. Controlada por
       quien la usa (`CashInput`): no guarda estado propio, solo reporta
       toques con `tap` y pinta la cuenta que le pasan por `counts`. Cada
       botón se identifica por color/forma + número, sin ícono genérico de
       dinero. Dos grupos con encabezado VISIBLE (en el árbol de
       accesibilidad, no solo separación por CSS): "Billetes" arriba,
       "Monedas" abajo. -->
  <div class="cash-denomination-pad">
    <div class="cash-denomination-pad__group">
      <h3 class="cash-denomination-pad__group-label">
        Billetes
      </h3>
      <div class="cash-denomination-pad__row">
        <button
          v-for="bill in BILLS"
          :key="bill"
          type="button"
          class="cash-denomination-pad__btn cash-denomination-pad__btn--bill"
          :style="{ background: `var(--color-denom-${bill})` }"
          :disabled="disabled"
          :aria-label="ariaLabelForBill(bill)"
          @click="emit('tap', bill)"
        >
          <span class="cash-denomination-pad__amount">${{ bill }}</span>
          <span
            v-if="countOf(bill) > 0"
            class="cash-denomination-pad__badge"
          >×{{ countOf(bill) }}</span>
        </button>
      </div>
    </div>

    <div class="cash-denomination-pad__group">
      <h3 class="cash-denomination-pad__group-label">
        Monedas
      </h3>
      <div class="cash-denomination-pad__row">
        <button
          v-for="coin in COINS"
          :key="coin"
          type="button"
          class="cash-denomination-pad__btn cash-denomination-pad__btn--coin"
          :class="coin === 10
            ? 'cash-denomination-pad__btn--coin-bimetallic'
            : 'cash-denomination-pad__btn--coin-silver'"
          :disabled="disabled"
          :aria-label="ariaLabelForCoin(coin)"
          @click="emit('tap', coin)"
        >
          <span class="cash-denomination-pad__amount">${{ coin }}</span>
          <span
            v-if="countOf(coin) > 0"
            class="cash-denomination-pad__badge"
          >×{{ countOf(coin) }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/** Billetes combinables: solo los de uso diario en México (sin monedas, a propósito). */
export const BILLS = [20, 50, 100, 200, 500, 1000] as const
/** Monedas combinables: las de uso diario en México ($1/$2/$5 "plata", $10 bimetálica). */
export const COINS = [1, 2, 5, 10] as const
</script>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  /** Cuántas veces se tocó cada billete/moneda, controlado por quien usa el pad. */
  counts: Partial<Record<number, number>>
  disabled?: boolean
}>(), {
  disabled: false,
})

const emit = defineEmits<{
  tap: [denomination: number]
}>()

function countOf(denomination: number): number {
  return props.counts[denomination] ?? 0
}

function ariaLabelForBill(bill: number): string {
  const n = countOf(bill)
  return n > 0 ? `Billete de $${bill}, agregado ${n} veces` : `Billete de $${bill}`
}

function ariaLabelForCoin(coin: number): string {
  const n = countOf(coin)
  return n > 0 ? `Moneda de $${coin}, agregada ${n} veces` : `Moneda de $${coin}`
}
</script>

<style scoped>
.cash-denomination-pad { display: flex; flex-direction: column; gap: var(--spacing-md); }

.cash-denomination-pad__group-label {
  margin: 0 0 var(--spacing-xs);
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-text-muted);
}

.cash-denomination-pad__row { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); }

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

/* Monedas: círculos de verdad (width/height iguales y explícitos, no solo
   padding), más grandes que los billetes (3rem vs 2.75rem) porque "$10"
   necesita más aire dentro de un círculo. */
.cash-denomination-pad__btn--coin {
  width: 3rem;
  height: 3rem;
  min-width: 3rem;
  min-height: 3rem;
  padding: 0;
  border-radius: 50%;
}

/* $1/$2/$5: monedas de "plata" lisas — el número es el único identificador,
   mismo principio que ya usan los billetes. */
.cash-denomination-pad__btn--coin-silver {
  background: var(--color-surface-alt);
  border: 2px solid var(--color-border-strong);
  color: var(--color-text);
}
/* Fondo claro: la insignia "×N" necesita texto oscuro, no el blanco que
   usan billetes/moneda bimetálica sobre fondos oscuros. */
.cash-denomination-pad__btn--coin-silver .cash-denomination-pad__badge { color: var(--color-text); }

/* $10: bimetálica en la vida real (centro dorado, anillo oscuro), representada
   con un degradado radial de dos tonos hecho con tokens ya existentes. */
.cash-denomination-pad__btn--coin-bimetallic {
  background: radial-gradient(circle, var(--maiz-400) 60%, var(--cafe-600) 60%);
  color: var(--color-on-primary);
}

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
