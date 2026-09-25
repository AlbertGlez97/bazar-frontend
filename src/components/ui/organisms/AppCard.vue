<template>
  <!-- Molécula: tarjeta base con header, body y footer opcionales -->
  <div
    class="app-card"
    :class="{
      'app-card--hoverable': hoverable,
      'app-card--flat': flat,
      [`app-card--accent-${accent}`]: !!accent,
    }"
  >
    <!-- Header: título + slot de acción derecha -->
    <div
      v-if="title || $slots.header || $slots['header-right']"
      class="app-card__header"
    >
      <div class="app-card__header-left">
        <slot name="header">
          <p class="app-card__title">
            {{ title }}
          </p>
          <p
            v-if="subtitle"
            class="app-card__subtitle"
          >
            {{ subtitle }}
          </p>
        </slot>
      </div>
      <div
        v-if="$slots['header-right']"
        class="app-card__header-right"
      >
        <slot name="header-right" />
      </div>
    </div>

    <!-- Cuerpo principal -->
    <div
      class="app-card__body"
      :class="{ 'app-card__body--padded': !noPadding }"
    >
      <slot />
    </div>

    <!-- Footer: acciones -->
    <div
      v-if="$slots.footer"
      class="app-card__footer"
    >
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
// accent: color del borde superior — útil para métricas con color semántico
withDefaults(defineProps<{
  title?:     string
  subtitle?:  string
  hoverable?: boolean
  flat?:      boolean
  noPadding?: boolean
  accent?:    'primary' | 'success' | 'warning' | 'danger'
}>(), { title: undefined, subtitle: undefined, hoverable: false, flat: false, noPadding: false, accent: undefined })
</script>

<style scoped>
.app-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  transition: box-shadow var(--transition), transform var(--transition), border-color var(--transition);
}
.app-card--hoverable { cursor: pointer; }
.app-card--hoverable:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); border-color: var(--color-border-strong); }
.app-card--flat { box-shadow: none; }

/* Acento superior por color semántico */
.app-card--accent-primary { border-top: 3px solid var(--color-primary); }
.app-card--accent-success { border-top: 3px solid var(--color-success); }
.app-card--accent-warning { border-top: 3px solid var(--color-warning); }
.app-card--accent-danger  { border-top: 3px solid var(--color-danger); }

.app-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
  gap: var(--spacing-sm);
}
.app-card__title    { font-size: 14px; font-weight: 600; color: var(--color-text); margin: 0; }
.app-card__subtitle { font-size: 12px; color: var(--color-text-muted); margin: 3px 0 0; }
.app-card__header-left  { flex: 1; }
.app-card__header-right { display: flex; align-items: center; gap: var(--spacing-sm); }

.app-card__body--padded { padding: var(--spacing-lg); }

.app-card__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: 1px solid var(--color-border);
  background: var(--color-bg);
}
</style>
