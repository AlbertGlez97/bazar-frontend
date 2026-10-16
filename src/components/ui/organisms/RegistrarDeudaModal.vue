<template>
  <!-- Organismo: formulario de fiado/apartado (D3, solo con una línea en el
       carrito). Presentacional, como IncidenciaDetailModal: no lee stores ni
       llama servicios, solo valida y emite lo que la persona confirmó. El
       contenedor (SaleView) hace las llamadas reales y decide el resultado.
       El abono inicial ya NO se pide aquí: viene del monto del cobro y del método
       elegido, y se muestra de solo lectura (Total, Abono inicial, Saldo
       pendiente). Para cambiarlo se cierra el modal y se corrige el monto del
       cobro. D2: cuotas planeadas opcionales, colapsadas, con el calendario
       multi-fecha. -->
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

      <!-- Solo lectura: el abono sale del monto del cobro, con el método elegido. -->
      <dl
        class="registrar-deuda-modal__resumen"
        aria-label="Resumen del fiado"
      >
        <div class="registrar-deuda-modal__resumen-row">
          <dt>{{ VOICE.deuda.totalLabel }}</dt>
          <dd data-field="total">
            {{ formatMinorMoney(totalMinor) }}
          </dd>
        </div>
        <div class="registrar-deuda-modal__resumen-row">
          <dt>{{ VOICE.deuda.abonoInicialLabel }}</dt>
          <dd data-field="abono">
            {{ formatMinorMoney(abonoInicialMinor) }}<template v-if="abonoInicialMinor > 0">
              · {{ paymentMethodLabel(paymentMethod) }}
            </template>
          </dd>
        </div>
        <div class="registrar-deuda-modal__resumen-row registrar-deuda-modal__resumen-row--saldo">
          <dt>{{ VOICE.deuda.saldoLabel }}</dt>
          <dd data-field="saldo">
            {{ formatMinorMoney(saldoMinor) }}
          </dd>
        </div>
      </dl>
      <p class="registrar-deuda-modal__hint">
        {{ VOICE.deuda.abonoReadonlyHint }}
      </p>

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
import { formatMinorMoney, subtractMinor } from '@/utils/money'
import { paymentMethodLabel } from '@/utils/payment-method'
import type { PaymentMethod } from '@/types/payment.types'
import type { DeudaType } from '@/types/deuda.types'
import type { CuotaDraft } from '@/components/ui/molecules/CuotasPlaneadasEditor.vue'

const props = defineProps<{
  modelValue: boolean
  /** Cobro/registro en curso: bloquea el formulario, como `loading` en SaleCart. */
  submitting?: boolean
  /** Total de la deuda (línea única del carrito), para sugerir el reparto de cuotas (D2). */
  totalMinor: number
  /** Abono inicial: el monto del cobro (puede ser 0). Solo lectura aquí. */
  abonoInicialMinor: number
  /** Método con el que se paga ese abono (el que se eligió en el cobro). */
  paymentMethod: PaymentMethod
}>()

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  confirm: [payload: {
    type: DeudaType
    deudor: { nombre: string; telefono?: string; notas?: string }
    /** El monto del cobro, tal como se mostró en el resumen. */
    abonoInicialMinor: number
    /** El método elegido en el cobro. */
    abonoInicialPaymentMethod: PaymentMethod
    /** D2: vacío cuando la sección de cuotas está apagada. */
    cuotasPlaneadas: CuotaDraft[]
  }]
}>()

const type = ref<DeudaType>('fiado')
const nombre = ref('')
const telefono = ref('')
const notas = ref('')
const nombreError = ref<string | null>(null)

// Saldo pendiente: lo que queda después del abono. Nunca negativo.
const saldoMinor = computed(() => Math.max(0, subtractMinor(props.totalMinor, props.abonoInicialMinor)))

// D2: colapsada por defecto; el saldo que se reparte entre las cuotas es el
// total MENOS el abono inicial (nunca el total completo).
const cuotasEnabled = ref(false)
const cuotas = ref<CuotaDraft[]>([])
const remainingForCuotas = computed(() => saldoMinor.value)

function onCuotasUpdate(rows: CuotaDraft[]) {
  cuotas.value = rows
}

function reset() {
  type.value = 'fiado'
  nombre.value = ''
  telefono.value = ''
  notas.value = ''
  nombreError.value = null
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

  const trimmedTelefono = telefono.value.trim()
  const trimmedNotas = notas.value.trim()
  emit('confirm', {
    type: type.value,
    deudor: {
      nombre: trimmedNombre,
      ...(trimmedTelefono ? { telefono: trimmedTelefono } : {}),
      ...(trimmedNotas ? { notas: trimmedNotas } : {}),
    },
    abonoInicialMinor: props.abonoInicialMinor,
    abonoInicialPaymentMethod: props.paymentMethod,
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
.registrar-deuda-modal__resumen { display: flex; flex-direction: column; gap: var(--spacing-xs); margin: 0; padding: var(--spacing-md); background: var(--color-surface-alt); border-radius: var(--radius-lg); }
.registrar-deuda-modal__resumen-row { display: flex; align-items: baseline; justify-content: space-between; gap: var(--spacing-md); }
.registrar-deuda-modal__resumen-row dt { font-size: var(--font-size-md); color: var(--color-text-muted); }
.registrar-deuda-modal__resumen-row dd { margin: 0; font-size: var(--font-size-lg); font-weight: 700; color: var(--color-text); font-variant-numeric: tabular-nums; text-align: right; overflow-wrap: anywhere; }
.registrar-deuda-modal__resumen-row--saldo dd { font-weight: 800; }
.registrar-deuda-modal__cuotas { display: flex; flex-direction: column; gap: var(--spacing-sm); }
.registrar-deuda-modal__hint { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }
</style>
