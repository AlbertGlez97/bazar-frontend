<template>
  <!-- Átomo: tarjeta de estadística — número grande + etiqueta, con
       sublabel/comparación y link opcionales. Inspirado en el hero de
       SalesReportSummary.vue, como pieza reutilizable independiente. Sin
       "to" es tan informativa como con él, pero no es clickeable (no hay
       <a>/<router-link> de por medio). -->
  <component
    :is="to ? RouterLink : 'div'"
    class="app-stat-card"
    :class="{ 'app-stat-card--linked': !!to }"
    v-bind="to ? { to } : {}"
  >
    <p class="app-stat-card__label">
      {{ label }}
    </p>
    <p class="app-stat-card__value">
      {{ value }}
    </p>
    <p
      v-if="sublabel"
      class="app-stat-card__sublabel"
    >
      {{ sublabel }}
    </p>
    <slot />
  </component>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineProps<{
  label: string
  /** El número grande, ya formateado (ej. "$1,300.50" o "3"). */
  value: string
  /** Comparación o dato de apoyo (ej. "2 ventas · +30% vs. ayer"). */
  sublabel?: string
  /** Ruta destino; sin ella la tarjeta no es clickeable. */
  to?: string
}>()
</script>

<style scoped>
.app-stat-card {
  display: block;
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-primary-soft);
  border-radius: var(--radius-lg);
  text-decoration: none;
  color: inherit;
}

.app-stat-card--linked {
  cursor: pointer;
  transition: background var(--transition);
}
.app-stat-card--linked:hover {
  background: color-mix(in srgb, var(--color-primary) 20%, var(--color-primary-soft));
}
.app-stat-card--linked:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.app-stat-card__label {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-primary-hover);
}
.app-stat-card__value {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--font-size-2xl);
  font-weight: 800;
  line-height: 1.2;
  color: var(--color-primary-hover);
}
.app-stat-card__sublabel {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-primary-hover);
}
</style>
