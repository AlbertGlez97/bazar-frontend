<template>
  <!-- Organismo: grid de productos con búsqueda (con debounce) y paginación -->
  <div class="product-catalog-grid">
    <div class="product-catalog-grid__toolbar">
      <AppInput
        :model-value="searchTerm"
        placeholder="Buscar productos..."
        @update:model-value="handleSearchInput"
      />
      <!-- Solo socios: el backend ignora includeInactive para colaboradores -->
      <AppSwitch
        v-if="showInactiveToggle"
        :model-value="includeInactive"
        @update:model-value="$emit('update:includeInactive', $event)"
      >
        Mostrar inactivos
      </AppSwitch>
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
    >
      <ProductCard
        v-for="product in products"
        :key="product.id"
        :product="product"
        :show-actions="showActions"
        @edit="$emit('edit', product)"
        @deactivate="$emit('deactivate', product)"
        @reactivate="$emit('reactivate', product)"
      />
    </div>

    <AppPagination
      :current-page="page"
      :total-pages="totalPages"
      @update:current-page="$emit('update:page', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Product } from '@/types/product.types'
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
}>(), {
  loading: false,
  showActions: false,
  showInactiveToggle: false,
  includeInactive: false,
  debounceMs: 350,
})

const emit = defineEmits<{
  search: [term: string]
  'update:page': [page: number]
  'update:includeInactive': [value: boolean]
  edit: [product: Product]
  deactivate: [product: Product]
  reactivate: [product: Product]
}>()

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
.product-catalog-grid__toolbar > :first-child {
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
</style>
