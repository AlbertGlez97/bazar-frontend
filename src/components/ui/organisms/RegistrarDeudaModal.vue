<template>
  <!-- Organismo: formulario de fiado/apartado (D3, solo con una línea en el
       carrito). Presentacional, como IncidenciaDetailModal: no lee stores ni
       llama servicios, solo valida y emite lo que la persona confirmó. El
       contenedor (SaleView) hace las llamadas reales y decide el resultado.
       D1: abono inicial EXPLÍCITO (nunca inferido del efectivo del carrito —
       este componente ni siquiera recibe ese valor). D2: cuotas planeadas
       opcionales, colapsadas, con el calendario multi-fecha. -->
  <AppModal
    :model-value="modelValue"
    :title="VOICE.deuda.offerTitle"
    size="md"
    hide-footer
    :close-on-backdrop="!submitting"
    @update:model-value="onModalChange"
  >
    <div class="registrar-deuda-modal__body">
      <AppSelect
        v-model="type"
        :label="VOICE.deuda.typeLabel"
        :disabled="submitting"
      >
        <option value="fiado">
          {{ VOICE.deuda.typeFiado }}
        </option>
        <option value="apartado">
          {{ VOICE.deuda.typeApartado }}
        </option>
      </AppSelect>

      <AppInput
        v-model="nombre"
        :label="VOICE.deuda.nombreLabel"
        :placeholder="VOICE.deuda.nombrePlaceholder"
        :error="nombreError ?? undefined"
        :disabled="submitting"
      />

      <AppInput
        v-model="telefono"
        :label="VOICE.deuda.telefonoLabel"
        :disabled="submitting"
      />

      <AppTextarea
        v-model="notas"
        :label="VOICE.deuda.notasLabel"
        :placeholder="VOICE.deuda.notasPlaceholder"
        :rows="3"
        :disabled="submitting"
      />

      <div class="registrar-deuda-modal__abono">
        <AppInput
          v-model="abonoInicialText"
          :label="VOICE.deuda.abonoInicialLabel"
          type="text"
          inputmode="decimal"
          placeholder="0.00"
          :error="abonoInicialError ?? undefined"
          :disabled="submitting"
        />
        <p class="registrar-deuda-modal__hint">
          {{ VOICE.deuda.abonoInicialHint }}
        </p>
      </div>

      <div class="registrar-deuda-modal__cuotas">
        <AppSwitch
          v-model="cuotasEnabled"
          :disabled="submitting"
        >
          {{ VOICE.deuda.cuotasToggleLabel }}
        </AppSwitch>

        <template v-if="cuotasEnabled">
          <p class="registrar-deuda-modal__hint">
            {{ VOICE.deuda.cuotasHint }}
          </p>
          <CuotasPlaneadasEditor
            :total-minor="remainingForCuotas"
            :disabled="submitting"
            @update:cuotas="onCuotasUpdate"
          />
        </template>
      </div>

      <div class="registrar-deuda-modal__actions">
        <AppButton
          type="button"
          variant="primary"
          size="lg"
          block
          data-action="confirm-debt"
          :disabled="submitting"
          @click="submit"
        >
          {{ submitting ? VOICE.deuda.submitting : VOICE.deuda.submit }}
        </AppButton>
        <AppButton
          type="button"
          variant="secondary"
          size="lg"
          block
          :disabled="submitting"
          @click="cancel"
        >
          {{ VOICE.deuda.cancel }}
        </AppButton>
      </div>
    </div>
  </AppModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AppButton, AppInput, AppModal, AppSelect, AppSwitch, AppTextarea, CuotasPlaneadasEditor } from '@/components'
import { VOICE } from '@/config/voice'
import { parseMoneyText, subtractMinor } from '@/utils/money'
import type { DeudaType } from '@/types/deuda.types'
import type { CuotaDraft } from '@/components/ui/molecules/CuotasPlaneadasEditor.vue'

