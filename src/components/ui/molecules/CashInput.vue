<template>
  <!-- Molécula: efectivo recibido. Campo grande con teclado numérico y atajos
       ("Justo" y billetes comunes). Emite el TEXTO ya limpio por
       `update:modelValue`; el store lo convierte a centavos
       (`setCashFromDisplay`). Los atajos emiten por ese mismo camino. -->
  <div class="cash-input">
    <label
      class="cash-input__label"
      :for="inputId"
    >Efectivo recibido</label>

    <div class="cash-input__field">
      <span
        class="cash-input__prefix"
        aria-hidden="true"
      >$</span>
      <input
        :id="inputId"
        class="cash-input__control"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        placeholder="0.00"
        :value="modelValue"
        :disabled="disabled"
        @input="onInput"
      >
    </div>

    <div class="cash-input__chips">
      <button
        v-if="totalMinor > 0"
        type="button"
        class="cash-input__chip cash-input__chip--exact"
        :aria-label="`Justo: recibí $${minorToDisplay(totalMinor)}`"
        :disabled="disabled"
        @click="emit('update:modelValue', exactText)"
      >
        Justo
      </button>
      <button
        v-for="bill in BILLS"
        :key="bill"
        type="button"
        class="cash-input__chip"
        :aria-label="`Recibí $${bill}`"
        :disabled="disabled"
        @click="emit('update:modelValue', String(bill))"
      >
        ${{ bill }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { minorToDisplay, sanitizeCashText } from '@/utils/money'

const props = withDefaults(defineProps<{
  /** Texto del campo (lo que la persona escribió) */
  modelValue: string
  /** Total actual en centavos, para el atajo "Justo" */
  totalMinor?: number
  disabled?: boolean
}>(), {
  totalMinor: 0,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [text: string]
}>()

/** Billetes de uso diario en México; pocos a propósito. */
const BILLS = [20, 50, 100, 200, 500] as const

const inputId = useId()

/** "150" si el total es entero, "125.50" si tiene centavos. */
const exactText = computed(() => {
  const text = minorToDisplay(props.totalMinor)
  return text.endsWith('.00') ? text.slice(0, -3) : text
})

function onInput(event: Event) {
  const input = event.target as HTMLInputElement
  const clean = sanitizeCashText(input.value)
  // Si se quitó basura, el campo debe mostrarlo aunque el valor del padre no cambie.
  if (input.value !== clean) input.value = clean
  emit('update:modelValue', clean)
}
</script>

<style scoped>
.cash-input { display: flex; flex-direction: column; gap: var(--spacing-sm); }

.cash-input__label { font-size: var(--font-size-md); font-weight: 700; color: var(--color-text); }

.cash-input__field { position: relative; display: flex; align-items: center; }
.cash-input__prefix {
  position: absolute;
  left: var(--spacing-md);
  font-family: var(--font-display);
  font-size: var(--font-size-xl);
  font-weight: 800;
  color: var(--color-text-muted);
  pointer-events: none;
}
.cash-input__control {
  width: 100%;
  min-height: 3.5rem;
  padding: 0 var(--spacing-md) 0 2.5rem;
  font-family: var(--font-display);
  font-size: var(--font-size-2xl);
  font-weight: 800;
  color: var(--color-text);
  background: var(--color-surface);
  border: 2px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  outline: none;
  transition: border-color var(--transition), box-shadow var(--transition);
}
.cash-input__control::placeholder { color: var(--color-text-subtle); opacity: 1; font-weight: 600; }
.cash-input__control:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 22%, transparent);
}
.cash-input__control:disabled { opacity: 0.5; cursor: not-allowed; }

/* Atajos: fila que envuelve, cada uno de al menos 44 px */
.cash-input__chips { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); }
.cash-input__chip {
  min-width: 44px;
  min-height: 44px;
  padding: 0 var(--spacing-md);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: 700;
  color: var(--color-text);
  background: var(--color-surface);
  border: 2px solid var(--color-border-strong);
  border-radius: var(--radius-full);
  cursor: pointer;
  touch-action: manipulation;
  transition: background var(--transition);
}
.cash-input__chip:hover:not(:disabled) { background: var(--color-surface-alt); }
.cash-input__chip:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }
.cash-input__chip:disabled { opacity: 0.5; cursor: not-allowed; }
.cash-input__chip--exact {
  color: var(--color-primary-hover);
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
}
</style>
