<template>
  <!-- Molécula: chips de los filtros activos, cada uno con su X para quitarlo -->
  <ul
    v-if="chips.length > 0"
    class="active-filter-chips"
    :aria-label="label"
  >
    <li
      v-for="chip in chips"
      :key="chip.key"
      class="active-filter-chips__chip"
    >
      <span class="active-filter-chips__text">{{ chip.label }}</span>
      <button
        type="button"
        class="active-filter-chips__remove"
        :aria-label="removeLabel(chip.label)"
        @click="$emit('remove', chip.key)"
      >
        <span aria-hidden="true">×</span>
      </button>
    </li>
  </ul>
</template>

<script setup lang="ts" generic="K extends string">
defineProps<{
  chips: ReadonlyArray<{ key: K; label: string }>
  /** Nombre accesible de la lista ("Filtros activos"). */
  label: string
  /** Nombre accesible de la X de cada chip, a partir de su etiqueta. */
  removeLabel: (label: string) => string
}>()

defineEmits<{ remove: [key: K] }>()
</script>

<style scoped>
.active-filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin: 0;
  padding: 0;
  list-style: none;
}
.active-filter-chips__chip {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: 0 0 0 var(--spacing-md);
  min-height: 2rem;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full, 9999px);
}
.active-filter-chips__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* Objetivo táctil de 44 px sin agrandar el chip: el área extra es transparente. */
  min-width: 2.75rem;
  min-height: 2.75rem;
  margin: -0.375rem 0;
  font-family: inherit;
  font-size: var(--font-size-md);
  line-height: 1;
  color: var(--color-text-muted);
  background: transparent;
  border: 0;
  border-radius: var(--radius-full, 9999px);
  cursor: pointer;
  touch-action: manipulation;
}
.active-filter-chips__remove:hover { color: var(--color-text); }
.active-filter-chips__remove:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: -3px;
}
</style>
