<template>
  <!-- Vista (contenedor): pantalla de venta de Modo Venta. Conecta los stores
       (catálogo, carrito, cobro) con los componentes de presentación.
       - Pantalla ANCHA (tablet horizontal, escritorio): catálogo y carrito lado a
         lado, siempre a la vista.
       - Pantalla ANGOSTA (celular): dos pasos.
           Paso 1: el catálogo ocupa la pantalla (búsqueda + escanear) y el carrito
                   es una barra fija abajo con piezas + total y "Cobrar →". Sin
                   nada en la venta, la barra no se muestra.
           Paso 2: la venta entera a pantalla completa (total y efectivo en grande)
                   con "Seguir agregando" para volver sin perder nada. Se abre con
                   `?paso=cobro` en la URL: así el botón Atrás del celular regresa
                   al Paso 1 en vez de salir de la venta.
         Quién decide "angosta" es `useDeviceCapabilities().isSmallScreen`
         (mismo umbral de 900 px que el resto de la app), no una media query suelta:
         el layout, la barra y los pasos comparten una sola fuente de verdad.
       - Al cobrar, el resultado (éxito, guardada sin señal, conflicto, ...) toma
         la pantalla entera con UN botón principal. -->
  <div
    class="sale-view"
    :class="{
      'sale-view--narrow': isSmallScreen,
      'sale-view--checkout': isCheckoutStep,
      'sale-view--has-bar': showBar,
    }"
  >
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
        <!-- En el Paso 2 el catálogo sigue montado debajo (conserva búsqueda,
             categoría y posición) pero inaccesible: ni foco ni lector de pantalla. -->
        <SaleCatalogPicker
          class="sale-view__catalog"
          :inert="isCheckoutStep || undefined"
          :aria-hidden="isCheckoutStep ? 'true' : undefined"
          :products="catalog.filtered"
          :search="catalog.search"
          :categories="catalog.categories"
          :category="catalog.category"
          :loading="catalog.loading"
          :error-message="catalog.error"
          :from-snapshot="catalog.isFromSnapshot"
          :snapshot-saved-at="catalog.lastLoadedAt"
          :in-cart-ids="inCartIds"
          :view="catalogView.view"
          @update:view="catalogView.setView"
          @update:search="catalog.setSearch"
          @update:category="catalog.setCategory"
          @select="onSelect"
          @scan="openScanner"
          @retry="catalog.load()"
        />

        <div
          class="sale-view__cart"
          :class="{ 'sale-view__cart--checkout': isCheckoutStep }"
        >
          <!-- Solo en el Paso 2: salir sin perder nada -->
          <button
            v-if="isCheckoutStep"
            type="button"
            class="sale-view__close"
            data-action="close-checkout"
            @click="closeCheckout"
          >
            <span aria-hidden="true">←</span> Seguir agregando
          </button>

          <SaleCart
            :prominent="isCheckoutStep"
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

      <!-- Paso 1 en celular: la venta siempre a la vista, en una barra fija -->
      <div
        v-if="showBar"
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
          data-action="open-checkout"
          :disabled="checkout.loading"
          @click="openCheckout"
        >
          Cobrar →
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
import { useRoute, useRouter } from 'vue-router'
import { AppButton, QrScannerModal, SaleCart, SaleCatalogPicker, SaleResult } from '@/components'
import { useDeviceCapabilities } from '@/composables/useDeviceCapabilities'
import { useAuthStore } from '@/stores/auth.store'
import { useCartStore } from '@/stores/cart.store'
import { useCheckoutStore } from '@/stores/checkout.store'
import { useSaleCatalogStore } from '@/stores/sale-catalog.store'
import { useSaleCatalogViewStore } from '@/stores/saleCatalogView.store'
import { useSessionStore } from '@/stores/session.store'
import { useToastStore } from '@/stores/toast.store'
import { saleCartRefusalMessage, saleScanAddedMessage, saleScanUnknownMessage } from '@/config/voice'
import { minorToDisplay, parseCashInput } from '@/utils/money'
import type { Product } from '@/types/product.types'
import { describeCheckoutResult } from './sale-result'

const catalog = useSaleCatalogStore()
// Cuadrícula o lista: preferencia del dispositivo, guardada en localStorage.
const catalogView = useSaleCatalogViewStore()
const cart = useCartStore()
const checkout = useCheckoutStore()
const session = useSessionStore()
const auth = useAuthStore()
const toast = useToastStore()
const router = useRouter()
const route = useRoute()

