<template>
  <!-- Organismo: el catálogo de la pantalla de venta. Buscador grande siempre
       visible + botón "Escanear", filtro de categorías y una cuadrícula de
       tarjetas grandes que se tocan para agregar.
       Presentacional: no lee stores; la búsqueda y la categoría se filtran
       afuera (en el store) y aquí llega la lista ya filtrada.
       No reutiliza ProductCatalogGrid (mode="venta") a propósito: ese organismo
       trae su propio buscador con debounce, paginación y ningún evento de
       selección, y sus tarjetas no son tocables. Aquí se usa ProductCard
       size="large" (la misma tarjeta de Modo Venta) dentro de un botón. -->
  <section
    class="sale-picker"
    aria-label="Catálogo de productos"
  >
    <div class="sale-picker__toolbar">
      <div class="sale-picker__search">
        <AppInput
          type="search"
          size="lg"
          placeholder="Buscar producto"
          aria-label="Buscar producto"
          autocomplete="off"
          enterkeyhint="search"
          :model-value="search"
          @update:model-value="emit('update:search', $event)"
        />
      </div>
      <AppButton
        variant="secondary"
        size="lg"
        class="sale-picker__scan"
        data-action="scan"
        type="button"
        @click="emit('scan')"
      >
        <span
          class="sale-picker__scan-icon"
          aria-hidden="true"
        >📷</span>
        Escanear
      </AppButton>
    </div>

    <CategoryQuickFilter
      :categories="categories"
      :model-value="category"
      @update:model-value="emit('update:category', $event)"
    />

    <!-- Aviso suave (no alerta): el catálogo viene de la copia guardada -->
    <p
      v-if="fromSnapshot"
      class="sale-picker__notice"
      role="status"
    >
      {{ snapshotText }}
    </p>

    <div
      v-if="errorMessage && products.length === 0"
      class="sale-picker__error"
      role="alert"
    >
      <p>{{ errorMessage }}</p>
      <AppButton
        variant="secondary"
        size="lg"
        data-action="retry"
        type="button"
        @click="emit('retry')"
      >
        Intentar de nuevo
      </AppButton>
    </div>

    <p
      v-else-if="loading && products.length === 0"
      class="sale-picker__status"
      role="status"
    >
      Cargando tu catálogo…
    </p>
    <p
      v-else-if="products.length === 0"
      class="sale-picker__status"
    >
      {{ hasFilter ? 'No encontramos ese producto.' : 'Todavía no hay productos para vender.' }}
    </p>

    <ul
      v-else
      class="sale-picker__grid"
    >
      <li
        v-for="product in products"
        :key="product.id"
        class="sale-picker__cell"
      >
        <button
          type="button"
          class="sale-picker__item"
          :class="{ 'sale-picker__item--sold-out': isSoldOut(product) }"
          :aria-disabled="isSoldOut(product) ? 'true' : undefined"
          :aria-label="itemLabel(product)"
          @click="onSelect(product)"
        >
          <ProductCard
            :product="product"
            size="large"
          />
          <span
            v-if="inCart.has(product.id)"
            class="sale-picker__mark"
          >En tu venta</span>
        </button>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { minorToDisplay } from '@/utils/money'
import { catalogSnapshotMessage } from '@/config/voice'
import type { Product } from '@/types/product.types'
import AppButton from '../atoms/AppButton.vue'
import AppInput from '../atoms/AppInput.vue'
import CategoryQuickFilter from '../molecules/CategoryQuickFilter.vue'
import ProductCard from '../molecules/ProductCard.vue'

const props = defineProps<{
  /** Productos ya filtrados por búsqueda y categoría */
  products: Product[]
  search: string
  categories: string[]
  /** Categoría activa; cadena vacía = todas */
  category: string
  loading: boolean
  /** Mensaje amable si no hay catálogo que mostrar */
  errorMessage: string | null
  /** El catálogo mostrado es la copia guardada, no una carga fresca */
  fromSnapshot: boolean
  /** ISO de cuándo se guardó/cargó esa copia */
  snapshotSavedAt: string | null
  /** Ids de productos que ya están en la venta ("En tu venta") */
  inCartIds: string[]
}>()

