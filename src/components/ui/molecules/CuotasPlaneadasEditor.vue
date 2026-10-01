<template>
  <!-- Molécula: filas repetibles de cuotas planeadas (D2). Cada fila es UN
       @vuepic/vue-datepicker en modo de fecha única + un monto editable, lado
       a lado; "+ Agregar fecha de pago" agrega filas y cada fila (salvo la
       última que quede) tiene su botón "Quitar" (mismo estilo que el del
       carrito, CartLineItem). El monto de una fila nueva se pre-llena con un
       reparto parejo del total entre las filas actuales (splitEvenMinor) —
       SOLO una sugerencia inicial: el backend no exige que las cuotas sumen
       el saldo, así que aquí tampoco se valida eso, y lo que la persona edita
       a mano nunca se vuelve a pisar. -->
  <div class="cuotas-planeadas-editor">
    <ul
      v-if="rows.length"
      class="cuotas-planeadas-editor__rows"
    >
      <li
        v-for="row in rows"
        :key="row.key"
        class="cuotas-planeadas-editor__row"
      >
        <div class="cuotas-planeadas-editor__picker">
          <VueDatePicker
            :model-value="row.date"
            :time-config="{ enableTimePicker: false }"
            :min-date="minDate"
            :disabled="disabled"
            auto-apply
            :clearable="true"
            :placeholder="VOICE.deuda.cuotasDatesLabel"
            :formats="{ input: 'dd/MM/yyyy', preview: 'dd/MM/yyyy' }"
            @update:model-value="(date: Date | null) => onDateChange(row.key, date)"
          />
        </div>

        <AppInput
          :model-value="row.text"
          :label="row.date ? VOICE.deuda.cuotasRowLabel(formatRowDate(row.date)) : VOICE.deuda.cuotasRowLabelPending"
          type="text"
          inputmode="decimal"
          placeholder="0.00"
          :disabled="disabled"
          @update:model-value="onAmountInput(row.key, $event)"
        />

        <button
          v-if="rows.length > 1"
          type="button"
          class="cuotas-planeadas-editor__remove"
          data-action="remove-cuota"
          :aria-label="VOICE.deuda.cuotasRemoveRowLabel(row.date ? formatRowDate(row.date) : null)"
          :disabled="disabled"
          @click="removeRow(row.key)"
        >
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
          <span>Quitar</span>
        </button>
      </li>
    </ul>

    <AppButton
      type="button"
      variant="secondary"
      size="sm"
      data-action="add-cuota"
      :disabled="disabled"
      @click="addRow"
    >
      {{ VOICE.deuda.cuotasAddRowLabel }}
    </AppButton>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import { VOICE } from '@/config/voice'
import { minorToDisplay, parseMoneyText, splitEvenMinor } from '@/utils/money'
import AppButton from '../atoms/AppButton.vue'
import AppInput from '../molecules/AppInput.vue'

export interface CuotaDraft {
  fechaEsperada: string
  montoEsperadoMinor: number
}

interface Row {
  key: string
  date: Date | null
  text: string
  edited: boolean
}

const props = withDefaults(defineProps<{
  /** Monto a repartir entre las filas (D2: totalMinor - abonoInicialMinor). */
  totalMinor: number
  disabled?: boolean
}>(), { disabled: false })

const emit = defineEmits<{ 'update:cuotas': [rows: CuotaDraft[]] }>()

const minDate = new Date()
const rows = ref<Row[]>([])
let nextRowId = 0

