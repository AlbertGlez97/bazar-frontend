<template>
  <!-- Molécula: selector de periodo de un reporte. Atajos (Hoy, Ayer, Esta semana,
       Este mes) que consultan al instante, y dos fechas con un botón "Actualizar"
       (también Enter) para rangos a la medida. Presentacional: no lee stores ni
       calcula fechas; la vista decide qué significa cada atajo. -->
  <form
    class="report-range-picker"
    novalidate
    @submit.prevent="onSubmit"
  >
    <div
      class="report-range-picker__presets"
      role="group"
      :aria-label="VOICE.reports.periodLabel"
    >
      <button
        v-for="key in PRESET_KEYS"
        :key="key"
        type="button"
        class="report-range-picker__preset"
        :class="{ 'report-range-picker__preset--active': preset === key }"
        :aria-pressed="preset === key ? 'true' : 'false'"
        :disabled="disabled"
        @click="emit('select-preset', key)"
      >
        {{ VOICE.reports.presets[key] }}
      </button>
    </div>

    <div class="report-range-picker__dates">
      <AppInput
        type="date"
        size="lg"
        class="report-range-picker__date"
        :label="VOICE.reports.from"
        :model-value="from"
        :max="max"
        :disabled="disabled"
        @update:model-value="emit('update:from', $event)"
      />
      <AppInput
        type="date"
        size="lg"
        class="report-range-picker__date"
        :label="VOICE.reports.to"
        :model-value="to"
        :max="max"
        :disabled="disabled"
        @update:model-value="emit('update:to', $event)"
      />
      <AppButton
        type="submit"
        variant="secondary"
        size="lg"
        class="report-range-picker__apply"
        :disabled="disabled || !!error"
      >
        {{ VOICE.reports.apply }}
      </AppButton>
    </div>

    <p
      v-if="error"
      class="report-range-picker__error"
      role="alert"
    >
      {{ error }}
    </p>
  </form>
</template>

<script setup lang="ts">
import { VOICE } from '@/config/voice'
import type { RangePreset } from '@/utils/business-time'
import AppButton from '../atoms/AppButton.vue'
import AppInput from '../atoms/AppInput.vue'

const PRESET_KEYS: RangePreset[] = ['hoy', 'ayer', 'semana', 'mes']

const props = withDefaults(defineProps<{
  /** Día de negocio inicial (`YYYY-MM-DD`). */
  from: string
  /** Día de negocio final (`YYYY-MM-DD`). */
  to: string
  /** Atajo seleccionado, o `null` mientras las fechas son a la medida. */
  preset: RangePreset | null
  /** Fecha máxima que se puede elegir (hoy, en hora de negocio). */
  max?: string
  /** Por qué el rango no se puede consultar; con error no se aplica. */
  error?: string
  /** Ocupado (cargando o preparando un archivo): nada se puede tocar. */
  disabled?: boolean
}>(), {
  max: undefined,
  error: undefined,
  disabled: false,
})

const emit = defineEmits<{
  'select-preset': [preset: RangePreset]
  'update:from': [value: string]
  'update:to': [value: string]
  apply: []
}>()

function onSubmit() {
  if (props.disabled || props.error) return
  emit('apply')
}
</script>

<style scoped>
.report-range-picker {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.report-range-picker__presets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

/* Control segmentado: el activo lo dice el color Y el estado (aria-pressed). */
.report-range-picker__preset {
  min-width: 44px;
  min-height: 44px;
  padding: 0 var(--spacing-md);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: 600;
  white-space: nowrap;
  color: var(--color-text);
  background: var(--color-surface);
  border: 2px solid var(--color-border-strong);
  border-radius: var(--radius-full);
  cursor: pointer;
  touch-action: manipulation;
  transition: background var(--transition), color var(--transition), border-color var(--transition);
}
.report-range-picker__preset:hover:not(:disabled, .report-range-picker__preset--active) { background: var(--color-surface-alt); }
.report-range-picker__preset:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }
.report-range-picker__preset:disabled { opacity: .6; cursor: not-allowed; }
.report-range-picker__preset--active {
  color: var(--color-primary-hover);
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
}

.report-range-picker__dates {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--spacing-md);
}
.report-range-picker__date { flex: 0 1 12rem; min-width: 9rem; }
.report-range-picker__apply { min-height: 44px; min-width: 44px; }

.report-range-picker__error {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-danger);
}
</style>
