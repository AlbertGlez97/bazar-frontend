<template>
  <!-- Molécula: el TOTAL de la venta, el número más grande de la pantalla.
       La tarjeta es un contenedor de tamaño en línea y la letra se mide contra SU
       ancho (cqi), así que "$12,345.67" nunca se sale ni se corta, ni en un
       celular de 320 px. El efectivo recibido, el cambio y lo que falta viven en
       PaymentChange. -->
  <section
    class="cart-summary"
    :class="{ 'cart-summary--compact': compact }"
    aria-label="Total de la venta"
  >
    <span class="cart-summary__label">Total</span>
    <span
      class="cart-summary__total"
      :aria-label="`Total ${money}`"
    >{{ money }}</span>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatMinorMoney } from '@/utils/money'

const props = defineProps<{
  totalMinor: number
  /** Escritorio: "Total" y el importe en una sola fila, para que todo el cobro quepa sin desplazarse. */
  compact?: boolean
}>()

/** "$1,100.00": siempre con separador de miles. */
const money = computed(() => formatMinorMoney(props.totalMinor))
</script>

<style scoped>
.cart-summary {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 0;
  max-width: 100%;
  padding: var(--spacing-md);
  background: var(--color-surface-alt);
  border-radius: var(--radius-lg);
}

.cart-summary__label { font-size: var(--font-size-md); font-weight: 700; color: var(--color-text-muted); }

/* La letra se ajusta al ancho de la tarjeta: 11 % de su ancho, entre 24 y 60 px
   (con 11 % cabe hasta $21,474,836.47, el tope del contrato, en 320 px).
   Primero la versión con vw para navegadores sin unidades de contenedor. */
.cart-summary__total {
  display: block;
  min-width: 0;
  max-width: 100%;
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 8vw, 3.75rem);
  font-size: clamp(1.5rem, 11cqi, 3.75rem);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1.05;
  white-space: nowrap;
  color: var(--color-text);
}

/* Escritorio: una fila ("Total" a la izquierda, el importe a la derecha); si el importe
   no cupiera junto a la palabra, baja a otra fila y usa todo el ancho. */
.cart-summary--compact {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0 var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
}
.cart-summary--compact .cart-summary__total {
  font-size: clamp(1.5rem, 8vw, 2.5rem);
  font-size: clamp(1.5rem, 9cqi, 2.5rem);
}
</style>
