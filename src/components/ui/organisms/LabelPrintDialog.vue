<template>
  <!-- Organismo: diálogo para imprimir la hoja de etiquetas QR. Muestra cuántas hojas
       saldrán, los ajustes de la impresora (se guardan solos) y la ayuda; NO genera nada:
       emite "preview" y "download" y el contenedor hace el trabajo. -->
  <AppModal
    :model-value="modelValue"
    :title="VOICE.labels.dialogTitle"
    size="lg"
    hide-footer
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="label-print-dialog">
      <p
        class="label-print-dialog__summary"
        aria-live="polite"
      >
        {{ VOICE.labels.summary(labelCount, sheets) }}
      </p>

      <section class="label-print-dialog__design">
        <h3>{{ VOICE.labels.designTitle }}</h3>
        <SegmentedControl
          :model-value="design"
          :options="DESIGN_OPTIONS"
          :label="VOICE.labels.designTitle"
          @update:model-value="$emit('update:design', $event as LabelDesign)"
        />
        <p class="label-print-dialog__hint">
          {{ VOICE.labels.designHint }}
        </p>
      </section>

      <fieldset class="label-print-dialog__calibration">
        <legend>{{ VOICE.labels.calibrationTitle }}</legend>
        <p class="label-print-dialog__hint">
          {{ VOICE.labels.calibrationHint }}
        </p>
        <div class="label-print-dialog__fields">
          <AppInput
            v-for="field in FIELDS"
            :key="field.key"
            :label="field.label"
            type="number"
            inputmode="decimal"
            :step="field.step"
            :min="field.min"
            :max="field.max"
            :model-value="draft[field.key]"
            :error="errors[field.key]"
            @update:model-value="onInput(field.key, $event)"
          />
        </div>
        <AppButton
          variant="ghost"
          size="sm"
          @click="$emit('reset')"
        >
          {{ VOICE.labels.reset }}
        </AppButton>
        <AppAlert
          v-if="overflowBottom > 0"
          type="warning"
          :show="true"
        >
          {{ VOICE.labels.overflowBottom(overflowBottom) }}
        </AppAlert>
        <AppAlert
          v-if="overflowRight > 0"
          type="warning"
          :show="true"
        >
          {{ VOICE.labels.overflowRight(overflowRight) }}
        </AppAlert>
      </fieldset>

      <section class="label-print-dialog__help">
        <h3>{{ VOICE.labels.helpTitle }}</h3>
        <p>{{ VOICE.labels.helpSheet }}</p>
        <p>{{ VOICE.labels.helpScale }}</p>
        <p>{{ VOICE.labels.helpCalibrate }}</p>
      </section>

      <AppAlert
        v-if="error"
        type="error"
        :show="true"
      >
        {{ error }}
      </AppAlert>
      <p
        v-if="busy"
        class="label-print-dialog__hint"
        role="status"
      >
        {{ VOICE.labels.working }}
      </p>

      <div class="label-print-dialog__actions">
        <AppButton
          variant="secondary"
          :loading="busy === 'preview'"
          :disabled="busy !== null || hasErrors"
          @click="$emit('preview')"
        >
          {{ VOICE.labels.preview }}
        </AppButton>
        <AppButton
          variant="primary"
          :loading="busy === 'download'"
          :disabled="busy !== null || hasErrors"
          @click="$emit('download')"
        >
          {{ VOICE.labels.download }}
        </AppButton>
      </div>
    </div>
  </AppModal>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { VOICE } from '@/config/voice'
import {
  CALIBRATION_KEYS,
  CALIBRATION_LIMITS,
  gridBottomOverflowMm,
  gridRightOverflowMm,
  sheetCount,
  type LabelCalibration,
  type LabelDesign,
} from '@/utils/label-sheet-plan'
import AppAlert from '../molecules/AppAlert.vue'
import AppButton from '../atoms/AppButton.vue'
import AppInput from '../molecules/AppInput.vue'
import SegmentedControl, { type SegmentedOption } from '../molecules/SegmentedControl.vue'
import AppModal from './AppModal.vue'

