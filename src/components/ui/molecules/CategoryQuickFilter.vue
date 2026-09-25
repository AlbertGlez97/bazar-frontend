<template>
  <!-- Molécula: fila de categorías para filtrar de un toque. "Todo" + cada
       categoría, con scroll horizontal si no caben. `aria-pressed` marca la
       activa (además del color, lleva un borde más grueso). -->
  <div
    v-if="categories.length > 0"
    class="category-filter"
    role="group"
    aria-label="Filtrar por categoría"
  >
    <button
      type="button"
      class="category-filter__btn"
      :class="{ 'category-filter__btn--active': modelValue === '' }"
      :aria-pressed="modelValue === ''"
      @click="emit('update:modelValue', '')"
    >
      Todo
    </button>
    <button
      v-for="category in categories"
      :key="category"
      type="button"
      class="category-filter__btn"
      :class="{ 'category-filter__btn--active': modelValue === category }"
      :aria-pressed="modelValue === category"
      @click="emit('update:modelValue', category)"
    >
      {{ category }}
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  categories: string[]
  /** Categoría elegida; cadena vacía = todas */
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [category: string]
}>()
</script>

<style scoped>
.category-filter {
  display: flex;
  gap: var(--spacing-sm);
  overflow-x: auto;
  padding-bottom: var(--spacing-xs);
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
}

.category-filter__btn {
  flex: 0 0 auto;
  min-width: 44px;
  min-height: 44px;
  padding: 0 var(--spacing-md);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: 700;
  white-space: nowrap;
  color: var(--color-text);
  background: var(--color-surface);
  border: 2px solid var(--color-border-strong);
  border-radius: var(--radius-full);
  cursor: pointer;
  scroll-snap-align: start;
  touch-action: manipulation;
  transition: background var(--transition), color var(--transition), border-color var(--transition);
}
.category-filter__btn:hover:not(.category-filter__btn--active) { background: var(--color-surface-alt); }
.category-filter__btn:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }
.category-filter__btn--active {
  color: var(--color-on-primary);
  background: var(--color-primary);
  border-color: var(--color-primary-hover);
}
</style>