const emit = defineEmits<{
  'update:search': [text: string]
  'update:category': [category: string]
  select: [product: Product]
  scan: []
  retry: []
}>()

const inCart = computed(() => new Set(props.inCartIds))
const hasFilter = computed(() => props.search.trim() !== '' || props.category !== '')
const snapshotText = computed(() =>
  props.snapshotSavedAt
    ? catalogSnapshotMessage(props.snapshotSavedAt)
    : 'Estás viendo el catálogo guardado en este dispositivo.',
)

const isSoldOut = (product: Product) => product.stock <= 0

function itemLabel(product: Product): string {
  if (isSoldOut(product)) return `${product.name}, agotado`
  const base = `Agregar ${product.name}, $${minorToDisplay(product.unitPriceMinor)}`
  return inCart.value.has(product.id) ? `${base}, ya está en tu venta` : base
}

function onSelect(product: Product) {
  // Un agotado no se elige: el botón se ve apagado y no hace nada.
  if (isSoldOut(product)) return
  emit('select', product)
}
</script>

<style scoped>
.sale-picker { display: flex; flex-direction: column; gap: var(--spacing-md); min-width: 0; }

.sale-picker__toolbar { display: flex; align-items: stretch; gap: var(--spacing-sm); }
.sale-picker__search { flex: 1 1 auto; min-width: 0; }
/* Buscador de 56 px, como el del catálogo en Modo Venta */
.sale-picker__search :deep(.app-input) {
  min-height: 3.5rem;
  font-size: var(--font-size-lg);
  border-width: 2px;
}
.sale-picker .sale-picker__scan { min-height: 3.5rem; font-size: var(--font-size-md); font-weight: 700; flex: 0 0 auto; }
.sale-picker__scan-icon { font-size: 1.4rem; line-height: 1; }

.sale-picker__notice {
  margin: 0;
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-sm);
  color: var(--color-info);
  background: var(--color-info-soft);
  border-radius: var(--radius-md);
}

.sale-picker__status { margin: 0; padding: var(--spacing-lg); text-align: center; font-size: var(--font-size-md); color: var(--color-text-muted); }
.sale-picker__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  text-align: center;
  color: var(--color-text);
  background: var(--color-warning-soft);
  border-radius: var(--radius-lg);
}
.sale-picker__error p { margin: 0; }

.sale-picker__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 10.5rem), 1fr));
  gap: var(--spacing-md);
  margin: 0;
  padding: 0;
  list-style: none;
}
.sale-picker__cell { min-width: 0; }

/* Toda la tarjeta es el botón: tocar en cualquier parte agrega */
.sale-picker__item {
  position: relative;
  display: block;
  width: 100%;
  padding: 0;
  font: inherit;
  text-align: left;
  color: inherit;
  background: none;
  border: 0;
  border-radius: var(--radius-lg);
  cursor: pointer;
  touch-action: manipulation;
}
.sale-picker__item:hover:not(.sale-picker__item--sold-out) :deep(.product-card) { box-shadow: var(--shadow-md); }
.sale-picker__item:active:not(.sale-picker__item--sold-out) { transform: scale(0.98); }
.sale-picker__item:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 3px; }
.sale-picker__item--sold-out { cursor: not-allowed; opacity: 0.55; }

/* Marca con texto y borde, no solo color */
.sale-picker__mark {
  position: absolute;
  top: var(--spacing-sm);
  left: var(--spacing-sm);
  padding: 0.2rem 0.6rem;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-on-primary);
  background: var(--color-success);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-sm);
}

/* Tarjetas más compactas que las del catálogo de gestión (varias por fila) */
.sale-picker :deep(.product-card--large .product-card__body) { padding: var(--spacing-sm) var(--spacing-md) var(--spacing-md); }
.sale-picker :deep(.product-card--large .product-card__name) { font-size: var(--font-size-md); }
.sale-picker :deep(.product-card--large .product-card__price) { font-size: var(--font-size-lg); }
</style>
