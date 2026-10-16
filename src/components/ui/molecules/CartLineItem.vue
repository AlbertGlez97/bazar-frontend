<template>
  <!-- Molécula: una línea del carrito, compacta (~110 px en escritorio). Presentacional:
       recibe la línea y emite lo que la persona quiere hacer (más, menos, quitar);
       el carrito real vive en el store y lo conecta el contenedor.
       Fila 1: miniatura · nombre (2 líneas) · subtotal con su precio c/u.
       Fila 2: contador a la izquierda y "Quitar" a la derecha, en la MISMA fila. -->
  <li class="cart-line">
    <div class="cart-line__media">
      <img
        v-if="line.image"
        :src="line.image"
        alt=""
        class="cart-line__img"
      >
      <span
        v-else
        class="cart-line__placeholder"
        aria-hidden="true"
      >📦</span>
    </div>

    <p class="cart-line__name">
      {{ line.name }}
    </p>

    <div class="cart-line__controls">
      <!-- Una pieza única siempre es 1: un stepper solo confundiría -->
      <p
        v-if="line.tipo === 'unica'"
        class="cart-line__unique"
      >
        Pieza única
      </p>
      <QuantityStepper
        v-else
        size="md"
        :quantity="line.quantity"
        :max="line.stockAvailable"
        :product-name="line.name"
        :disabled="disabled"
        @increment="emit('increment')"
        @decrement="emit('decrement')"
        @limit="emit('limit', $event)"
      />

      <button
        type="button"
        class="cart-line__remove"
        data-action="remove"
        :aria-label="`Quitar ${line.name}`"
        :disabled="disabled"
        @click="emit('remove')"
      >
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
        <span>Quitar</span>
      </button>
    </div>

    <div class="cart-line__amounts">
      <p class="cart-line__subtotal">
        ${{ minorToDisplay(subtotalMinor) }}
      </p>
      <p class="cart-line__unit">
        ${{ minorToDisplay(line.unitPriceMinor) }} c/u
      </p>
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { minorToDisplay, multiplyMinor } from '@/utils/money'
import type { CartLineView } from '@/types/cart.types'
import QuantityStepper from '../molecules/QuantityStepper.vue'

const props = defineProps<{
  line: CartLineView
  /** Bloquea los controles (mientras se cobra) */
  disabled?: boolean
}>()

/** Subtotal exacto de la línea (precio × cantidad) con la aritmética central de dinero. */
const subtotalMinor = computed(() => multiplyMinor(props.line.unitPriceMinor, props.line.quantity))

const emit = defineEmits<{
  increment: []
  decrement: []
  remove: []
  limit: [which: 'min' | 'max']
}>()
</script>

<style scoped>
.cart-line {
  list-style: none;
  display: grid;
  grid-template-columns: 3.5rem minmax(0, 1fr) auto;
  grid-template-areas:
    "media name amounts"
    "media controls controls";
  align-items: start;
  gap: var(--spacing-xs) var(--spacing-md);
  padding: 0.75rem var(--spacing-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.cart-line__media {
  grid-area: media;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-bg);
  display: flex;
  align-items: center;
  justify-content: center;
}
.cart-line__img { width: 100%; height: 100%; object-fit: cover; }
.cart-line__placeholder { font-size: 1.5rem; opacity: 0.5; }

.cart-line__name {
  grid-area: name;
  min-width: 0;
  margin: 0;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  font-size: var(--font-size-md);
  font-weight: 700;
  line-height: 1.3;
  color: var(--color-text);
  overflow-wrap: anywhere;
}

/* Contador a la izquierda, "Quitar" a la derecha: una sola fila */
.cart-line__controls {
  grid-area: controls;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: nowrap;
  gap: var(--spacing-sm);
}
.cart-line__unique {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-muted);
}

/* Quitar: discreto (texto en chile, sin caja), pero con nombre e ícono, nunca solo ícono */
.cart-line__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  min-height: var(--control-height-compact);
  padding: 0 var(--spacing-sm);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-danger);
  background: transparent;
  border: 0;
  border-radius: var(--radius-md);
  cursor: pointer;
  touch-action: manipulation;
}
.cart-line__remove:hover:not(:disabled) { background: var(--color-danger-soft); }
.cart-line__remove:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }
.cart-line__remove:disabled { opacity: 0.5; cursor: not-allowed; }

.cart-line__amounts { grid-area: amounts; display: flex; flex-direction: column; align-items: flex-end; gap: 0.125rem; }
.cart-line__subtotal {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  font-weight: 800;
  line-height: 1.1;
  color: var(--color-text);
  white-space: nowrap;
}
.cart-line__unit { margin: 0; font-size: var(--font-size-xs); color: var(--color-text-muted); white-space: nowrap; }

/* Pantallas muy angostas: los importes bajan debajo del nombre en vez de apretar */
@media (max-width: 379px) {
  .cart-line {
    grid-template-columns: 3rem minmax(0, 1fr);
    grid-template-areas:
      "media name"
      "media controls"
      "media amounts";
  }
  .cart-line__media { width: 3rem; height: 3rem; }
  .cart-line__amounts { flex-direction: row; align-items: baseline; gap: var(--spacing-sm); }
}
</style>
