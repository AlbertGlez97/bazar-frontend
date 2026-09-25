<template>
  <!-- Vista (contenedor): pantalla de venta de Modo Venta. Conecta los stores
       (catálogo, carrito, cobro) con los componentes de presentación.
       - Pantalla ancha: catálogo y carrito lado a lado, siempre a la vista.
       - Celular: el catálogo ocupa la pantalla y el carrito es una barra fija
         abajo (total + "Ver venta y cobrar") que se abre como una hoja con el
         carrito completo. Nunca es otra ruta ni un modal.
       - Al cobrar, el resultado (éxito, guardada sin señal, conflicto, ...) toma
         la pantalla entera con UN botón principal. -->
  <div class="sale-view">
    <SaleResult
      v-if="resultView"
      :result="resultView"
      @new-sale="startNewSale"
      @back="checkout.dismissResult()"
      @retry="charge"
      @login="goToLogin"
    />

    <template v-else>
      <div class="sale-view__layout">
        <SaleCatalogPicker
          class="sale-view__catalog"
          :products="catalog.filtered"
          :search="catalog.search"
          :categories="catalog.categories"
          :category="catalog.category"
          :loading="catalog.loading"
          :error-message="catalog.error"
          :from-snapshot="catalog.isFromSnapshot"
          :snapshot-saved-at="catalog.lastLoadedAt"
          :in-cart-ids="inCartIds"
          @update:search="catalog.setSearch"
          @update:category="catalog.setCategory"
          @select="onSelect"
          @scan="openScanner"
          @retry="catalog.load()"
        />

        <div
          class="sale-view__cart"
          :class="{ 'sale-view__cart--open': sheetOpen }"
        >
          <!-- Solo en celular: salir de la hoja sin perder nada -->
          <button
            type="button"
            class="sale-view__close"
            data-action="close-cart"
            @click="sheetOpen = false"
          >
            <span aria-hidden="true">←</span> Seguir agregando
          </button>

          <SaleCart
            :lines="cart.lines"
            :item-count="cart.itemCount"
            :total-minor="cart.totalMinor"
            :cash-minor="cart.cashReceivedMinor"
            :change-minor="cart.changeMinor"
            :missing-minor="cart.missingMinor"
            :can-charge="cart.canCharge"
            :cash-text="cashText"
            :loading="checkout.loading"
            @increment="onIncrement"
            @decrement="onDecrement"
            @remove="onRemove"
            @limit="onLimit"
            @update:cash-text="onCashText"
            @charge="charge"
            @clear="clearCart"
          />
        </div>
      </div>

      <!-- Solo en celular: la venta siempre a la vista, aunque la hoja esté cerrada -->
      <div
        class="sale-view__bar"
        role="region"
        aria-label="Resumen de tu venta"
      >
        <p class="sale-view__bar-info">
          <span class="sale-view__bar-count">{{ barCount }}</span>
          <strong class="sale-view__bar-total">${{ minorToDisplay(cart.totalMinor) }}</strong>
        </p>
        <AppButton
          variant="primary"
          size="xl"
          class="sale-view__bar-button"
          data-action="open-cart"
          :disabled="cart.isEmpty || checkout.loading"
          @click="sheetOpen = true"
        >
          Ver venta y cobrar
        </AppButton>
      </div>
    </template>

    <QrScannerModal
      v-model="scanOpen"
      :feedback="scanFeedback"
      @scan="onScan"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { AppButton, QrScannerModal, SaleCart, SaleCatalogPicker, SaleResult } from '@/components'
import { useAuthStore } from '@/stores/auth.store'
import { useCartStore } from '@/stores/cart.store'
import { useCheckoutStore } from '@/stores/checkout.store'
import { useSaleCatalogStore } from '@/stores/sale-catalog.store'
import { useSessionStore } from '@/stores/session.store'
import { useToastStore } from '@/stores/toast.store'
import { saleCartRefusalMessage, saleScanAddedMessage, saleScanUnknownMessage } from '@/config/voice'
import { minorToDisplay, parseCashInput } from '@/utils/money'
import type { Product } from '@/types/product.types'
import { describeCheckoutResult } from './sale-result'

const catalog = useSaleCatalogStore()
const cart = useCartStore()
const checkout = useCheckoutStore()
const session = useSessionStore()
const auth = useAuthStore()
const toast = useToastStore()
const router = useRouter()

// ── Catálogo ─────────────────────────────────────────────────────────────
// La sincronización de la cola arranca en el shell (AppLayout), no aquí.
onMounted(() => { void catalog.load() })

const inCartIds = computed(() => cart.lines.map((line) => line.productId))

// ── Hoja del carrito (celular) ───────────────────────────────────────────
const sheetOpen = ref(false)
const barCount = computed(() => {
  if (cart.itemCount === 0) return 'Toca un producto'
  return cart.itemCount === 1 ? '1 pieza' : `${cart.itemCount} piezas`
})

// ── Carrito ──────────────────────────────────────────────────────────────
/** Un rechazo del carrito es un aviso corto y amable, nunca un texto técnico. */
function warn(reason: Parameters<typeof saleCartRefusalMessage>[0], productName?: string) {
  toast.warning(saleCartRefusalMessage(reason, productName))
}

function nameOf(productId: string) {
  return cart.lines.find((line) => line.productId === productId)?.name
}

function onSelect(product: Product) {
  const result = cart.add(product)
  if (!result.ok) warn(result.reason, product.name)
}

