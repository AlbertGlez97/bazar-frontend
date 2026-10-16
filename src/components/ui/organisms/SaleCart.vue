<template>
  <!-- Organismo: el cobro de la venta completo. Es organismo porque incluye
       AppModal (confirmación de "Vaciar"). Presentacional: no lee stores.
       Recibe todo calculado en centavos y emite lo que la persona quiere hacer;
       el contenedor (SaleView) lo conecta.

       Orden de arriba abajo (igual en celular, tablet y escritorio; solo cambia
       el espacio): "N productos ▾", total grande, método de pago, monto, cambio y
       "Cobrar" fijo abajo. "Cobrar" es el ÚNICO botón de color fuerte de la
       pantalla; el método y el fiado son neutros.
       No existe forma de intentar cobrar algo imposible: "Cobrar" se apaga y
       el texto de arriba dice qué falta. -->
  <section
    class="sale-cart"
    :class="{ 'sale-cart--checkout': prominent }"
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

    <details
      v-if="lines.length > 0"
      class="sale-cart__lines-wrap"
      :open="!prominent"
    >
      <summary class="sale-cart__lines-summary">
        {{ VOICE.cobro.itemsToggle(lines.length) }}
      </summary>
      <ul
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
    </details>
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
        :total-minor="totalMinor"
        :compact="!prominent"
      />

      <template v-if="lines.length > 0">
        <PaymentMethodPicker
          :model-value="paymentMethod"
          :disabled="loading"
          @update:model-value="emit('update:paymentMethod', $event)"
        />

        <AmountInput
          :model-value="amountText"
          :label="amountLabel"
          :size="prominent ? 'lg' : 'md'"
          :disabled="loading"
          @update:model-value="emit('update:amountText', $event)"
        />

        <PaymentChange
          :payment-method="paymentMethod"
          :item-count="itemCount"
          :total-minor="totalMinor"
          :amount-minor="amountMinor"
          :change-minor="changeMinor"
          :missing-minor="missingMinor"
          :compact="!prominent"
        />
      </template>

      <!-- La razón por la que no se puede cobrar, en texto: nunca un botón mudo.
           Con productos en el carrito esa razón la dice el cambio de arriba. -->
      <p
        v-if="hint && !loading"
        class="sale-cart__hint"
      >
        {{ hint }}
      </p>

      <!-- Fiado/apartado: solo con UNA línea y un monto menor al total (incluido
           $0, el campo vacío). La Deuda es de un solo producto, nunca un carrito:
           con 2 o más se explica en una línea en vez de no mostrar nada. -->
      <button
        v-if="canRegisterDebt"
        type="button"
        class="sale-cart__debt-option"
        data-action="open-debt-modal"
        @click="emit('open-debt-modal')"
      >
        {{ VOICE.deuda.offerTitle }}
      </button>
      <p
        v-else-if="showDebtOnlyOne"
        class="sale-cart__debt-note"
      >
        {{ VOICE.cobro.debtOnlyOne }}
      </p>
    </div>

    <!-- "Cobrar": fijo abajo. En el celular (Paso 2) reserva su espacio con un
         padding inferior para no tapar nada; en pantalla ancha se pega al borde
         del panel. -->
    <div class="sale-cart__actions">
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
          {{ VOICE.cobro.charging }}
        </template>
        <template v-else>
          {{ VOICE.cobro.charge }}
        </template>
      </AppButton>
    </div>

    <!-- Vaciar borra el trabajo de un rato: nunca de un solo toque. "Mejor no"
         (la salida segura) es la principal; Escape y tocar fuera valen lo mismo. -->
    <AppModal
      v-model="confirmOpen"
      title="¿Vaciar la venta?"
      size="sm"
      hide-close
    >
      Vas a quitar todos los productos del carrito y lo que escribiste.
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
import { VOICE, saleChargeHint } from '@/config/voice'
import type { CartLineView } from '@/types/cart.types'
import type { PaymentMethod } from '@/types/payment.types'
import { isCashPayment } from '@/utils/payment-method'
import AppButton from '../atoms/AppButton.vue'
import AmountInput from '../molecules/AmountInput.vue'
import CartLineItem from '../molecules/CartLineItem.vue'
import CartSummary from '../molecules/CartSummary.vue'
import PaymentChange from '../molecules/PaymentChange.vue'
import PaymentMethodPicker from '../molecules/PaymentMethodPicker.vue'
import AppModal from './AppModal.vue'

