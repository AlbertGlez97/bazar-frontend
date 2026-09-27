<template>
  <!-- Molécula: efectivo recibido. Campo grande con teclado numérico, atajo
       "Justo" y un selector de billetes combinable (pad). Emite el TEXTO ya
       limpio por `update:modelValue`; el store lo convierte a centavos
       (`setCashFromDisplay`). "Justo" y el pad emiten por ese mismo camino. -->
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
        :aria-invalid="isUnclear ? 'true' : undefined"
        :aria-describedby="isUnclear ? errorId : undefined"
        @input="onInput"
      >
    </div>
    <!-- Monto ambiguo ("100,50"): no se adivina, se pide escribirlo bien. El
         cobro ya está bloqueado en el store (`cashInvalid`). -->
    <p
      v-if="isUnclear"
      :id="errorId"
      class="cash-input__error"
      role="alert"
    >
      {{ VOICE.sale.cashUnclear }}
    </p>

    <div
      v-if="totalMinor > 0 || hasSelection"
      class="cash-input__chips"
    >
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
        v-if="hasSelection"
        type="button"
        class="cash-input__clear"
        aria-label="Limpiar selección de billetes"
        :disabled="disabled"
        @click="onClearSelection"
      >
        <RotateCcw
          :size="18"
          aria-hidden="true"
        />
        Limpiar selección
      </button>
    </div>

    <CashDenominationPad
      :counts="denominationCounts"
      :disabled="disabled"
      @tap="onPadTap"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { RotateCcw } from '@lucide/vue'
import { VOICE } from '@/config/voice'
import { minorToDisplay, multiplyMinor, parseCashInput, sanitizeCashText, sumMinor } from '@/utils/money'
import CashDenominationPad from './CashDenominationPad.vue'

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

const inputId = useId()
const errorId = `${inputId}-error`

/** Texto capturado que no se puede leer con certeza (mismo criterio que el store). */
const isUnclear = computed(() => parseCashInput(props.modelValue) === null)

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

// ── Selector de billetes combinable (pad) ──────────────────────────────────
// Regla única de sincronización: `lastEmittedByPad` guarda el texto que EL
// PAD emitió como resultado directo de un toque. Un solo `watch` sobre
// `modelValue` limpia las cuentas cuando lo que llega no coincide con eso —
// cubre escribir, "Justo" y cualquier resincronización externa sin código
// especial para cada caso, porque solo el propio toque del pad actualiza la
// referencia justo antes de emitir.
const denominationCounts = ref<Partial<Record<number, number>>>({})
const lastEmittedByPad = ref('')

const hasSelection = computed(() => Object.values(denominationCounts.value).some((count) => (count ?? 0) > 0))

watch(() => props.modelValue, (value) => {
  if (value !== lastEmittedByPad.value) denominationCounts.value = {}
})

function totalFromCounts(counts: Partial<Record<number, number>>): number {
  return sumMinor(
    Object.entries(counts).map(([bill, count]) => multiplyMinor(Number(bill) * 100, count ?? 0)),
  )
}

function onPadTap(denomination: number) {
  const nextCounts = { ...denominationCounts.value, [denomination]: (denominationCounts.value[denomination] ?? 0) + 1 }
  denominationCounts.value = nextCounts
  const text = minorToDisplay(totalFromCounts(nextCounts))
  lastEmittedByPad.value = text
  emit('update:modelValue', text)
}

function onClearSelection() {
  denominationCounts.value = {}
  lastEmittedByPad.value = ''
  emit('update:modelValue', '')
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
.cash-input__control[aria-invalid='true'] { border-color: var(--color-danger); }
.cash-input__error { margin: 0; font-size: var(--font-size-sm); font-weight: 600; color: var(--color-danger); }

/* Atajos ("Justo", "Limpiar selección"): fila que envuelve, cada uno de al menos 44 px */
.cash-input__chips { display: flex; flex-wrap: wrap; gap: var(--spacing-xs) var(--spacing-sm); }
.cash-input__chip {
  min-width: 2.75rem;
  min-height: 2.75rem;
  padding: 0 var(--spacing-sm);
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

.cash-input__clear {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 2.75rem;
  min-height: 2.75rem;
  padding: 0 var(--spacing-sm);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: 700;
  color: var(--color-text-muted);
  background: var(--color-surface);
  border: 2px solid var(--color-border-strong);
  border-radius: var(--radius-full);
  cursor: pointer;
  touch-action: manipulation;
  transition: background var(--transition);
}
.cash-input__clear:hover:not(:disabled) { background: var(--color-surface-alt); }
.cash-input__clear:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }
.cash-input__clear:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
