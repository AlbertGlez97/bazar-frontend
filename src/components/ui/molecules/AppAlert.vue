<template>
  <!-- Molécula: alerta inline — info, éxito, advertencia o error -->
  <Transition name="alert">
    <div
      v-if="show"
      class="app-alert"
      :class="`app-alert--${type}`"
      role="alert"
    >
      <!-- Ícono semántico según tipo -->
      <span
        class="app-alert__icon"
        aria-hidden="true"
      >
        <svg
          v-if="type === 'error'"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        ><circle
          cx="12"
          cy="12"
          r="10"
        /><line
          x1="12"
          y1="8"
          x2="12"
          y2="12"
        /><line
          x1="12"
          y1="16"
          x2="12.01"
          y2="16"
        /></svg>
        <svg
          v-else-if="type === 'warning'"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        ><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line
          x1="12"
          y1="9"
          x2="12"
          y2="13"
        /><line
          x1="12"
          y1="17"
          x2="12.01"
          y2="17"
        /></svg>
        <svg
          v-else-if="type === 'success'"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        ><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
        <svg
          v-else
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        ><circle
          cx="12"
          cy="12"
          r="10"
        /><line
          x1="12"
          y1="16"
          x2="12"
          y2="12"
        /><line
          x1="12"
          y1="8"
          x2="12.01"
          y2="8"
        /></svg>
      </span>

      <div class="app-alert__content">
        <p
          v-if="title"
          class="app-alert__title"
        >
          {{ title }}
        </p>
        <p class="app-alert__body">
          <slot />
        </p>
      </div>

      <!-- Botón de cerrar si es dismissible -->
      <button
        v-if="dismissible"
        class="app-alert__close"
        type="button"
        aria-label="Cerrar"
        @click="$emit('dismiss')"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <line
            x1="18"
            y1="6"
            x2="6"
            y2="18"
          /><line
            x1="6"
            y1="6"
            x2="18"
            y2="18"
          />
        </svg>
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  type?:        'info' | 'success' | 'warning' | 'error'
  show?:        boolean
  title?:       string
  dismissible?: boolean
}>(), {
  type:        'info',
  show:        true,
  title:       undefined,
  dismissible: false,
})

defineEmits<{ dismiss: [] }>()
</script>

<style scoped>
.app-alert {
  display:       flex;
  align-items:   flex-start;
  gap:           10px;
  padding:       10px 14px;
  border-radius: var(--radius-sm);
  border:        1px solid transparent;
  font-size:     0.85rem;
  line-height:   1.5;
}

/* Colores por tipo */
.app-alert--info {
  background:   var(--color-info-soft);
  border-color: color-mix(in srgb, var(--color-info) 30%, transparent);
  color:        var(--color-info);
}
.app-alert--success {
  background:   var(--color-success-soft);
  border-color: color-mix(in srgb, var(--color-success) 30%, transparent);
  color:        var(--color-success);
}
.app-alert--warning {
  background:   var(--color-warning-soft);
  border-color: color-mix(in srgb, var(--color-warning) 30%, transparent);
  color:        var(--color-warning);
}
.app-alert--error {
  background:   var(--color-danger-soft);
  border-color: color-mix(in srgb, var(--color-danger) 30%, transparent);
  color:        var(--color-danger);
}

.app-alert__icon { flex-shrink: 0; margin-top: 1px; }

.app-alert__content { flex: 1; }
.app-alert__title {
  font-weight: 600;
  margin:      0 0 2px;
  font-size:   0.88rem;
}
.app-alert__body { margin: 0; }

.app-alert__close {
  background:    none;
  border:        none;
  cursor:        pointer;
  color:         inherit;
  opacity:       .7;
  padding:       2px;
  display:       flex;
  flex-shrink:   0;
  border-radius: 4px;
  transition:    opacity var(--transition);
}
.app-alert__close:hover { opacity: 1; }

/* Transición de aparición */
.alert-enter-active, .alert-leave-active { transition: opacity .2s ease, transform .2s ease; }
.alert-enter-from, .alert-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
