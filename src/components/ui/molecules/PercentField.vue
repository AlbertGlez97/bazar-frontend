<template>
  <!-- Molécula: porcentaje de 0 a 100 que se escribe a mano. Presentacional: emite el número
       solo cuando el texto se entiende; un texto raro se marca, no se corrige a escondidas. -->
  <div class="percent-field">
    <label
      class="percent-field__label"
      :for="inputId"
    >{{ label }}</label>
    <div class="percent-field__row">
      <input
        :id="inputId"
        class="percent-field__control"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        :value="text"
        :disabled="disabled"
        :aria-invalid="invalid ? 'true' : undefined"
        :aria-describedby="invalid ? errorId : undefined"
        @input="onInput"
        @blur="onBlur"
      >
      <span
        class="percent-field__suffix"
        aria-hidden="true"
      >%</span>
    </div>
    <p
      v-if="invalid"
      :id="errorId"
      class="percent-field__error"
      role="alert"
    >
      Escribe un número de 0 a 100. Puedes usar hasta dos decimales.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { parsePctText } from '@/utils/finance-rules'

const props = withDefaults(defineProps<{
  modelValue: number
  label: string
  disabled?: boolean
  id?: string
}>(), { disabled: false, id: undefined })

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const generated = useId()
const inputId = computed(() => props.id ?? generated)
const errorId = computed(() => `${inputId.value}-error`)
const text = ref(String(props.modelValue))
const invalid = computed(() => parsePctText(text.value) === null)

// Si el padre ajusta el valor (otro campo lo reajusta), el texto lo sigue.
watch(() => props.modelValue, (value) => {
  if (parsePctText(text.value) !== value) text.value = String(value)
})

function onInput(event: Event) {
  text.value = (event.target as HTMLInputElement).value
  const parsed = parsePctText(text.value)
  if (parsed !== null) emit('update:modelValue', parsed)
}
function onBlur() {
  if (invalid.value) text.value = String(props.modelValue)
}
</script>

<style scoped>
.percent-field { display: grid; gap: var(--spacing-xs); min-width: 0; }
.percent-field__label { font-size: var(--font-size-sm); font-weight: 600; color: var(--color-text); }
.percent-field__row { display: flex; align-items: center; gap: var(--spacing-xs); }
.percent-field__control {
  width: 100%; min-width: 0; min-height: 44px; padding: 0 var(--spacing-sm);
  border: 1px solid var(--color-border-strong); border-radius: var(--radius-sm);
  background: var(--color-surface); color: var(--color-text); font: inherit;
}
.percent-field__control:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 1px; }
.percent-field__control[aria-invalid='true'] { border-color: var(--color-danger); }
.percent-field__suffix { font-weight: 700; color: var(--color-text-muted); }
.percent-field__error { margin: 0; font-size: var(--font-size-sm); color: var(--color-danger); }
</style>