const props = defineProps<{
  lines: CartLineView[]
  /** Piezas en total */
  itemCount: number
  totalMinor: number
  paymentMethod: PaymentMethod
  /** Monto ya leído (efectivo recibido, o lo cobrado con transferencia/tarjeta). */
  amountMinor: number
  /** Texto del campo de monto (v-model:amountText) */
  amountText: string
  /** Cambio a devolver (0 si no es efectivo) */
  changeMinor: number
  /** Lo que falta para cubrir el total (0 si ya alcanza) */
  missingMinor: number
  /** Regla del carrito: no vacío y monto suficiente */
  canCharge: boolean
  /**
   * El monto no alcanza el total (incluido $0). Con una sola línea habilita
   * fiado/apartado. Un monto ambiguo nunca cuenta: ahí falla el texto, no el dinero.
   */
  partial: boolean
  /** Cobro en curso: todo se bloquea y el botón dice "Cobrando…" */
  loading: boolean
  /**
   * Paso 2 del cobro en celular: la venta entera a pantalla completa, con el
   * campo de monto y el método más grandes y "Cobrar" fijo abajo. Solo cambia la
   * presentación (CSS); el contenido y los eventos son los mismos.
   */
  prominent?: boolean
}>()

const emit = defineEmits<{
  increment: [productId: string]
  decrement: [productId: string]
  remove: [productId: string]
  limit: [productId: string, which: 'min' | 'max']
  'update:paymentMethod': [method: PaymentMethod]
  'update:amountText': [text: string]
  charge: []
  clear: []
  'open-debt-modal': []
}>()

const confirmOpen = ref(false)

const amountLabel = computed(() =>
  isCashPayment(props.paymentMethod) ? VOICE.cobro.amountCash : VOICE.cobro.amountCharged,
)

/** Solo el carrito vacío necesita su propio aviso; con productos lo dice el cambio. */
const hint = computed(() =>
  props.lines.length === 0 && !props.canCharge ? saleChargeHint(props) : '',
)

const canRegisterDebt = computed(() => !props.loading && props.lines.length === 1 && props.partial)
const showDebtOnlyOne = computed(() => !props.loading && props.lines.length >= 2 && props.partial)

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
.sale-cart { display: flex; flex-direction: column; gap: var(--spacing-md); min-width: 0; }

/* Escritorio: el panel tiene alto máximo (ver SaleView). El carrito se reparte ese alto:
   encabezado, total, método, monto, cambio y Cobrar mantienen su tamaño y SOLO la lista de
   productos se encoge y se desplaza. Gap de 8 px: con 2 productos todo cabe sin desplazarse. */
.sale-cart:not(.sale-cart--checkout) { flex: 1 1 auto; min-height: 0; gap: var(--spacing-sm); }
.sale-cart:not(.sale-cart--checkout) .sale-cart__lines-wrap { flex: 0 1 auto; min-height: 0; overflow-y: auto; }
.sale-cart:not(.sale-cart--checkout) .sale-cart__lines-summary { position: sticky; top: 0; z-index: 1; background: var(--color-bg); }
.sale-cart:not(.sale-cart--checkout) .sale-cart__header,
.sale-cart:not(.sale-cart--checkout) .sale-cart__empty { flex-shrink: 0; }
.sale-cart:not(.sale-cart--checkout) .sale-cart__payment { flex-shrink: 0; gap: var(--spacing-sm); }
.sale-cart:not(.sale-cart--checkout) .sale-cart__actions { flex-shrink: 0; }

