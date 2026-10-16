<template>
  <!-- Molécula: campo de monto en pesos. Campo grande con teclado numérico; sin
       atajos ni selector de billetes. Emite el TEXTO ya limpio por
       `update:modelValue`; quien lo usa lo convierte a centavos (en la venta, el
       carrito: `setAmountFromDisplay`). Un monto ambiguo ("100,50") no se
       adivina: se marca y se explica cómo escribirlo. -->
  <div
    class="amount-input"
    :class="`amount-input--${size}`"
  >
    <label
      class="amount-input__label"
      :for="inputId"
    >{{ label }}</label>

    <div class="amount-input__field">
      <span
        class="amount-input__prefix"
        aria-hidden="true"
      >$</span>
      <input
        :id="inputId"
        class="amount-input__control"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        placeholder="0.00"
        :value="modelValue"
        :disabled="disabled"
        :aria-invalid="isUnclear ? 'true' : undefined"
        :aria-describedby="describedBy"
        @input="onInput"
      >
    </div>

    <p
      v-if="isUnclear"
      :id="errorId"
      class="amount-input__error"
      role="alert"
    >
      {{ VOICE.sale.cashUnclear }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, useId } from 'vue'
import { VOICE } from '@/config/voice'
import { parseCashInput, sanitizeCashText } from '@/utils/money'

const props = withDefaults(defineProps<{
  /** Texto del campo (lo que la persona escribió) */
  modelValue: string
  label: string
  disabled?: boolean
  /** `lg` para la pantalla de cobro en celular. */
  size?: 'md' | 'lg'
  /** id del <input> (si no, se genera uno). */
  id?: string
  /** Id de una ayuda externa que describe al campo. */
  descriptionId?: string
}>(), {
  disabled: false,
  size: 'md',
  id: undefined,
  descriptionId: undefined,
})

const emit = defineEmits<{
  'update:modelValue': [text: string]
}>()

const generatedId = useId()
const inputId = computed(() => props.id ?? generatedId)
const errorId = computed(() => `${inputId.value}-error`)

/** Texto capturado que no se puede leer con certeza (mismo criterio que el carrito). */
const isUnclear = computed(() => parseCashInput(props.modelValue) === null)
const describedBy = computed(() =>
  [props.descriptionId, isUnclear.value ? errorId.value : undefined].filter(Boolean).join(' ') || undefined,
)

function onInput(event: Event) {
  const input = event.target as HTMLInputElement
  const clean = sanitizeCashText(input.value)
  // Si se quitó basura, el campo debe mostrarlo aunque el valor del padre no cambie.
  if (input.value !== clean) input.value = clean
  emit('update:modelValue', clean)
  // Si el padre corrige el valor (p. ej. un tope) sin cambiar su propio estado, el campo lo sigue.
  void nextTick(() => { if (input.value !== props.modelValue) input.value = props.modelValue })
}
</script>

<style scoped>
.amount-input { display: flex; flex-direction: column; gap: var(--spacing-sm); min-width: 0; }
.amount-input__label { font-size: var(--font-size-md); font-weight: 700; color: var(--color-text); }

.amount-input__field { position: relative; display: flex; align-items: center; min-width: 0; }
.amount-input__prefix {
  position: absolute;
  left: var(--spacing-md);
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--color-text-muted);
  pointer-events: none;
}
.amount-input__control {
  width: 100%;
  min-width: 0;
  min-height: var(--control-height-cta);
  padding: 0 var(--spacing-md) 0 calc(var(--spacing-md) + 1.5rem);
  font-family: var(--font-display);
  font-size: var(--font-size-xl);
  font-weight: 800;
  color: var(--color-text);
  background: var(--color-surface);
  border: 2px solid var(--color-border-strong);
  border-radius: var(--radius-md);
}
.amount-input__control::placeholder { color: var(--color-text-subtle); opacity: 1; font-weight: 600; }
.amount-input__control:focus {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 2px;
  border-color: var(--color-primary);
}
.amount-input__control:disabled { opacity: 0.5; cursor: not-allowed; }
.amount-input__control[aria-invalid='true'] { border-color: var(--color-danger); }
.amount-input__error { margin: 0; font-size: var(--font-size-sm); font-weight: 600; color: var(--color-danger); }

/* Pantalla de cobro en celular: el campo más grande de la pantalla, 64 px */
.amount-input--lg .amount-input__control { min-height: 4rem; font-size: 2rem; }
.amount-input--lg .amount-input__prefix { font-size: 1.5rem; }
</style>
