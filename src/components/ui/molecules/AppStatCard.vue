<template>
  <!-- Molécula: tarjeta de estadística — número grande + etiqueta, con
       sublabel/comparación y link opcionales. Inspirado en el hero de
       SalesReportSummary.vue, como pieza reutilizable independiente. Sin
       "to" es tan informativa como con él, pero no es clickeable (no hay
       <a>/<router-link> de por medio). -->
  <component
    :is="to ? RouterLink : 'div'"
    class="app-stat-card"
    :class="[{ 'app-stat-card--linked': !!to }, `app-stat-card--${tone}`]"
    v-bind="to ? { to } : {}"
  >
    <div class="app-stat-card__header">
      <span
        v-if="$slots.icon"
        class="app-stat-card__icon"
        aria-hidden="true"
      ><slot name="icon" /></span>
      <p class="app-stat-card__label">
        {{ label }}
      </p>
    </div>
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

withDefaults(defineProps<{
  label: string
  /** El número grande, ya formateado (ej. "$1,300.50" o "3"). */
  value: string
  /** Comparación o dato de apoyo (ej. "2 ventas · +30% vs. ayer"). */
  sublabel?: string
  /** Ruta destino; sin ella la tarjeta no es clickeable. */
  to?: string
  /** Presentation only; the caller chooses a semantic brand accent. */
  tone?: 'primary' | 'success' | 'warning' | 'info'
}>(), { tone: 'primary', sublabel: undefined, to: undefined })
</script>

<style scoped>
.app-stat-card {
  --stat-accent: var(--color-primary-hover);
  --stat-soft: var(--color-primary-soft);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  min-width: 0;
  padding: var(--spacing-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-top: 3px solid var(--stat-accent);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  text-decoration: none;
  color: inherit;
}
.app-stat-card--success { --stat-accent: var(--color-success); --stat-soft: var(--color-success-soft); }
.app-stat-card--warning { --stat-accent: var(--color-warning); --stat-soft: var(--color-warning-soft); }
.app-stat-card--info { --stat-accent: var(--color-info); --stat-soft: var(--color-info-soft); }

.app-stat-card__header { display: flex; align-items: center; gap: var(--spacing-sm); }
.app-stat-card__icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: var(--radius-md);
  background: var(--stat-soft);
  color: var(--stat-accent);
}
.app-stat-card__icon :deep(svg) { width: 1.5rem; height: 1.5rem; }

.app-stat-card--linked {
  cursor: pointer;
  transition: background var(--transition), box-shadow var(--transition);
}
.app-stat-card--linked:hover {
  background: var(--color-bg);
  box-shadow: var(--shadow-md);
}
.app-stat-card--linked:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.app-stat-card__label {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-muted);
}
.app-stat-card__value {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--font-size-2xl);
  font-weight: 800;
  line-height: 1.2;
  color: var(--color-text);
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}
.app-stat-card__sublabel {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
</style>
