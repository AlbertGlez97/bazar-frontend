<template>
  <!-- Molécula: calendario de cuotas planeadas (D2). Selección múltiple de
       fechas (@vuepic/vue-datepicker) + una fila de monto editable por
       fecha, pre-llenada con un reparto parejo del total (splitEvenMinor).
       Es SOLO una sugerencia inicial: el backend no exige que las cuotas
       sumen el saldo, así que aquí tampoco se valida eso. -->
  <div class="cuotas-planeadas-editor">
    <div class="cuotas-planeadas-editor__picker">
      <VueDatePicker
        :model-value="selectedDates"
        multi-dates
        :enable-time-picker="false"
        :min-date="minDate"
        :disabled="disabled"
        auto-apply
        :clearable="true"
        :placeholder="VOICE.deuda.cuotasDatesLabel"
        format="dd/MM/yyyy"
        @update:model-value="onDatesChange"
      />
    </div>

    <ul
      v-if="rows.length"
      class="cuotas-planeadas-editor__rows"
    >
      <li
        v-for="row in rows"
        :key="row.key"
        class="cuotas-planeadas-editor__row"
      >
        <AppInput
          :model-value="row.text"
          :label="VOICE.deuda.cuotasRowLabel(formatRowDate(row.date))"
          type="text"
          inputmode="decimal"
          placeholder="0.00"
          :disabled="disabled"
          @update:model-value="onAmountInput(row.key, $event)"
        />
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import { VOICE } from '@/config/voice'
import { minorToDisplay, parseMoneyText, splitEvenMinor } from '@/utils/money'
import AppInput from '../atoms/AppInput.vue'

export interface CuotaDraft {
  fechaEsperada: string
  montoEsperadoMinor: number
}

interface Row {
  key: string
  date: Date
  text: string
  edited: boolean
}

const props = withDefaults(defineProps<{
  /** Monto a repartir entre las fechas seleccionadas (D2: totalMinor - abonoInicialMinor). */
  totalMinor: number
  disabled?: boolean
}>(), { disabled: false })

const emit = defineEmits<{ 'update:cuotas': [rows: CuotaDraft[]] }>()

const minDate = new Date()
const selectedDates = ref<Date[]>([])
const rows = ref<Row[]>([])

/** Clave estable por día de calendario (ignora hora): año-mes-día locales. */
function dateKeyOf(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

/** El día elegido, como medianoche UTC (mismo formato que los ejemplos del contrato). */
function toIsoDate(date: Date): string {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString()
}

function formatRowDate(date: Date): string {
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

function emitRows() {
  emit('update:cuotas', rows.value.map((row) => ({
    fechaEsperada: toIsoDate(row.date),
    montoEsperadoMinor: parseMoneyText(row.text) ?? 0,
  })))
}

function rebuildRows(dates: Date[]) {
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())
  const previous = new Map(rows.value.map((row) => [row.key, row]))
  const suggested = splitEvenMinor(props.totalMinor, sorted.length)
  rows.value = sorted.map((date, index) => {
    const key = dateKeyOf(date)
    const prior = previous.get(key)
    if (prior?.edited) return { ...prior, date }
    return { key, date, text: minorToDisplay(suggested[index]), edited: false }
  })
  emitRows()
}

function onDatesChange(dates: Date[] | null) {
  selectedDates.value = dates ?? []
  rebuildRows(selectedDates.value)
}

function onAmountInput(key: string, text: string) {
  const row = rows.value.find((r) => r.key === key)
  if (!row) return
  row.text = text
  row.edited = true
  emitRows()
}

// El abono inicial (o el total) puede cambiar DESPUÉS de elegir fechas: las
// filas que la persona no tocó siguen la nueva sugerencia; las editadas no.
watch(() => props.totalMinor, () => {
  if (!rows.value.length) return
  const suggested = splitEvenMinor(props.totalMinor, rows.value.length)
  rows.value = rows.value.map((row, index) => (row.edited ? row : { ...row, text: minorToDisplay(suggested[index]) }))
  emitRows()
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
