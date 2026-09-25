<template>
  <!-- Molécula: contenedor de toasts — se conecta al useToastStore -->
  <Teleport to="body">
    <div
      class="app-toast-region"
      aria-live="polite"
      aria-atomic="false"
    >
      <TransitionGroup
        name="toast"
        tag="div"
        class="app-toast-list"
      >
        <div
          v-for="t in toastStore.toasts"
          :key="t.id"
          class="app-toast"
          :class="`app-toast--${t.type}`"
          role="status"
        >
          <!-- Ícono según tipo de toast -->
          <span
            class="app-toast__icon"
            aria-hidden="true"
          >
            <svg
              v-if="t.type === 'error'"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            ><circle
              cx="12"
              cy="12"
              r="10"
            /><line
              x1="15"
              y1="9"
              x2="9"
              y2="15"
            /><line
              x1="9"
              y1="9"
              x2="15"
              y2="15"
            /></svg>
            <svg
              v-else-if="t.type === 'warning'"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            ><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line
              x1="12"
              y1="9"
              x2="12"
              y2="13"
            /></svg>
            <svg
              v-else-if="t.type === 'success'"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            ><polyline points="20 6 9 17 4 12" /></svg>
            <svg
              v-else
              width="14"
              height="14"
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
            /><circle
              cx="12"
              cy="16"
              r=".5"
              fill="currentColor"
            /></svg>
          </span>

          <span class="app-toast__message">{{ t.message }}</span>

          <!-- Botón de cierre manual -->
          <button
            class="app-toast__close"
            aria-label="Cerrar"
            @click="toastStore.dismiss(t.id)"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
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
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useToastStore } from '@/stores/toast.store'

// Obtiene el store de toasts — se renderiza desde AppLayout
const toastStore = useToastStore()
</script>

<style scoped>
.app-toast-region {
  position:       fixed;
  bottom:         var(--spacing-lg, 24px);
  right:          var(--spacing-lg, 24px);
  z-index:        2000;
  pointer-events: none;
}

.app-toast-list { display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }

.app-toast {
  display:        flex;
  align-items:    center;
  gap:            10px;
  padding:        10px 14px;
  border-radius:  var(--radius-sm);
  font-size:      0.85rem;
  font-weight:    500;
  max-width:      340px;
  pointer-events: auto;
  box-shadow:     var(--shadow-md);
  border:         1px solid transparent;
}

/* Colores por tipo */
.app-toast--info    { background: var(--color-surface); border-color: var(--color-border);         color: var(--color-text); }
.app-toast--success { background: var(--color-success-soft); border-color: color-mix(in srgb, var(--color-success) 30%, transparent); color: var(--color-success); }
.app-toast--warning { background: var(--color-warning-soft); border-color: color-mix(in srgb, var(--color-warning) 30%, transparent); color: var(--color-warning); }
.app-toast--error   { background: var(--color-danger-soft);  border-color: color-mix(in srgb, var(--color-danger) 30%, transparent);  color: var(--color-danger); }

.app-toast__icon    { flex-shrink: 0; }
.app-toast__message { flex: 1; line-height: 1.4; }

.app-toast__close {
  background:    none;
  border:        none;
  cursor:        pointer;
  color:         inherit;
  opacity:       .6;
  padding:       2px;
  flex-shrink:   0;
  display:       flex;
  border-radius: 3px;
  transition:    opacity var(--transition);
}
.app-toast__close:hover { opacity: 1; }

/* Animación de entrada/salida */
.toast-enter-active { transition: all .25s ease; }
.toast-leave-active { transition: all .2s ease; }
.toast-enter-from   { opacity: 0; transform: translateX(20px); }
.toast-leave-to     { opacity: 0; transform: translateX(20px); }
.toast-move         { transition: transform .25s ease; }
</style>
