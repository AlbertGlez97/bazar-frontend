<template>
  <!-- Organismo: buscador de productos para armar la lista de impresión de
       códigos QR (D2). Presentacional y SIN casillas: cada resultado tiene un
       botón "Agregar" (nunca una lista larga para tildar). No hace fetch (regla
       de ui/): el contenedor escucha "search" (ya con debounce) y pasa
       resultados/estado por props, igual que ProductCatalogGrid con su store. -->
  <section
    class="product-search-picker"
    aria-label="Buscar producto para imprimir"
  >
    <AppInput
      type="search"
      :label="VOICE.codigosQr.searchLabel"
      :placeholder="VOICE.codigosQr.searchPlaceholder"
      autocomplete="off"
      enterkeyhint="search"
      :model-value="searchTerm"
      @update:model-value="onInput"
    />

    <AppAlert
      v-if="errorMessage"
      type="error"
      :show="true"
    >
      {{ errorMessage }}
      <AppButton
        variant="secondary"
        size="sm"
        type="button"
        @click="retry"
      >
        {{ VOICE.codigosQr.retry }}
      </AppButton>
    </AppAlert>
    <p
      v-else-if="loading"
      class="product-search-picker__status"
      role="status"
    >
      {{ VOICE.codigosQr.searching }}
    </p>
    <p
      v-else-if="searchTerm.trim() !== '' && results.length === 0"
      class="product-search-picker__status"
    >
      {{ VOICE.codigosQr.searchEmpty }}
    </p>

    <ul
      v-else-if="results.length > 0"
      class="product-search-picker__results"
    >
      <li
        v-for="product in results"
        :key="product.id"
        class="product-search-picker__row"
      >
        <span class="product-search-picker__name">{{ product.name }}</span>
        <span class="product-search-picker__price">${{ minorToDisplay(product.unitPriceMinor) }}</span>
        <AppButton
          variant="primary"
          size="sm"
          type="button"
          @click="$emit('add', product)"
        >
          {{ VOICE.codigosQr.add }}
        </AppButton>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { VOICE } from '@/config/voice'
import { minorToDisplay } from '@/utils/money'
import type { Product } from '@/types/product.types'
import AppAlert from '../molecules/AppAlert.vue'
import AppButton from '../atoms/AppButton.vue'
import AppInput from '../atoms/AppInput.vue'

const props = withDefaults(defineProps<{
  results: Product[]
  loading: boolean
  /** Mensaje de error (red); cadena vacía = sin error. */
  errorMessage: string
  /** ms de debounce antes de emitir "search" — mismo criterio que ProductCatalogGrid. */
  debounceMs?: number
}>(), {
  debounceMs: 350,
})

const emit = defineEmits<{
  search: [term: string]
  add: [product: Product]
}>()

const searchTerm = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | undefined

function onInput(value: string) {
  searchTerm.value = value
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => emit('search', value), props.debounceMs)
}

/** Reintentar no espera el debounce: repite la búsqueda actual de inmediato. */
function retry() {
  if (debounceTimer) clearTimeout(debounceTimer)
  emit('search', searchTerm.value)
}
</script>

<style scoped>
.product-search-picker {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
.product-search-picker__status {
  margin: 0;
  padding: var(--spacing-sm) 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
.product-search-picker__results {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin: 0;
  padding: 0;
  list-style: none;
}
.product-search-picker__row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.product-search-picker__name {
  flex: 1 1 auto;
  min-width: 0;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.product-search-picker__price {
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
  white-space: nowrap;
}
</style>
