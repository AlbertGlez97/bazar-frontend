<template>
  <!-- Organismo: grid de productos con búsqueda (con debounce) y paginación -->
  <div
    class="product-catalog-grid"
    :class="`product-catalog-grid--${mode}`"
  >
    <div class="product-catalog-grid__toolbar">
      <!-- En venta el buscador es grande y la barra queda fija arriba -->
      <div class="product-catalog-grid__search">
        <AppInput
          :model-value="searchTerm"
          :size="isVenta ? 'lg' : 'md'"
          placeholder="Buscar productos..."
          @update:model-value="handleSearchInput"
        />
      </div>
      <!-- Solo socios y solo en gestión: el backend ignora includeInactive
           para colaboradores, y en venta lo inactivo no es asunto del mostrador -->
      <AppSwitch
        v-if="showInactiveToggle && !isVenta"
        :model-value="includeInactive"
        @update:model-value="$emit('update:includeInactive', $event)"
      >
        Mostrar inactivos
      </AppSwitch>

      <!-- Vista: cuadrícula o lista. Solo en gestión (venta tiene su propio
           selector en SaleCatalogPicker, con su propia preferencia guardada). -->
      <div
        v-if="!isVenta"
        class="product-catalog-grid__view"
        role="group"
        aria-label="Vista del catálogo"
      >
        <button
          type="button"
          class="product-catalog-grid__view-btn"
          data-view="grid"
          :aria-pressed="view === 'grid'"
          @click="setView('grid')"
        >
          <span aria-hidden="true">▦</span>
          Cuadrícula
        </button>
        <button
          type="button"
          class="product-catalog-grid__view-btn"
          data-view="list"
          :aria-pressed="view === 'list'"
          @click="setView('list')"
        >
          <span aria-hidden="true">☰</span>
          Lista
        </button>
      </div>
    </div>

    <p
      v-if="loading"
      class="product-catalog-grid__status"
    >
      Cargando tu catálogo…
    </p>
    <p
      v-else-if="products.length === 0"
      class="product-catalog-grid__status"
    >
      No encontramos productos por aquí.
    </p>

    <div
      v-else
      class="product-catalog-grid__grid"
      :class="{ 'product-catalog-grid__grid--list': view === 'list' && !isVenta }"
    >
      <ProductCard
        v-for="product in products"
        :key="product.id"
        :product="product"
        :size="isVenta ? 'large' : 'default'"
        :show-actions="showActions && !isVenta"
        :selectable="selectable"
        :selected="selectedSet.has(product.id)"
        @toggle-select="$emit('toggle-select', $event)"
        @edit="$emit('edit', product)"
        @deactivate="$emit('deactivate', product)"
        @reactivate="$emit('reactivate', product)"
      />
    </div>

    <AppPagination
      :current-page="page"
      :total-pages="totalPages"
      :size="isVenta ? 'lg' : 'md'"
      @update:current-page="$emit('update:page', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ManageCatalogView } from '@/types/manage-catalog-view.types'
import type { Product } from '@/types/product.types'
import type { UiMode } from '@/types/ui-mode.types'
import AppInput from '../atoms/AppInput.vue'
import AppSwitch from '../atoms/AppSwitch.vue'
import ProductCard from '../molecules/ProductCard.vue'
import AppPagination from '../molecules/AppPagination.vue'