.sale-cart__header { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-md); }
.sale-cart__title { margin: 0; font-size: var(--font-size-xl); font-weight: 800; color: var(--color-text); }

/* Vaciar: pequeño en el diseño pero de 44 px al tacto, y en chile porque descarta */
.sale-cart__clear {
  min-width: 2.75rem;
  min-height: var(--control-height-compact);
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

/* "N productos ▾": el triángulo lo da el <summary> nativo; aquí solo el tamaño táctil */
.sale-cart__lines-wrap { width: 100%; }
.sale-cart__lines-summary { min-height: var(--control-height-compact); display: flex; align-items: center; cursor: pointer; font-weight: 700; color: var(--color-text); }
.sale-cart__lines-summary:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }
.sale-cart__lines { display: flex; flex-direction: column; gap: var(--spacing-sm); margin: var(--spacing-sm) 0 0; padding: 0; list-style: none; }

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

.sale-cart__payment { display: flex; flex-direction: column; gap: var(--spacing-md); min-width: 0; }

/* "Cobrar": la acción principal de la pantalla, a todo el ancho. En escritorio va
   en el flujo, DEBAJO del campo de monto y del cambio (nunca encima de nada): si los
   productos no caben, la que se desplaza es la lista (ver más abajo). En el Paso 2 del
   celular se fija abajo y reserva su espacio. Doble clase para ganarle en
   especificidad a los tamaños de AppButton. */
.sale-cart__actions { background: var(--color-bg); }
.sale-cart .sale-cart__charge { min-height: var(--control-height-cta); font-size: 1.25rem; font-weight: 800; }
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

/* Fiado/apartado: alternativa al cobro, nunca confundible con "Cobrar" (ni su
   color ni su tamaño); 44 px mínimos al tacto. */
.sale-cart__debt-option {
  min-height: var(--control-height);
  padding: 0 var(--spacing-md);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: 700;
  color: var(--color-text);
  background: var(--color-surface);
  border: 2px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  cursor: pointer;
  touch-action: manipulation;
}
.sale-cart__debt-option:hover { background: var(--color-surface-alt); }
.sale-cart__debt-option:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }
.sale-cart__debt-note { margin: 0; text-align: center; font-size: var(--font-size-md); font-weight: 600; color: var(--color-text-muted); }

/* ── Paso 2 del cobro en celular (`prominent`) ───────────────────────────
   La venta entera a pantalla completa. El contenido ya está en el orden
   correcto en el DOM, así que solo se agranda y se separa. "Cobrar" queda
   FIJO abajo y el contenido reserva su espacio con un padding inferior (más la
   zona segura del teléfono) para que nunca lo tape. */
.sale-cart--checkout {
  min-height: 100%;
  gap: var(--spacing-lg);
  padding-bottom: calc(6.5rem + env(safe-area-inset-bottom, 0px));
}
.sale-cart--checkout :deep(.cart-summary) { padding: var(--spacing-lg); }
.sale-cart--checkout .sale-cart__actions {
  position: fixed;
  right: 0;
  bottom: 0;
  left: var(--app-sidebar-offset, 0px);
  z-index: 41;
  padding: var(--spacing-sm) var(--spacing-md);
  padding-bottom: calc(var(--spacing-sm) + env(safe-area-inset-bottom, 0px));
  background: var(--color-bg);
  border-top: 2px solid var(--color-border-strong);
  box-shadow: var(--shadow-lg);
}
.sale-cart--checkout .sale-cart__charge { min-height: 4.5rem; font-size: 1.5rem; }

.sale-cart__confirm-actions { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); width: 100%; }
.sale-cart__confirm-actions > * { flex: 1 1 9rem; }
</style>
