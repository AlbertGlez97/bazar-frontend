<template>
  <!-- Molécula: barra del modo selección del catálogo (imprimir códigos QR).
       Solo presenta y emite; quien decide y guarda la selección es el store. -->
  <div
    class="product-selection-bar"
    role="group"
    :aria-label="VOICE.labels.select"
  >
    <AppButton
      v-if="!active"
      variant="secondary"
      @click="$emit('enter')"
    >
      {{ VOICE.labels.select }}
    </AppButton>

    <template v-else>
      <!-- aria-live: quien usa lector de pantalla oye el conteo al marcar -->
      <p
        class="product-selection-bar__count"
        aria-live="polite"
      >
        {{ VOICE.labels.selectedCount(count) }}
      </p>
      <p
        v-if="selectingAll && progress"
        class="product-selection-bar__progress"
        role="status"
      >
        {{ VOICE.labels.selectingAll(progress.loaded, progress.total) }}
      </p>

      <AppButton
        variant="secondary"
        :disabled="selectingAll"
        :title="VOICE.labels.selectAllHint"
        @click="$emit('select-all')"
      >
        {{ VOICE.labels.selectAll }}
      </AppButton>
      <AppButton
        variant="ghost"
        :disabled="count === 0 || selectingAll"
        @click="$emit('clear')"
      >
        {{ VOICE.labels.clear }}
      </AppButton>
      <!-- Solo con algo elegido: sin selección no hay nada que imprimir -->
      <AppButton
        v-if="count > 0"
        variant="primary"
        :disabled="selectingAll"
        @click="$emit('print')"
      >
        {{ VOICE.labels.print }}
      </AppButton>
      <AppButton
        variant="ghost"
        @click="$emit('exit')"
      >
        {{ VOICE.labels.exitSelection }}
      </AppButton>
    </template>
  </div>
</template>

<script setup lang="ts">
import { VOICE } from '@/config/voice'
import AppButton from '../atoms/AppButton.vue'

defineProps<{
  /** ¿Está activo el modo selección? */
  active: boolean
  count: number
  /** "Seleccionar todos" está trayendo páginas del servidor. */
  selectingAll: boolean
  progress: { loaded: number; total: number } | null
}>()

defineEmits<{
  enter: []
  exit: []
  'select-all': []
  clear: []
  print: []
}>()
</script>

<style scoped>
.product-selection-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-sm) var(--spacing-md);
}
.product-selection-bar__count {
  margin: 0;
  font-weight: 600;
  min-width: 8rem;
}
.product-selection-bar__progress {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
</style>
