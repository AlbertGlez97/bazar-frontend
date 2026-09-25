<template>
  <!-- Átomo: botón base del sistema de diseño — cubre todos los contextos UI -->
  <component
    :is="tag"
    class="app-btn"
    :class="[
      `app-btn--${variant}`,
      `app-btn--${size}`,
      {
        'app-btn--loading': loading,
        'app-btn--block': block,
        'app-btn--icon-only': iconOnly,
      },
    ]"
    :disabled="tag === 'button' ? (disabled || loading) : undefined"
    v-bind="$attrs"
  >
    <!-- Spinner de carga — reemplaza el slot cuando loading=true -->
    <span
      v-if="loading"
      class="app-btn__spinner"
      aria-hidden="true"
    />
    <slot v-else />
  </component>
</template>

<script setup lang="ts">
// Define todos los props; tag permite usarlo como RouterLink o <a>
withDefaults(defineProps<{
  variant?:  'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
           | 'soft-primary' | 'soft-danger' | 'soft-success' | 'soft-warning'
  size?:     'xs' | 'sm' | 'md' | 'lg' | 'xl'
  loading?:  boolean
  disabled?: boolean
  block?:    boolean
  iconOnly?: boolean
  tag?:      string | object
}>(), {
  variant:  'primary',
  size:     'md',
  loading:  false,
  disabled: false,
  block:    false,
  iconOnly: false,
  tag:      'button',
})

// Hereda atributos (como `to`, `href`, `type`) automáticamente via $attrs
defineOptions({ inheritAttrs: true })
</script>

<style scoped>
/* ── Base ─────────────────────────────────────────────────────────── */
.app-btn {
  display:         inline-flex;
  align-items:     center;
  justify-content: center;
  gap:             0.375rem;
  font-family:     inherit;
  font-weight:     500;
  border:          1px solid transparent;
  border-radius:   var(--radius-sm);
  cursor:          pointer;
  white-space:     nowrap;
  text-decoration: none;
  transition:      background var(--transition), color var(--transition),
                   border-color var(--transition), opacity var(--transition);
  line-height:     1.2;
}
.app-btn:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }
.app-btn:disabled,
.app-btn--loading { opacity: .6; cursor: not-allowed; pointer-events: none; }
.app-btn--block   { width: 100%; }

/* ── Tamaños — padding/height en rem para escalar con user font-prefs ─ */
.app-btn--xs { padding: 0.375rem 0.625rem; font-size: 0.75rem;   min-height: 2rem;    }
.app-btn--sm { padding: 0.5rem   0.875rem; font-size: 0.8125rem; min-height: 2.25rem; }
.app-btn--md { padding: 0.625rem 1rem;     font-size: 0.9375rem; min-height: 2.5rem;  }
.app-btn--lg { padding: 0.75rem  1.25rem;  font-size: 1rem;      min-height: 2.75rem; }
.app-btn--xl { padding: 0.875rem 1.5rem;   font-size: 1.0625rem; min-height: 3rem;    }

/* Mobile: eleva touch targets de tamaños principales a ≥ 44px (Apple HIG) */
@media (max-width: 767px) {
  .app-btn--md,
  .app-btn--lg,
  .app-btn--xl { min-height: 2.75rem; }
}

/* Botón de solo ícono: cuadrado con min-width para preservar área táctil */
.app-btn--icon-only.app-btn--xs { padding: 0.375rem; min-width: 2rem;    }
.app-btn--icon-only.app-btn--sm { padding: 0.5rem;   min-width: 2.25rem; }
.app-btn--icon-only.app-btn--md { padding: 0.625rem; min-width: 2.5rem;  }
.app-btn--icon-only.app-btn--lg { padding: 0.75rem;  min-width: 2.75rem; }
.app-btn--icon-only.app-btn--xl { padding: 0.875rem; min-width: 3rem;    }

/* ── Variantes sólidas ────────────────────────────────────────────── */
.app-btn--primary {
  background: var(--color-primary);
  color: var(--color-on-primary);
  border-color: var(--color-primary);
}
.app-btn--primary:hover:not(:disabled):not(.app-btn--loading) {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.app-btn--secondary {
  background: transparent;
  color: var(--color-text);
  border-color: var(--color-border-strong);
}
.app-btn--secondary:hover:not(:disabled):not(.app-btn--loading) {
  background: var(--color-surface-alt);
}

.app-btn--ghost {
  background: transparent;
  color: var(--color-text-muted);
  border-color: transparent;
}
.app-btn--ghost:hover:not(:disabled):not(.app-btn--loading) {
  background: color-mix(in srgb, currentColor 10%, transparent);
  color: var(--color-text);
}

.app-btn--danger {
  background: var(--color-danger);
  color: var(--color-on-primary);
  border-color: var(--color-danger);
}
.app-btn--danger:hover:not(:disabled):not(.app-btn--loading) {
  filter: brightness(.9);
}

.app-btn--success {
  background: var(--color-success);
  color: var(--color-on-primary);
  border-color: var(--color-success);
}
.app-btn--success:hover:not(:disabled):not(.app-btn--loading) {
  filter: brightness(.9);
}

/* ── Variantes soft (fondo semitransparente) ──────────────────────── */
.app-btn--soft-primary {
  background: var(--color-primary-soft);
  color: var(--color-primary-hover);
  border-color: color-mix(in srgb, var(--color-primary) 30%, transparent);
}
.app-btn--soft-primary:hover:not(:disabled):not(.app-btn--loading) {
  background: color-mix(in srgb, var(--color-primary) 20%, var(--color-surface));
}

.app-btn--soft-danger {
  background: var(--color-danger-soft);
  color: var(--color-danger);
  border-color: color-mix(in srgb, var(--color-danger) 30%, transparent);
}
.app-btn--soft-danger:hover:not(:disabled):not(.app-btn--loading) {
  background: color-mix(in srgb, var(--color-danger) 18%, var(--color-surface));
}

.app-btn--soft-success {
  background: var(--color-success-soft);
  color: var(--color-success);
  border-color: color-mix(in srgb, var(--color-success) 30%, transparent);
}
.app-btn--soft-success:hover:not(:disabled):not(.app-btn--loading) {
  background: color-mix(in srgb, var(--color-success) 18%, var(--color-surface));
}

.app-btn--soft-warning {
  background: var(--color-warning-soft);
  color: var(--color-warning);
  border-color: color-mix(in srgb, var(--color-warning) 30%, transparent);
}
.app-btn--soft-warning:hover:not(:disabled):not(.app-btn--loading) {
  background: color-mix(in srgb, var(--color-accent) 40%, var(--color-surface));
}

/* ── Spinner de carga ─────────────────────────────────────────────── */
.app-btn__spinner {
  display:       inline-block;
  width:         14px;
  height:        14px;
  border:        2px solid color-mix(in srgb, currentColor 30%, transparent);
  border-top-color: currentColor;
  border-radius: 50%;
  animation:     btn-spin .65s linear infinite;
}
@keyframes btn-spin { to { transform: rotate(360deg); } }
</style>
