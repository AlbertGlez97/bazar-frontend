<template>
  <!-- Molécula: aviso flotante del escáner ("Agregado ✓ · Vaso azul"). Sin botones,
       sin sonido. Va teleportado a <body> con un z-index mayor al del modal del
       escáner y al del toast global, para verse POR ENCIMA de la cámara; se ancla
       arriba y centrado para no tapar el centro de la imagen.
       La región viva existe siempre (aunque no haya aviso): un lector de pantalla
       solo anuncia el texto que cambia dentro de una región que ya estaba. -->
  <Teleport to="body">
    <div
      class="scan-toast-region"
      aria-live="polite"
      aria-atomic="true"
    >
      <Transition name="scan-toast">
        <div
          v-if="notice"
          class="scan-toast"
          :class="`scan-toast--${notice.kind}`"
        >
          <span
            class="scan-toast__icon"
            aria-hidden="true"
          >{{ notice.kind === 'success' ? '✓' : '!' }}</span>
          <span class="scan-toast__text">
            <span class="scan-toast__title">{{ notice.title }}</span>
            <span
              v-if="notice.detail"
              class="scan-toast__detail"
            >{{ notice.detail }}</span>
          </span>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  /** Lo que se muestra ahora; `null` o sin valor = nada. */
  notice?: { kind: 'success' | 'error'; title: string; detail?: string } | null
}>()
</script>

<style scoped>
.scan-toast-region {
  position: fixed;
  top: calc(var(--spacing-md) + env(safe-area-inset-top, 0px));
  left: 50%;
  z-index: 2100;
  width: max-content;
  max-width: calc(100vw - 2rem);
  transform: translateX(-50%);
  pointer-events: none;
}

.scan-toast {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 2px solid transparent;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-pop);
}
.scan-toast--success { color: var(--color-on-primary); background: var(--color-success); border-color: var(--color-success); }
.scan-toast--error { color: var(--color-on-primary); background: var(--color-danger); border-color: var(--color-danger); }

.scan-toast__icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  font-weight: 800;
  background: color-mix(in srgb, var(--color-on-primary) 25%, transparent);
  border-radius: var(--radius-full);
}
.scan-toast__text { display: flex; flex-direction: column; min-width: 0; }
.scan-toast__title { font-size: var(--font-size-md); font-weight: 800; line-height: 1.2; }
.scan-toast__detail { font-size: var(--font-size-sm); font-weight: 600; line-height: 1.2; overflow-wrap: anywhere; }

.scan-toast-enter-active,
.scan-toast-leave-active { transition: opacity var(--motion-base) var(--motion-ease), transform var(--motion-base) var(--motion-ease); }
.scan-toast-enter-from,
.scan-toast-leave-to { opacity: 0; transform: translateY(calc(var(--motion-shift) * -1)); }

@media (prefers-reduced-motion: reduce) {
  .scan-toast-enter-active,
  .scan-toast-leave-active { transition: opacity 0.01ms; }
  .scan-toast-enter-from,
  .scan-toast-leave-to { transform: none; }
}
</style>