const props = withDefaults(defineProps<{
  products: Product[]
  page: number
  totalPages: number
  loading?: boolean
  showActions?: boolean
  /** Muestra el interruptor "Mostrar inactivos" (solo socios) */
  showInactiveToggle?: boolean
  includeInactive?: boolean
  /** ms de debounce antes de emitir "search" — evita disparar una petición por cada tecla */
  debounceMs?: number
  /**
   * Presentación del catálogo. `gestion` (por defecto) es la vista de
   * administración de siempre. `venta` es la vista de mostrador: tarjetas y
   * buscador grandes, objetivos táctiles de 44 px y sin acciones de gestión
   * (editar, desactivar, reactivar) ni "Mostrar inactivos", aunque el padre
   * las habilite. El organismo solo presenta: el modo lo decide el contenedor.
   */
  mode?: UiMode
  /**
   * Modo selección (imprimir códigos QR): casilla en cada tarjeta. Es gestión: en Modo
   * Venta no se ofrece aunque el padre lo pida.
   */
  selectionMode?: boolean
  /** Ids elegidos (pueden incluir productos de otras páginas que no están en pantalla). */
  selectedIds?: readonly string[]
  /** Cuadrícula (por defecto) o lista compacta. Solo aplica en gestión; quien la usa la guarda. */
  view?: ManageCatalogView
}>(), {
  loading: false,
  showActions: false,
  showInactiveToggle: false,
  includeInactive: false,
  debounceMs: 350,
  mode: 'gestion',
  selectionMode: false,
  selectedIds: () => [],
  view: 'grid',
})

const isVenta = computed(() => props.mode === 'venta')
const selectable = computed(() => props.selectionMode && !isVenta.value)
const selectedSet = computed(() => new Set(props.selectedIds))

const emit = defineEmits<{
  search: [term: string]
  'update:page': [page: number]
  'update:includeInactive': [value: boolean]
  edit: [product: Product]
  deactivate: [product: Product]
  reactivate: [product: Product]
  'toggle-select': [product: Product]
  'update:view': [view: ManageCatalogView]
}>()

/** Tocar la vista que ya está activa no cambia nada: no hay evento que guardar. */
function setView(next: ManageCatalogView) {
  if (next !== props.view) emit('update:view', next)
}

const searchTerm = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | undefined

function handleSearchInput(value: string) {
  searchTerm.value = value
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => emit('search', value), props.debounceMs)
}

defineExpose({ handleSearchInput })
</script>

<style scoped>
.product-catalog-grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}
.product-catalog-grid__toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-md);
}
.product-catalog-grid__search {
  flex: 1 1 16rem;
  max-width: 24rem;
}
.product-catalog-grid__status {
  color: var(--color-text-muted);
  text-align: center;
  padding: var(--spacing-lg);
}
.product-catalog-grid__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--spacing-md);
}
/* Vista de lista: una sola columna, tarjetas a lo ancho — mismos datos y
   acciones de siempre, solo cambia cuántas caben sin desplazarse de lado. */
.product-catalog-grid__grid--list {
  grid-template-columns: 1fr;
}

/* ── Selector de vista (cuadrícula / lista) — mismo patrón que el de Venta ── */
.product-catalog-grid__view { display: inline-flex; gap: var(--spacing-xs); padding: var(--spacing-xs); background: var(--color-surface-alt); border-radius: var(--radius-lg); }
.product-catalog-grid__view-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  min-width: 2.75rem;
  min-height: 2.75rem;
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
.product-catalog-grid__view-btn:hover { background: var(--color-surface); }
.product-catalog-grid__view-btn[aria-pressed='true'] { font-weight: 800; background: var(--color-surface); border-color: var(--color-border-strong); box-shadow: var(--shadow-sm); }
.product-catalog-grid__view-btn:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }

/* ── Modo Venta: presentación táctil y visual ───────────────────
   Todo lo interactivo mide al menos 44 px (guía de marca): el buscador
   (3.5rem = 56 px) y los botones de paginación (size="lg" = 44 px). */
.product-catalog-grid--venta .product-catalog-grid__search {
  flex: 1 1 100%;
  max-width: none;
}
.product-catalog-grid--venta .product-catalog-grid__search :deep(.app-input) {
  min-height: 3.5rem;
  font-size: var(--font-size-lg);
  border-width: 2px;
}
.product-catalog-grid--venta .product-catalog-grid__grid {
  /* min() evita el desborde en pantallas más angostas que 240 px de columna */
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr));
  gap: var(--spacing-lg);
}
</style>