const props = defineProps<{
  modelValue: boolean
  /** Etiquetas que se van a imprimir (productos seleccionados). */
  labelCount: number
  calibration: LabelCalibration
  /** Diseño elegido para todo el lote. */
  design: LabelDesign
  /** Qué se está generando ahora (deshabilita los botones). */
  busy: 'preview' | 'download' | null
  error: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  /** Cambio VÁLIDO de un ajuste (solo el campo que cambió). */
  'update:calibration': [partial: Partial<LabelCalibration>]
  /** Otro diseño de etiqueta para todo el lote. */
  'update:design': [value: LabelDesign]
  reset: []
  preview: []
  download: []
}>()

type Key = keyof LabelCalibration

const DESIGN_OPTIONS: SegmentedOption[] = [
  { value: 'qr-only', label: VOICE.labels.designOnlyQr },
  { value: 'qr-detail', label: VOICE.labels.designQrDetail },
]
const FIELD_LABELS: Record<Key, string> = {
  marginTopMm: VOICE.labels.marginTop,
  marginLeftMm: VOICE.labels.marginLeft,
  labelWidthMm: VOICE.labels.labelWidth,
  labelHeightMm: VOICE.labels.labelHeight,
  gapXMm: VOICE.labels.gapX,
  pitchYMm: VOICE.labels.pitchY,
}
const FIELDS = CALIBRATION_KEYS.map((key) => ({ key, label: FIELD_LABELS[key], ...CALIBRATION_LIMITS[key] }))

const sheets = computed(() => sheetCount(Math.max(0, Math.floor(props.labelCount))))
const overflowBottom = computed(() => gridBottomOverflowMm(props.calibration))
const overflowRight = computed(() => gridRightOverflowMm(props.calibration))

// El texto que se escribe puede estar a medias ("-", "1."): se guarda aparte y solo se
// emite un número cuando es válido y está en rango.
const draft = reactive<Record<Key, string>>(
  Object.fromEntries(CALIBRATION_KEYS.map((key) => [key, String(props.calibration[key])])) as Record<Key, string>,
)
const errors = reactive<Record<Key, string>>(
  Object.fromEntries(CALIBRATION_KEYS.map((key) => [key, ''])) as Record<Key, string>,
)
const hasErrors = computed(() => Object.values(errors).some(Boolean))

// Un cambio de fuera (Restablecer, otra pestaña) actualiza el campo, salvo que ya muestre ese valor.
watch(
  () => props.calibration,
  (next) => {
    for (const { key } of FIELDS) {
      if (Number(draft[key]) !== next[key] || draft[key].trim() === '') {
        draft[key] = String(next[key])
      }
      errors[key] = ''
    }
  },
  { deep: true },
)

function onInput(key: Key, text: string | number) {
  const raw = String(text)
  draft[key] = raw
  const field = FIELDS.find((f) => f.key === key)!
  const value = raw.trim() === '' ? Number.NaN : Number(raw)
  if (!Number.isFinite(value) || value < field.min || value > field.max) {
    errors[key] = VOICE.labels.rangeError(field.min, field.max)
    return
  }
  errors[key] = ''
  emit('update:calibration', { [key]: value })
}
</script>

<style scoped>
.label-print-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.label-print-dialog__summary {
  margin: 0;
  font-weight: 600;
}
.label-print-dialog__calibration {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-sm);
  margin: 0;
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.label-print-dialog__fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: var(--spacing-md);
  width: 100%;
}
.label-print-dialog__hint {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
.label-print-dialog__design { display: flex; flex-direction: column; gap: var(--spacing-sm); }
.label-print-dialog__design h3,
.label-print-dialog__help h3 {
  margin: 0 0 var(--spacing-xs);
  font-size: var(--font-size-md);
}
.label-print-dialog__help p {
  margin: 0 0 var(--spacing-xs);
  font-size: var(--font-size-sm);
}
.label-print-dialog__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}
</style>
