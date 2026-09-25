<template>
  <!-- Átomo: etiqueta de estado/categoría — colores semánticos -->
  <span
    class="app-badge"
    :class="[`app-badge--${color}`, { 'app-badge--filled': filled }]"
  >
    <slot />
  </span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  color?:  'blue' | 'green' | 'red' | 'amber' | 'gray' | 'purple'
  filled?: boolean
}>(), {
  color:  'blue',
  filled: false,
})
</script>

<style scoped>
.app-badge {
  display:       inline-flex;
  align-items:   center;
  gap:           0.25rem;
  font-size:     0.75rem;                /* 12px — mínimo WCAG legible */
  font-weight:   600;
  padding:       0.125rem 0.5rem;
  border-radius: var(--radius-full, 9999px);
  border:        1px solid transparent;
  white-space:   nowrap;
  letter-spacing: .02em;
  line-height:   1.4;
}

/* ── Variante outline (por defecto) ───────────────────────────────── */
/* Los nombres de color son parte de la API del átomo (se conservan); cada uno
   apunta a un token de marca: blue = informativo (talavera), purple = rosa. */
.app-badge--blue   { color: var(--color-info);     background: var(--color-info-soft);    border-color: color-mix(in srgb, var(--color-info) 30%, transparent); }
.app-badge--green  { color: var(--color-success);  background: var(--color-success-soft); border-color: color-mix(in srgb, var(--color-success) 30%, transparent); }
.app-badge--red    { color: var(--color-danger);   background: var(--color-danger-soft);  border-color: color-mix(in srgb, var(--color-danger) 30%, transparent); }
.app-badge--amber  { color: var(--color-warning);  background: var(--color-warning-soft); border-color: color-mix(in srgb, var(--color-warning) 30%, transparent); }
.app-badge--gray   { color: var(--color-text-muted); background: var(--color-surface-alt); border-color: var(--color-border); }
.app-badge--purple { color: var(--color-rosa);     background: var(--color-surface);      border-color: var(--color-rosa); }

/* ── Variante filled (fondo sólido) ───────────────────────────────── */
.app-badge--filled.app-badge--blue   { background: var(--color-info);    color: var(--color-on-primary); border-color: var(--color-info); }
.app-badge--filled.app-badge--green  { background: var(--color-success); color: var(--color-on-primary); border-color: var(--color-success); }
.app-badge--filled.app-badge--red    { background: var(--color-danger);  color: var(--color-on-primary); border-color: var(--color-danger);  }
.app-badge--filled.app-badge--amber  { background: var(--color-accent);  color: var(--color-on-accent);  border-color: var(--color-accent);  }
.app-badge--filled.app-badge--gray   { background: var(--color-text-muted); color: var(--color-on-primary); border-color: var(--color-text-muted); }
.app-badge--filled.app-badge--purple { background: var(--color-rosa);    color: var(--color-on-primary); border-color: var(--color-rosa);    }
</style>
