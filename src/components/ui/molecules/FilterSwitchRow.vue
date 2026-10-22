<template>
  <!-- Molécula: fila de filtro — etiqueta a la izquierda, interruptor a la derecha.
       La etiqueta es un <label for>: tocar el texto también cambia el interruptor. -->
  <div
    class="filter-switch-row"
    :class="{ 'filter-switch-row--disabled': disabled }"
  >
    <div class="filter-switch-row__text">
      <label
        class="filter-switch-row__label"
        :for="switchId"
      >{{ label }}</label>
      <AppHint v-if="hint">
        {{ hint }}
      </AppHint>
    </div>
    <AppSwitch
      :id="switchId"
      :model-value="modelValue"
      :disabled="disabled"
      @update:model-value="$emit('update:modelValue', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import AppHint from '../atoms/AppHint.vue'
import AppSwitch from '../atoms/AppSwitch.vue'

withDefaults(defineProps<{
  label: string
  /** Línea de ayuda opcional bajo la etiqueta. */
  hint?: string
  modelValue?: boolean
  disabled?: boolean
}>(), { hint: '', modelValue: false, disabled: false })

defineEmits<{ 'update:modelValue': [value: boolean] }>()

const switchId = useId()
</script>

<style scoped>
.filter-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  min-height: 2.75rem;
}
.filter-switch-row__text { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.filter-switch-row__label {
  font-size: var(--font-size-md);
  color: var(--color-text);
  cursor: pointer;
}
.filter-switch-row--disabled .filter-switch-row__label {
  color: var(--color-text-muted);
  cursor: not-allowed;
}
</style>
