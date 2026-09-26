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

    <!-- Vista: cuadrícula o lista. Dos botones de alternancia (aria-pressed), con
         texto visible y no solo ícono; el activo se distingue por relleno y borde. -->
    <div class="sale-picker__options">
      <div
        class="sale-picker__view"
        role="group"
        aria-label="Vista del catálogo"
      >
        <button
          type="button"
          class="sale-picker__view-btn"
          data-view="grid"
          :aria-pressed="view === 'grid'"
          @click="setView('grid')"
        >
          <span
            class="sale-picker__view-icon"
            aria-hidden="true"
          >▦</span>
          Cuadrícula
        </button>
        <button
          type="button"
          class="sale-picker__view-btn"
          data-view="list"
          :aria-pressed="view === 'list'"
          @click="setView('list')"
        >
          <span
            class="sale-picker__view-icon"
            aria-hidden="true"
          >☰</span>
          Lista
        </button>
      </div>
    </div>

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

    <!-- Un solo botón por producto en las dos vistas: mismo nombre accesible, mismo
         "agotado no se elige", mismo evento. Cambia solo cómo se ve por dentro. -->
    <ul
      v-else
      :class="view === 'list' ? 'sale-picker__list' : 'sale-picker__grid'"
    >
      <li
        v-for="product in products"
        :key="product.id"
        class="sale-picker__cell"
      >
        <button
          type="button"
          class="sale-picker__item"
          :class="{
            'sale-picker__item--row': view === 'list',
            'sale-picker__item--sold-out': isSoldOut(product),
          }"
          :aria-disabled="isSoldOut(product) ? 'true' : undefined"
          :aria-label="itemLabel(product)"
          @click="onSelect(product)"
        >
          <ProductCard
            v-if="view !== 'list'"
            :product="product"
            size="large"
          />
          <template v-else>
            <span class="sale-picker__thumb">
              <img
                v-if="product.image"
                :src="product.image"
                alt=""
                class="sale-picker__thumb-img"
              >
              <span
                v-else
                class="sale-picker__thumb-placeholder"
                aria-hidden="true"
              >📦</span>
            </span>
            <span class="sale-picker__row-body">
              <span class="sale-picker__row-name">{{ product.name }}</span>
              <span class="sale-picker__row-meta">
                <AppBadge :color="isSoldOut(product) ? 'red' : 'green'">
                  {{ isSoldOut(product) ? 'Agotado' : 'Disponible' }}
                </AppBadge>
                <span
                  v-if="inCart.has(product.id)"
                  class="sale-picker__mark"
                >En tu venta</span>
              </span>
            </span>
            <span class="sale-picker__row-price">${{ minorToDisplay(product.unitPriceMinor) }}</span>
          </template>
          <span
            v-if="view !== 'list' && inCart.has(product.id)"
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
import type { SaleCatalogView } from '@/types/sale-catalog-view.types'
import AppBadge from '../atoms/AppBadge.vue'
import AppButton from '../atoms/AppButton.vue'
import AppInput from '../atoms/AppInput.vue'
import CategoryQuickFilter from '../molecules/CategoryQuickFilter.vue'
import ProductCard from '../molecules/ProductCard.vue'

const props = withDefaults(defineProps<{
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
  /** Cómo se ve el catálogo: tarjetas (por defecto) o filas compactas. Lo guarda quien lo usa. */
  view?: SaleCatalogView
}>(), {
  view: 'grid',
})

const emit = defineEmits<{
  'update:search': [text: string]
  'update:category': [category: string]
  'update:view': [view: SaleCatalogView]
  select: [product: Product]
  scan: []
  retry: []
}>()

/** Tocar la vista que ya está activa no cambia nada: no hay evento que guardar. */
function setView(next: SaleCatalogView) {
  if (next !== props.view) emit('update:view', next)
}

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

/* ── Selector de vista (cuadrícula / lista) ───────────────────────────── */
.sale-picker__options { display: flex; justify-content: flex-end; }
.sale-picker__view { display: inline-flex; gap: var(--spacing-xs); padding: var(--spacing-xs); background: var(--color-surface-alt); border-radius: var(--radius-lg); }
/* Botones de 44 px como mínimo al tacto (guía de marca). El activo se ve por
   relleno, borde y peso de letra: nunca solo por color. */
.sale-picker__view-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  min-width: 44px;
  min-height: 44px;
  padding: 0 var(--spacing-md);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
  background: transparent;
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  touch-action: manipulation;
}
.sale-picker__view-btn:hover { background: var(--color-surface); }
.sale-picker__view-btn[aria-pressed='true'] { font-weight: 800; background: var(--color-surface); border-color: var(--color-border-strong); box-shadow: var(--shadow-sm); }
.sale-picker__view-btn:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }
.sale-picker__view-icon { font-size: 1.1rem; line-height: 1; }

/* ── Vista de lista: filas compactas, varios productos sin tanto desplazamiento ── */
.sale-picker__list { display: flex; flex-direction: column; gap: var(--spacing-xs); margin: 0; padding: 0; list-style: none; }
/* La fila es el mismo botón que la tarjeta: se le cambia la forma, no el comportamiento.
   64 px de alto: cómodo para el dedo y caben unas ocho a la vista en un celular. */
.sale-picker__item--row {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--spacing-sm);
  min-height: 4rem;
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-surface);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-lg);
}
.sale-picker__item--row:hover:not(.sale-picker__item--sold-out) { border-color: var(--color-border-strong); }
.sale-picker__thumb { display: flex; align-items: center; justify-content: center; width: 3rem; height: 3rem; overflow: hidden; background: var(--color-bg); border-radius: var(--radius-md); }
.sale-picker__thumb-img { width: 100%; height: 100%; object-fit: cover; }
.sale-picker__thumb-placeholder { font-size: 1.5rem; opacity: 0.4; }
.sale-picker__row-body { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
.sale-picker__row-name { font-size: var(--font-size-md); font-weight: 700; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sale-picker__row-meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-xs); }
.sale-picker__row-price { font-family: var(--font-display); font-size: var(--font-size-lg); font-weight: 800; white-space: nowrap; color: var(--color-text); }
/* En la fila la marca "En tu venta" va en la línea de estado, no flotando sobre una foto */
.sale-picker__item--row .sale-picker__mark { position: static; padding: 0.1rem 0.5rem; box-shadow: none; }

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
