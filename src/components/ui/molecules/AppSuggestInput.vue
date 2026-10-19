<template>
  <!-- Molécula: campo de texto corto con sugerencias, ayuda breve y contador.
       Las sugerencias son una lista nativa (<datalist>) enlazada al campo con `list`: la
       leen los lectores de pantalla y funciona con teclado; escribir algo distinto sigue
       siendo válido (son sugerencias, no una lista cerrada). Presentacional: las
       sugerencias llegan por prop, aquí no se pide nada. -->
  <div
    ref="root"
    class="app-suggest-input"
  >
    <AppInput
      :model-value="modelValue"
      :label="label"
      :placeholder="placeholder"
      :error="error"
      :disabled="disabled"
      :maxlength="maxlength"
      :list="options.length > 0 ? listId : undefined"
      :aria-describedby="describedBy"
      autocomplete="off"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <datalist
      v-if="options.length > 0"
      :id="listId"
    >
      <option
        v-for="option in options"
        :key="option"
        :value="option"
      />
    </datalist>
    <div class="app-suggest-input__meta">
      <p
        v-if="hint"
        :id="hintId"
        class="app-suggest-input__hint"
      >
        {{ hint }}
      </p>
      <AppCharCounter
        :id="counterId"
        class="app-suggest-input__counter"
        :current="modelValue.length"
        :max="maxlength"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import AppCharCounter from '../atoms/AppCharCounter.vue'
import AppInput from './AppInput.vue'

const props = withDefaults(defineProps<{
  modelValue?: string
  label: string
  /** Lo que ya se usó; se muestran sin repetir. */
  suggestions?: string[]
  /** Máximo de caracteres: limita la escritura y alimenta el contador. */
  maxlength: number
  /** Ayuda corta, p. ej. "Ej. XL, 24 oz". */
  hint?: string
  placeholder?: string
  error?: string
  disabled?: boolean
}>(), {
  modelValue: '',
  suggestions: () => [],
  hint: undefined,
  placeholder: undefined,
  error: undefined,
  disabled: false,
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const uid = useId()
const listId = `${uid}-list`
const hintId = `${uid}-hint`
const counterId = `${uid}-count`

const root = ref<HTMLElement | null>(null)
/** Lleva el cursor al campo (p. ej. al abrir "Crear otro igual", donde falta la presentación). */
defineExpose({ focus: () => root.value?.querySelector('input')?.focus() })

const options = computed(() => [...new Set(props.suggestions)])
const describedBy = computed(() => [props.hint ? hintId : '', counterId].filter(Boolean).join(' '))
</script>

<style scoped>
.app-suggest-input { display: flex; flex-direction: column; gap: 4px; }
.app-suggest-input__meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--spacing-sm);
}
.app-suggest-input__hint {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
.app-suggest-input__counter { margin-left: auto; }
</style>
