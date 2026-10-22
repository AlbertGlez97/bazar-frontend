<template>
  <!-- Molécula: ajuste de opciones excluyentes — título, control segmentado y una línea de
       ayuda que dice por qué se sugiere el valor. Presentacional: recibe y emite. -->
  <div class="choice-field">
    <span
      :id="labelId"
      class="choice-field__label"
    >{{ label }}</span>
    <SegmentedControl
      :model-value="modelValue"
      :options="options"
      :label="label"
      :disabled="disabled"
      @update:model-value="$emit('update:modelValue', $event)"
    />
    <AppHint v-if="hint">
      {{ hint }}
    </AppHint>
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import AppHint from '../atoms/AppHint.vue'
import SegmentedControl, { type SegmentedOption } from './SegmentedControl.vue'

withDefaults(defineProps<{
  label: string
  modelValue: string
  options: readonly SegmentedOption[]
  hint?: string
  disabled?: boolean
}>(), { hint: '', disabled: false })

defineEmits<{ 'update:modelValue': [value: string] }>()

const labelId = useId()
</script>

<style scoped>
.choice-field { display: flex; flex-direction: column; gap: var(--spacing-xs); min-width: 0; }
.choice-field__label { font-size: var(--font-size-md); color: var(--color-text); font-weight: 600; }
</style>