function onIncrement(productId: string) {
  const result = cart.increment(productId)
  if (!result.ok) warn(result.reason, nameOf(productId))
}

function onDecrement(productId: string) {
  const result = cart.decrement(productId)
  if (!result.ok) warn(result.reason, nameOf(productId))
}

function onLimit(productId: string, which: 'min' | 'max') {
  warn(which === 'max' ? 'max-stock' : 'min-quantity', nameOf(productId))
}

function onRemove(productId: string) {
  cart.remove(productId)
}

function clearCart() {
  cart.clear()
}

// ── Efectivo ─────────────────────────────────────────────────────────────
// El campo guarda el TEXTO que la persona escribió; el carrito, los centavos.
function textOf(minor: number): string {
  if (minor === 0) return ''
  const text = minorToDisplay(minor)
  return text.endsWith('.00') ? text.slice(0, -3) : text
}
const cashText = ref(textOf(cart.cashReceivedMinor))

function onCashText(text: string) {
  cashText.value = text
  cart.setCashFromDisplay(text)
}

// Si el efectivo cambia por otro camino (venta nueva, tope del contrato), el campo lo refleja.
// Un texto ambiguo se queda tal cual (con su aviso) para que la persona lo corrija.
watch(() => cart.cashReceivedMinor, (minor) => {
  if (cart.cashInvalid) return
  if (parseCashInput(cashText.value) !== minor) cashText.value = textOf(minor)
})

// ── QR ───────────────────────────────────────────────────────────────────
const scanOpen = ref(false)
const scanFeedback = ref<{ kind: 'success' | 'warning'; text: string } | null>(null)

function openScanner() {
  scanFeedback.value = null
  scanOpen.value = true
}

function onScan(text: string) {
  const product = catalog.findByScannedText(text)
  if (!product) {
    scanFeedback.value = { kind: 'warning', text: saleScanUnknownMessage() }
    return
  }
  const result = cart.add(product)
  scanFeedback.value = result.ok
    ? { kind: 'success', text: saleScanAddedMessage(product.name) }
    : { kind: 'warning', text: saleCartRefusalMessage(result.reason, product.name) }
}

// ── Cobro y resultado ────────────────────────────────────────────────────
const resultView = computed(() =>
  checkout.lastResult ? describeCheckoutResult(checkout.lastResult, session.member?.name) : null,
)

/** Nunca lanza; el resultado queda en `checkout.lastResult` y lo pinta SaleResult. */
async function charge() {
  await checkout.charge()
}

function startNewSale() {
  checkout.startNewSale()
  sheetOpen.value = false
  cashText.value = ''
}

/** Sesión vencida: la venta ya está a salvo en la cola; se limpia y se va a iniciar sesión. */
async function goToLogin() {
  startNewSale()
  auth.logout()
  await router.push({ name: 'Login' })
}
</script>

<style scoped>
.sale-view { display: flex; flex-direction: column; gap: var(--spacing-md); min-width: 0; }

/* ── Pantalla ancha: dos columnas, catálogo y carrito a la vez ─────────── */
.sale-view__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(21rem, 26rem);
  gap: var(--spacing-lg);
  align-items: start;
}
.sale-view__cart {
  position: sticky;
  top: calc(var(--header-height) + var(--spacing-md));
  max-height: calc(100vh - var(--header-height) - var(--spacing-lg) * 2);
  overflow-y: auto;
  padding: var(--spacing-md);
  background: var(--color-bg);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-xl);
}
.sale-view__close,
.sale-view__bar { display: none; }

/* ── Celular: catálogo a pantalla completa + barra fija + hoja del carrito ─ */
@media (max-width: 899px) {
  .sale-view { padding-bottom: 6.5rem; }
  .sale-view__layout { grid-template-columns: minmax(0, 1fr); }

  /* La hoja cubre el área de contenido (respeta la barra lateral) y se abre desde la barra */
  .sale-view__cart {
    display: none;
    position: fixed;
    inset: 0 0 0 var(--app-sidebar-offset, 0px);
    z-index: 40;
    max-height: none;
    padding: var(--spacing-md);
    border: 0;
    border-radius: 0;
    overscroll-behavior: contain;
  }
  .sale-view__cart--open { display: block; }

  .sale-view__close {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-sm);
    min-height: 44px;
    margin-bottom: var(--spacing-md);
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
  .sale-view__close:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }

  .sale-view__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md);
    position: fixed;
    right: 0;
    bottom: 0;
    left: var(--app-sidebar-offset, 0px);
    z-index: 30;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-surface);
    border-top: 2px solid var(--color-border-strong);
    box-shadow: var(--shadow-lg);
  }
  .sale-view__bar-info { display: flex; flex-direction: column; flex: 0 0 auto; margin: 0; }
  .sale-view__bar-count { font-size: var(--font-size-sm); color: var(--color-text-muted); }
  .sale-view__bar-total {
    font-family: var(--font-display);
    font-size: var(--font-size-xl);
    line-height: 1.1;
    white-space: nowrap;
    color: var(--color-text);
  }
  /* El botón de la barra: 56 px, el más grande a mano */
  .sale-view .sale-view__bar-button { min-height: 3.5rem; font-size: var(--font-size-md); font-weight: 800; flex: 1 1 auto; min-width: 0; padding-inline: var(--spacing-sm); }
}
</style>