/** The picker uses local wall-clock fields; the API receives a calendar day. */
function toCalendarDate(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatRowDate(date: Date): string {
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Solo las filas con fecha elegida cuentan como cuota real: una fila recién
// agregada, todavía sin fecha, no se manda hasta que la persona elige un día.
function emitRows() {
  emit('update:cuotas', rows.value
    .filter((row): row is Row & { date: Date } => row.date !== null)
    .map((row) => ({
      fechaEsperada: toCalendarDate(row.date),
      montoEsperadoMinor: parseMoneyText(row.text) ?? 0,
    })))
}

// Re-sugiere el reparto parejo del total entre TODAS las filas actuales,
// pero solo lo aplica a las que la persona no tocó a mano — igual que el
// diseño anterior, extendido para disparar también al agregar/quitar filas.
function resuggest() {
  if (!rows.value.length) { emitRows(); return }
  const suggested = splitEvenMinor(props.totalMinor, rows.value.length)
  rows.value = rows.value.map((row, index) => (row.edited ? row : { ...row, text: minorToDisplay(suggested[index]) }))
  emitRows()
}

function addRow() {
  rows.value = [...rows.value, { key: `row-${nextRowId++}`, date: null, text: '0.00', edited: false }]
  resuggest()
}

function removeRow(key: string) {
  if (rows.value.length <= 1) return
  rows.value = rows.value.filter((row) => row.key !== key)
  resuggest()
}

function onDateChange(key: string, date: Date | null) {
  const row = rows.value.find((r) => r.key === key)
  if (!row) return
  row.date = date
  emitRows()
}

function onAmountInput(key: string, text: string) {
  const row = rows.value.find((r) => r.key === key)
  if (!row) return
  row.text = text
  row.edited = true
  emitRows()
}

// El abono inicial (o el total) puede cambiar DESPUÉS de agregar filas: las
// filas que la persona no tocó siguen la nueva sugerencia; las editadas no.
watch(() => props.totalMinor, () => {
  resuggest()
})
</script>

<style scoped>
.cuotas-planeadas-editor { display: flex; flex-direction: column; gap: var(--spacing-sm); }
.cuotas-planeadas-editor__rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
.cuotas-planeadas-editor__row {
  display: flex;
  align-items: flex-end;
  gap: var(--spacing-sm);
}
.cuotas-planeadas-editor__picker { flex: 1 1 auto; min-width: 0; }

/* Quitar: copiado tal cual de CartLineItem.vue (.cart-line__remove) — mismo
   tamaño, color e ícono, para que la acción de descartar se vea igual en
   toda la app. */
.cuotas-planeadas-editor__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  min-width: 2.75rem;
  min-height: 2.75rem;
  padding: 0 var(--spacing-md);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-danger);
  background: var(--color-danger-soft);
  border: 1px solid color-mix(in srgb, var(--color-danger) 35%, transparent);
  border-radius: var(--radius-md);
  cursor: pointer;
  touch-action: manipulation;
}
.cuotas-planeadas-editor__remove:hover:not(:disabled) { background: color-mix(in srgb, var(--color-danger) 18%, var(--color-surface)); }
.cuotas-planeadas-editor__remove:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }
.cuotas-planeadas-editor__remove:disabled { opacity: 0.5; cursor: not-allowed; }

/* Datepicker: sin theming oscuro/claro (no existe en este proyecto) — solo se
   conectan sus variables a los tokens de color ya fijos de la marca. */
.cuotas-planeadas-editor :deep(.dp__theme_light),
.cuotas-planeadas-editor :deep(.dp__main) {
  --dp-primary-color: var(--color-primary);
  --dp-primary-text-color: var(--color-on-primary);
  --dp-hover-color: var(--color-primary-soft);
  --dp-hover-text-color: var(--color-text);
  --dp-hover-icon-color: var(--color-text);
  --dp-text-color: var(--color-text);
  --dp-secondary-color: var(--color-text-muted);
  --dp-background-color: var(--color-surface);
  --dp-border-color: var(--color-border-strong);
  --dp-border-color-hover: var(--color-primary);
  --dp-border-color-focus: var(--color-primary);
  --dp-menu-border-color: var(--color-border-strong);
  --dp-icon-color: var(--color-text-muted);
  --dp-disabled-color: var(--color-surface-alt);
  --dp-disabled-color-text: var(--color-text-muted);
  --dp-success-color: var(--color-primary);
  --dp-success-color-disabled: var(--color-primary-soft);
}
</style>
