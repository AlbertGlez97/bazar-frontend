<template>
  <!-- Molécula: control de paginación con páginas calculadas automáticamente -->
  <nav
    v-if="totalPages > 1"
    class="app-pagination"
    aria-label="Paginación"
  >
    <!-- Anterior -->
    <button
      class="app-pag-btn"
      :disabled="currentPage <= 1"
      aria-label="Página anterior"
      @click="emit('update:currentPage', currentPage - 1)"
    >
      ‹
    </button>

    <!-- Páginas con elipsis -->
    <template
      v-for="(page, i) in pages"
      :key="i"
    >
      <span
        v-if="page === '...'"
        class="app-pag-ellipsis"
      >…</span>
      <button
        v-else
        class="app-pag-btn"
        :class="{ 'app-pag-btn--active': page === currentPage }"
        @click="emit('update:currentPage', page as number)"
      >
        {{ page }}
      </button>
    </template>

    <!-- Siguiente -->
    <button
      class="app-pag-btn"
      :disabled="currentPage >= totalPages"
      aria-label="Página siguiente"
      @click="emit('update:currentPage', currentPage + 1)"
    >
      ›
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  currentPage: number
  totalPages:  number
  siblings?:   number   // páginas a mostrar a cada lado de la actual
}>(), { siblings: 1 })

const emit = defineEmits<{ 'update:currentPage': [page: number] }>()

// Genera array de páginas con elipsis donde sea necesario
const pages = computed(() => {
  const { currentPage: cur, totalPages: total, siblings } = props
  const items: (number | '...')[] = []
  const range: number[] = []

  for (let i = Math.max(2, cur - siblings); i <= Math.min(total - 1, cur + siblings); i++) {
    range.push(i)
  }

  items.push(1)
  if (range[0] > 2)                            items.push('...')
  items.push(...range)
  if (range[range.length - 1] < total - 1)    items.push('...')
  if (total > 1)                               items.push(total)

  return items
})
</script>

<style scoped>
.app-pagination {
  display:     inline-flex;
  align-items: center;
  gap:         4px;
}
.app-pag-btn {
  min-width:     30px;
  height:        30px;
  padding:       0 6px;
  background:    transparent;
  border:        1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color:         var(--color-text-muted);
  font-size:     0.82rem;
  font-family:   inherit;
  cursor:        pointer;
  display:       inline-flex;
  align-items:   center;
  justify-content: center;
  transition:    background var(--transition), color var(--transition), border-color var(--transition);
}
.app-pag-btn:hover:not(:disabled):not(.app-pag-btn--active) {
  background:   var(--color-border);
  color:        var(--color-text);
}
.app-pag-btn--active {
  background:   var(--color-primary);
  border-color: var(--color-primary);
  color:        #fff;
  font-weight:  600;
}
.app-pag-btn:disabled { opacity: .4; cursor: not-allowed; }

.app-pag-ellipsis {
  color:     var(--color-text-muted);
  font-size: 0.82rem;
  padding:   0 2px;
  user-select: none;
}
</style>
