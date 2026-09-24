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
.app-badge--blue   { color: var(--color-primary);  background: rgba(37,99,235,.1);   border-color: rgba(37,99,235,.25); }
.app-badge--green  { color: var(--color-success);  background: rgba(16,185,129,.1);  border-color: rgba(16,185,129,.25); }
.app-badge--red    { color: var(--color-danger);   background: rgba(239,68,68,.1);   border-color: rgba(239,68,68,.25); }
.app-badge--amber  { color: #d97706;               background: rgba(234,179,8,.1);   border-color: rgba(234,179,8,.25); }
.app-badge--gray   { color: var(--color-text-muted); background: var(--color-border); border-color: var(--color-border); }
.app-badge--purple { color: #7c3aed;               background: rgba(124,58,237,.1);  border-color: rgba(124,58,237,.25); }

/* ── Variante filled (fondo sólido) ───────────────────────────────── */
.app-badge--filled.app-badge--blue   { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
.app-badge--filled.app-badge--green  { background: var(--color-success); color: #fff; border-color: var(--color-success); }
.app-badge--filled.app-badge--red    { background: var(--color-danger);  color: #fff; border-color: var(--color-danger);  }
.app-badge--filled.app-badge--amber  { background: #d97706;              color: #fff; border-color: #d97706;              }
.app-badge--filled.app-badge--gray   { background: var(--color-text-muted); color: #fff; border-color: var(--color-text-muted); }
.app-badge--filled.app-badge--purple { background: #7c3aed;              color: #fff; border-color: #7c3aed;              }
</style>
