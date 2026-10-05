<template>
  <aside
    v-if="update.available"
    class="pwa-update"
    aria-label="Actualización de la aplicación"
  >
    <p role="status">
      {{ update.updating ? 'Actualizando la aplicación…' : 'Hay una versión nueva disponible.' }}
    </p>
    <p
      v-if="update.error"
      role="alert"
    >
      {{ update.error }}
    </p>
    <AppButton
      :disabled="update.updating"
      @click="update.update()"
    >
      Actualizar ahora
    </AppButton>
  </aside>
</template>

<script setup lang="ts">
import AppButton from '@/components/ui/atoms/AppButton.vue'
import { usePwaUpdateStore } from '@/stores/pwaUpdate.store'
const update = usePwaUpdateStore()
</script>

<style scoped>
.pwa-update {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  z-index: 2000;
  width: min(21rem, calc(100vw - 2rem));
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
  display: grid;
  gap: 0.75rem;
}
</style>