const props = defineProps<{
  modelValue: boolean
  /** Cobro/registro en curso: bloquea el formulario, como `loading` en SaleCart. */
  submitting?: boolean
  /** Total de la deuda (línea única del carrito), para sugerir el reparto de cuotas (D2). */
  totalMinor: number
}>()

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  confirm: [payload: {
    type: DeudaType
    deudor: { nombre: string; telefono?: string; notas?: string }
    /** D1: siempre explícito, nunca inferido del efectivo del carrito. */
    abonoInicialMinor: number
    /** D2: vacío cuando la sección de cuotas está apagada. */
    cuotasPlaneadas: CuotaDraft[]
  }]
}>()

const type = ref<DeudaType>('fiado')
const nombre = ref('')
const telefono = ref('')
const notas = ref('')
const nombreError = ref<string | null>(null)

const AMBIGUOUS_AMOUNT_MESSAGE =
  'No entiendo ese monto. Usa coma para miles y punto para centavos, ej. 1,000.50.'

// D1: default VISIBLE "0.00", nunca vacío — la persona debe cambiarlo a mano
// para abonar algo; jamás se hereda de otro lado.
const abonoInicialText = ref('0.00')
const abonoInicialError = ref<string | null>(null)
const abonoInicialMinor = computed(() => parseMoneyText(abonoInicialText.value) ?? 0)

// D2: colapsada por defecto; el saldo que se reparte entre las cuotas es el
// total MENOS el abono inicial ya capturado (nunca el total completo).
const cuotasEnabled = ref(false)
const cuotas = ref<CuotaDraft[]>([])
const remainingForCuotas = computed(() => Math.max(0, subtractMinor(props.totalMinor, abonoInicialMinor.value)))

function onCuotasUpdate(rows: CuotaDraft[]) {
  cuotas.value = rows
}

function reset() {
  type.value = 'fiado'
  nombre.value = ''
  telefono.value = ''
  notas.value = ''
  nombreError.value = null
  abonoInicialText.value = '0.00'
  abonoInicialError.value = null
  cuotasEnabled.value = false
  cuotas.value = []
}

// Cada vez que se abre arranca en blanco: no es un borrador que se conserva.
watch(() => props.modelValue, (open) => { if (open) reset() }, { immediate: true })

function submit() {
  if (props.submitting) return
  const trimmedNombre = nombre.value.trim()
  if (!trimmedNombre) {
    nombreError.value = VOICE.deuda.nombreRequired
    return
  }
  nombreError.value = null

  const abonoMinor = parseMoneyText(abonoInicialText.value)
  if (abonoMinor === null) {
    abonoInicialError.value = AMBIGUOUS_AMOUNT_MESSAGE
    return
  }
  abonoInicialError.value = null

  const trimmedTelefono = telefono.value.trim()
  const trimmedNotas = notas.value.trim()
  emit('confirm', {
    type: type.value,
    deudor: {
      nombre: trimmedNombre,
      ...(trimmedTelefono ? { telefono: trimmedTelefono } : {}),
      ...(trimmedNotas ? { notas: trimmedNotas } : {}),
    },
    abonoInicialMinor: abonoMinor,
    cuotasPlaneadas: cuotasEnabled.value ? cuotas.value : [],
  })
}

function cancel() {
  emit('update:modelValue', false)
}

function onModalChange(open: boolean) {
  if (!open && props.submitting) return
  emit('update:modelValue', open)
}
</script>

<style scoped>
.registrar-deuda-modal__body { display: flex; flex-direction: column; gap: var(--spacing-md); }
.registrar-deuda-modal__actions { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); margin-top: var(--spacing-sm); }
.registrar-deuda-modal__actions > * { flex: 1 1 9rem; }
.registrar-deuda-modal__abono { display: flex; flex-direction: column; gap: var(--spacing-xs); }
.registrar-deuda-modal__cuotas { display: flex; flex-direction: column; gap: var(--spacing-sm); }
.registrar-deuda-modal__hint { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }
</style>
