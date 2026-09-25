<template>
  <!-- Molécula: una línea del carrito. Presentacional: recibe la línea y emite
       lo que la persona quiere hacer (más, menos, quitar); el carrito real vive
       en el store y lo conecta el contenedor. -->
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

    <div class="cart-line__body">
      <p class="cart-line__name">
        {{ line.name }}
      </p>
      <p class="cart-line__unit">
        ${{ minorToDisplay(line.unitPriceMinor) }} c/u
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
          size="lg"
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
            width="20"
            height="20"
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
    </div>

    <p class="cart-line__subtotal">
      ${{ minorToDisplay(line.unitPriceMinor * line.quantity) }}
    </p>
  </li>
</template>

<script setup lang="ts">
import { minorToDisplay } from '@/utils/money'
import QuantityStepper from '../atoms/QuantityStepper.vue'

defineProps<{
  /** Forma de `CartLine` del store (los componentes de ui/ no importan stores) */
  line: {
    productId: string
    name: string
    unitPriceMinor: number
    quantity: number
    tipo: 'unica' | 'cantidad'
    /** Existencia local: tope de la cantidad */
    stockAvailable: number
    image: string | null
  }
  /** Bloquea los controles (mientras se cobra) */
  disabled?: boolean
}>()

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
  grid-template-columns: 4rem 1fr auto;
  align-items: start;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.cart-line__media {
  width: 4rem;
  height: 4rem;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-bg);
  display: flex;
  align-items: center;
  justify-content: center;
}
.cart-line__img { width: 100%; height: 100%; object-fit: cover; }
.cart-line__placeholder { font-size: 1.75rem; opacity: 0.5; }

.cart-line__body { display: flex; flex-direction: column; gap: var(--spacing-xs); min-width: 0; }
.cart-line__name {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 700;
  line-height: 1.3;
  color: var(--color-text);
  overflow-wrap: anywhere;
}
.cart-line__unit { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }

.cart-line__controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-sm) var(--spacing-md);
  margin-top: var(--spacing-xs);
}
.cart-line__unique {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-muted);
}

/* Quitar: grande y con nombre, en chile (acción que descarta), nunca solo ícono */
.cart-line__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  min-width: 44px;
  min-height: 44px;
  padding: 0 var(--spacing-md);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-danger);
  background: var(--color-danger-soft);
  border: 1px solid color-mix(in srgb, var(--color-danger) 35%, transparent);
  border-radius: var(--radius-md);
  cursor: pointer;
  touch-action: manipulation;
}
.cart-line__remove:hover:not(:disabled) { background: color-mix(in srgb, var(--color-danger) 18%, var(--color-surface)); }
.cart-line__remove:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }
.cart-line__remove:disabled { opacity: 0.5; cursor: not-allowed; }

.cart-line__subtotal {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--font-size-xl);
  font-weight: 800;
  line-height: 1.1;
  color: var(--color-text);
  white-space: nowrap;
}

/* Pantallas muy angostas: el subtotal baja debajo del nombre en vez de apretar */
@media (max-width: 379px) {
  .cart-line { grid-template-columns: 3.5rem 1fr; }
  .cart-line__subtotal { grid-column: 2; }
}
</style>
