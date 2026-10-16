<template>
  <!-- Molécula: una pista corta con una ✕ para cerrarla. Es una nota (no una alerta):
       no roba el foco ni se anuncia a gritos. Presentacional: emite `dismiss` y quien
       la usa decide qué recordar. -->
  <div
    class="dismissible-hint"
    role="note"
  >
    <p class="dismissible-hint__text">
      {{ text }}
    </p>
    <button
      type="button"
      class="dismissible-hint__close"
      :aria-label="closeLabel"
      @click="emit('dismiss')"
    >
      <span aria-hidden="true">✕</span>
    </button>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  text: string
  /** Nombre accesible de la ✕ */
  closeLabel?: string
}>(), { closeLabel: 'Cerrar aviso' })

const emit = defineEmits<{ dismiss: [] }>()
</script>

<style scoped>
.dismissible-hint {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-xs) var(--spacing-xs) var(--spacing-md);
  color: var(--color-info);
  background: var(--color-info-soft);
  border-radius: var(--radius-md);
}
.dismissible-hint__text { flex: 1 1 auto; min-width: 0; margin: 0; font-size: var(--font-size-sm); font-weight: 600; line-height: 1.35; }

/* La ✕ mide 32 px con mouse y 44 px con dedo (token compacto) */
.dismissible-hint__close {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  min-width: var(--control-height-compact);
  min-height: var(--control-height-compact);
  padding: 0;
  font: inherit;
  font-size: var(--font-size-md);
  color: inherit;
  background: transparent;
  border: 0;
  border-radius: var(--radius-full);
  cursor: pointer;
  touch-action: manipulation;
}
.dismissible-hint__close:hover { background: color-mix(in srgb, currentColor 12%, transparent); }
.dismissible-hint__close:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }
</style>