// ── Catálogo ─────────────────────────────────────────────────────────────
// La sincronización de la cola arranca en el shell (AppLayout), no aquí.
onMounted(() => { void catalog.load() })

const inCartIds = computed(() => cart.lines.map((line) => line.productId))

// ── Dos pasos en pantalla angosta ────────────────────────────────────────
// Umbral: el de "pantalla pequeña" de `useDeviceCapabilities` (menos de 900 px:
// celulares y tabletas verticales angostas, donde catálogo y carrito lado a lado
// se aprietan). No se define otro valor: una sola definición de "angosta".
const { isSmallScreen } = useDeviceCapabilities()

/** Valor de `?paso=` que abre el Paso 2. Vive en la URL para que "Atrás" funcione. */
const CHECKOUT_STEP = 'cobro'
const checkoutRequested = computed(() => route.query.paso === CHECKOUT_STEP)

/** Paso 2 visible: pantalla angosta, pedido en la URL y algo que cobrar (nunca un cobro vacío). */
const isCheckoutStep = computed(() => isSmallScreen.value && checkoutRequested.value && !cart.isEmpty)
/** Barra del Paso 1: angosta, en el catálogo y con algo en la venta (vacía = sin barra, más catálogo). */
const showBar = computed(() => isSmallScreen.value && !isCheckoutStep.value && !cart.isEmpty)

const barCount = computed(() => (cart.itemCount === 1 ? '1 pieza' : `${cart.itemCount} piezas`))

/** ¿Este Paso 2 se abrió con un push nuestro? Si sí, cerrarlo es volver en el historial. */
let openedByPush = false

function queryWithoutStep() {
  return Object.fromEntries(Object.entries(route.query).filter(([key]) => key !== 'paso'))
}

async function openCheckout() {
  if (cart.isEmpty || checkout.loading) return
  openedByPush = true
  await router.push({ query: { ...route.query, paso: CHECKOUT_STEP } })
}

/** Quita el paso de la URL sin dejar otra entrada de historial. */
async function dropStepFromUrl() {
  if (!checkoutRequested.value) return
  await router.replace({ query: queryWithoutStep() })
}

/**
 * "Seguir agregando": si el Paso 2 se abrió desde el Paso 1 se regresa en el
 * historial (la misma acción que el botón Atrás); si la persona llegó con
 * `?paso=cobro` ya puesto (recarga, enlace) no hay entrada previa a la que volver
 * y se reemplaza la URL, sin salir de la venta.
 */
function closeCheckout() {
  if (!checkoutRequested.value) return
  if (openedByPush) {
    openedByPush = false
    void router.back()
    return
  }
  void dropStepFromUrl()
}

// Sin nada que cobrar (se quitó la última línea, "Vaciar", venta nueva, recarga en
// `?paso=cobro` con el carrito vacío) el paso sobra en la URL.
watch(
  [checkoutRequested, () => cart.isEmpty],
  ([requested, empty]) => { if (requested && empty) void dropStepFromUrl() },
  { immediate: true },
)

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

/** La venta nueva vacía el carrito: el watcher de arriba saca el Paso 2 de la URL. */
function startNewSale() {
  checkout.startNewSale()
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

/* "Seguir agregando" del Paso 2: 44 px al tacto como mínimo, aquí 48 */
.sale-view__close {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-height: 48px;
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

/* ── Pantalla angosta (celular): dos pasos ─────────────────────────────── */
.sale-view--narrow .sale-view__layout { grid-template-columns: minmax(0, 1fr); }

/* Paso 1: el carrito completo no está; solo la barra fija. Con barra se deja
   espacio abajo para que nunca tape la última fila del catálogo (ni la zona
   segura de los teléfonos con barra de gestos). */
.sale-view--narrow .sale-view__cart { display: none; }
.sale-view--narrow.sale-view--has-bar { padding-bottom: calc(6.5rem + env(safe-area-inset-bottom, 0px)); }

/* Paso 2: la venta entera cubre el área de contenido (respeta la barra lateral) */
.sale-view--narrow .sale-view__cart--checkout {
  display: block;
  position: fixed;
  inset: 0 0 0 var(--app-sidebar-offset, 0px);
  z-index: 40;
  max-height: none;
  padding: var(--spacing-md);
  padding-bottom: calc(var(--spacing-md) + env(safe-area-inset-bottom, 0px));
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--color-bg);
  border: 0;
  border-radius: 0;
}

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
  padding-bottom: calc(var(--spacing-sm) + env(safe-area-inset-bottom, 0px));
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
</style>
