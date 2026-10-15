<template>
  <!-- Organismo: botón "Filtros" (con insignia de filtros activos) y su panel
       desplegable con los interruptores del catálogo de Productos. Solo presenta:
       recibe los filtros y emite el conjunto nuevo; la vista decide qué hacer. -->
  <AppDropdownPanel
    v-model="isOpen"
    class="product-filters-panel"
    :title="labels.panelTitle"
    :close-label="labels.close"
  >
    <template #trigger="{ attrs }">
      <AppButton
        variant="secondary"
        v-bind="attrs"
        :aria-label="triggerLabel"
      >
        {{ labels.button }}
        <AppBadge
          v-if="activeCount > 0"
          class="product-filters-panel__count"
          color="blue"
          filled
          aria-hidden="true"
        >
          {{ activeCount }}
        </AppBadge>
      </AppButton>
    </template>

    <fieldset class="product-filters-panel__group">
      <legend class="product-filters-panel__legend">
        {{ labels.groups.existencia }}
      </legend>
      <FilterSwitchRow
        :label="labels.lowStock"
        :model-value="filters.pocaExistencia"
        @update:model-value="set('pocaExistencia', $event)"
      />
      <FilterSwitchRow
        :label="labels.soldOut"
        :model-value="filters.agotados"
        @update:model-value="set('agotados', $event)"
      />
    </fieldset>

    <!-- Ver inactivos es de socios: el servidor lo ignora para colaboradores -->
    <fieldset
      v-if="showInactive"
      class="product-filters-panel__group"
    >
      <legend class="product-filters-panel__legend">
        {{ labels.groups.estado }}
      </legend>
      <FilterSwitchRow
        :label="labels.inactive"
        :model-value="filters.inactivos"
        @update:model-value="set('inactivos', $event)"
      />
    </fieldset>

    <fieldset class="product-filters-panel__group">
      <legend class="product-filters-panel__legend">
        {{ labels.groups.tipo }}
      </legend>
      <FilterSwitchRow
        :label="labels.unica"
        :model-value="filters.tipo === 'unica'"
        @update:model-value="setTipo('unica', $event)"
      />
      <FilterSwitchRow
        :label="labels.cantidad"
        :model-value="filters.tipo === 'cantidad'"
        @update:model-value="setTipo('cantidad', $event)"
      />
    </fieldset>

    <fieldset class="product-filters-panel__group">
      <legend class="product-filters-panel__legend">
        {{ labels.groups.costo }}
      </legend>
      <FilterSwitchRow
        :label="labels.noCost"
        :model-value="filters.sinCosto"
        @update:model-value="set('sinCosto', $event)"
      />
    </fieldset>

    <template #footer>
      <AppButton
        variant="ghost"
        block
        :disabled="activeCount === 0"
        @click="clear"
      >
        {{ labels.clear }}
      </AppButton>
    </template>
  </AppDropdownPanel>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { VOICE } from '@/config/voice'
import type { ProductFilters, ProductTipoFilter } from '@/types/product-filters.types'
import { countActiveFilters, emptyProductFilters } from '@/utils/product-filters'
import AppBadge from '../atoms/AppBadge.vue'
import AppButton from '../atoms/AppButton.vue'
import AppDropdownPanel from '../molecules/AppDropdownPanel.vue'
import FilterSwitchRow from '../molecules/FilterSwitchRow.vue'

const props = withDefaults(defineProps<{
  filters: ProductFilters
  /** Ofrece "Mostrar inactivos" (solo socios). */
  showInactive?: boolean
}>(), { showInactive: false })

const emit = defineEmits<{ 'update:filters': [filters: ProductFilters] }>()

const labels = VOICE.productFilters
const isOpen = ref(false)

const activeCount = computed(() => countActiveFilters(props.filters))
const triggerLabel = computed(() =>
  activeCount.value > 0 ? `${labels.button}, ${labels.countLabel(activeCount.value)}` : labels.button)

function set(key: 'pocaExistencia' | 'agotados' | 'inactivos' | 'sinCosto', value: boolean) {
  emit('update:filters', { ...props.filters, [key]: value })
}

/** Única y Por cantidad son excluyentes: encender una reemplaza a la otra; apagar la activa deja el tipo sin filtrar. */
function setTipo(tipo: ProductTipoFilter, value: boolean) {
  emit('update:filters', { ...props.filters, tipo: value ? tipo : undefined })
}

function clear() {
  emit('update:filters', emptyProductFilters())
}
</script>

<style scoped>
.product-filters-panel__group {
  min-width: 0;
  margin: 0;
  padding: 0 0 var(--spacing-md);
  border: 0;
}
.product-filters-panel__group + .product-filters-panel__group {
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border);
}
.product-filters-panel__legend {
  padding: 0;
  margin-bottom: var(--spacing-xs);
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
</style>
