<template>
  <!-- Organismo: el carrito de la venta completo (líneas, resumen, efectivo y
       "Cobrar"). Es organismo porque incluye AppModal (confirmación de "Vaciar").
       Presentacional: no lee stores. Recibe todo calculado en centavos y emite
       lo que la persona quiere hacer; el contenedor (SaleView) lo conecta.
       No existe forma de intentar cobrar algo imposible: "Cobrar" se apaga y
       una línea de texto dice qué falta. -->
  <section
    class="sale-cart"
    aria-label="Tu venta"
  >
    <header class="sale-cart__header">
      <h2 class="sale-cart__title">
        Tu venta
      </h2>
      <button
        v-if="lines.length > 0"
        type="button"
        class="sale-cart__clear"
        data-action="clear"
        :disabled="loading"
        @click="confirmOpen = true"
      >
        Vaciar
      </button>
    </header>

    <ul
      v-if="lines.length > 0"
      class="sale-cart__lines"
      aria-label="Productos de la venta"
    >
      <CartLineItem
        v-for="line in lines"
        :key="line.productId"
        :line="line"
        :disabled="loading"
        @increment="emit('increment', line.productId)"
        @decrement="emit('decrement', line.productId)"
        @remove="emit('remove', line.productId)"
        @limit="emit('limit', line.productId, $event)"
      />
    </ul>
    <p
      v-else
      class="sale-cart__empty"
    >
      <span
        class="sale-cart__empty-icon"
        aria-hidden="true"
      >🛒</span>
      Aquí aparecen los productos que agregues.
    </p>

    <div class="sale-cart__payment">
      <CartSummary
        :item-count="itemCount"
        :total-minor="totalMinor"
        :cash-minor="cashMinor"
        :change-minor="changeMinor"
        :missing-minor="missingMinor"
      />

      <CashInput
        v-if="lines.length > 0"
        :model-value="cashText"
        :total-minor="totalMinor"
        :disabled="loading"
        @update:model-value="emit('update:cashText', $event)"
      />

      <AppButton
        variant="primary"
        size="xl"
        block
        class="sale-cart__charge"
        data-action="charge"
        :disabled="!canCharge || loading"
        @click="onCharge"
      >
        <template v-if="loading">
          <span
            class="sale-cart__spinner"
            aria-hidden="true"
          />
          Cobrando…
        </template>
        <template v-else>
          Cobrar
        </template>
      </AppButton>

      <!-- La razón por la que no se puede cobrar, en texto: nunca un botón mudo -->
      <p
        v-if="hint && !loading"
        class="sale-cart__hint"
      >
        {{ hint }}
      </p>
    </div>

    <!-- Vaciar borra el trabajo de un rato: nunca de un solo toque. "Mejor no"
         (la salida segura) es la principal; Escape y tocar fuera valen lo mismo. -->
    <AppModal
      v-model="confirmOpen"
      title="¿Vaciar la venta?"
      size="sm"
      hide-close
    >
      Vas a quitar todos los productos del carrito y el efectivo que escribiste.
      Esto no se puede deshacer.
      <template #footer>
        <div class="sale-cart__confirm-actions">
          <AppButton
            variant="soft-danger"
            size="lg"
            @click="confirmClear"
          >
            Sí, vaciar
          </AppButton>
          <AppButton
            variant="primary"
            size="lg"
            @click="confirmOpen = false"
          >
            Mejor no
          </AppButton>
        </div>
      </template>
    </AppModal>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { saleChargeHint } from '@/config/voice'
import type { CartLineView } from '@/types/cart.types'
import AppButton from '../atoms/AppButton.vue'
import CartLineItem from '../molecules/CartLineItem.vue'
import CartSummary from '../molecules/CartSummary.vue'
import CashInput from '../molecules/CashInput.vue'
import AppModal from './AppModal.vue'

const props = defineProps<{
  lines: CartLineView[]
  /** Piezas en total */
  itemCount: number
  totalMinor: number
  cashMinor: number
  changeMinor: number
  missingMinor: number
  /** Regla del carrito: no vacío y efectivo suficiente */
  canCharge: boolean
  /** Texto del campo de efectivo (v-model:cashText) */
  cashText: string
  /** Cobro en curso: todo se bloquea y el botón dice "Cobrando…" */
  loading: boolean
}>()

const emit = defineEmits<{
  increment: [productId: string]
  decrement: [productId: string]
  remove: [productId: string]
  limit: [productId: string, which: 'min' | 'max']
  'update:cashText': [text: string]
  charge: []
  clear: []
}>()

const confirmOpen = ref(false)

const hint = computed(() => (props.canCharge ? '' : saleChargeHint(props)))

function onCharge() {
  // Doble candado: el botón ya está deshabilitado, pero un toque doble o un
  // evento sintético nunca debe mandar una venta imposible ni repetida.
  if (!props.canCharge || props.loading) return
  emit('charge')
}

function confirmClear() {
  confirmOpen.value = false
  emit('clear')
}
</script>

<style scoped>
.sale-cart { display: flex; flex-direction: column; gap: var(--spacing-md); }

.sale-cart__header { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-md); }
.sale-cart__title { margin: 0; font-size: var(--font-size-xl); font-weight: 800; color: var(--color-text); }

/* Vaciar: pequeño en el diseño pero de 44 px al tacto, y en chile porque descarta */
.sale-cart__clear {
  min-width: 44px;
  min-height: 44px;
  padding: 0 var(--spacing-md);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-danger);
  background: transparent;
  border: 2px solid color-mix(in srgb, var(--color-danger) 45%, transparent);
  border-radius: var(--radius-md);
  cursor: pointer;
  touch-action: manipulation;
}
.sale-cart__clear:hover:not(:disabled) { background: var(--color-danger-soft); }
.sale-cart__clear:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }
.sale-cart__clear:disabled { opacity: 0.5; cursor: not-allowed; }

.sale-cart__lines { display: flex; flex-direction: column; gap: var(--spacing-sm); margin: 0; padding: 0; list-style: none; }

.sale-cart__empty {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xl) var(--spacing-md);
  text-align: center;
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
  background: var(--color-surface);
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-lg);
}
.sale-cart__empty-icon { font-size: 2.5rem; line-height: 1; opacity: 0.6; }

.sale-cart__payment { display: flex; flex-direction: column; gap: var(--spacing-md); }

/* La acción principal de la pantalla: 56 px, ancho completo. Doble clase para
   ganarle en especificidad a los tamaños de AppButton (incluida su regla móvil). */
.sale-cart .sale-cart__charge { min-height: 3.5rem; font-size: 1.25rem; font-weight: 800; }
.sale-cart__spinner {
  display: inline-block;
  width: 1.1em;
  height: 1.1em;
  margin-right: var(--spacing-sm);
  border: 3px solid color-mix(in srgb, currentColor 30%, transparent);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: sale-cart-spin 0.65s linear infinite;
}
@keyframes sale-cart-spin { to { transform: rotate(360deg); } }

.sale-cart__hint { margin: 0; text-align: center; font-size: var(--font-size-md); font-weight: 600; color: var(--color-text-muted); }

.sale-cart__confirm-actions { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); width: 100%; }
.sale-cart__confirm-actions > * { flex: 1 1 9rem; }
</style>
