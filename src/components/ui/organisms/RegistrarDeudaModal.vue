<template>
  <!-- Organismo: formulario de fiado/apartado (D3, solo con una línea en el
       carrito). Presentacional, como IncidenciaDetailModal: no lee stores ni
       llama servicios, solo valida y emite lo que la persona confirmó. El
       contenedor (SaleView) hace las llamadas reales y decide el resultado. -->
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
import { ref, watch } from 'vue'
import { AppButton, AppInput, AppModal, AppSelect, AppTextarea } from '@/components'
import { VOICE } from '@/config/voice'
import type { DeudaType } from '@/types/deuda.types'

const props = defineProps<{
  modelValue: boolean
  /** Cobro/registro en curso: bloquea el formulario, como `loading` en SaleCart. */
  submitting?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  confirm: [payload: { type: DeudaType; deudor: { nombre: string; telefono?: string; notas?: string } }]
}>()

const type = ref<DeudaType>('fiado')
const nombre = ref('')
const telefono = ref('')
const notas = ref('')
const nombreError = ref<string | null>(null)

function reset() {
  type.value = 'fiado'
  nombre.value = ''
  telefono.value = ''
  notas.value = ''
  nombreError.value = null
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
</style>
