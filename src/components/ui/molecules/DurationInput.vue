<template>
  <!-- Molécula: duración como dos enteros (Horas y Minutos). Vacío en ambos =
       "no sé cuánto duró" (se guarda sin duración, nunca como 0). Presentacional:
       no valida ni convierte; eso lo hace utils/work-shift-duration.ts. -->
  <fieldset
    class="duration-input"
    :disabled="disabled"
  >
    <legend class="duration-input__legend">
      {{ legend }}
    </legend>
    <div class="duration-input__row">
      <AppInput
        :id="`${idPrefix}-hours`"
        :model-value="hours"
        label="Horas"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        placeholder="0"
        :aria-describedby="`${idPrefix}-hint`"
        :disabled="disabled"
        @update:model-value="emit('update:hours', String($event))"
      />
      <AppInput
        :id="`${idPrefix}-minutes`"
        :model-value="minutes"
        label="Minutos"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        placeholder="0"
        :aria-describedby="`${idPrefix}-hint`"
        :disabled="disabled"
        @update:model-value="emit('update:minutes', String($event))"
      />
    </div>
    <p
      :id="`${idPrefix}-hint`"
      class="duration-input__hint"
    >
      Déjalos vacíos si no sabes cuánto duró.
    </p>
  </fieldset>
</template>

<script setup lang="ts">
import AppInput from './AppInput.vue'

withDefaults(
  defineProps<{
    hours: string
    minutes: string
    /** Prefijo de los ids de los dos campos. */
    idPrefix?: string
    legend?: string
    disabled?: boolean
  }>(),
  { idPrefix: 'duration', legend: 'Duración (opcional)', disabled: false },
)

const emit = defineEmits<{
  'update:hours': [value: string]
  'update:minutes': [value: string]
}>()
</script>

<style scoped>
.duration-input {
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}
.duration-input__legend {
  padding: 0;
  margin-bottom: var(--spacing-xs, 4px);
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-text-muted);
}
.duration-input__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-md);
}
.duration-input__row > * {
  min-width: 0;
}
.duration-input__hint {
  margin: var(--spacing-xs, 4px) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
</style>
