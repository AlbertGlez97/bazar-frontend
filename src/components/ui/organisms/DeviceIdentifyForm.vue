<template>
  <!-- Organismo: formulario para identificar el dispositivo físico (tablet).
       No hace fetch (regla del barrel @/components): solo valida y emite
       `submit`; la vista (SelectContextView) hace la llamada real a
       POST /devices/identify y decide qué hacer con la respuesta/error. -->
  <form
    class="device-identify-form"
    novalidate
    @submit.prevent="handleSubmit"
  >
    <!-- Cuenta personal: aún no hay dispositivo registrado en este teléfono o computadora. -->
    <p
      v-if="bound"
      class="device-identify-form__hint"
    >
      Un socio te puede dar un código. Pídele que entre a Ajustes y luego a Dispositivos, y toque
      Registrar dispositivo. Escribe aquí el código y el nombre que te dé.
    </p>
    <p
      v-else
      class="device-identify-form__hint"
    >
      Este dispositivo aún no está identificado. Pídele a un socio el
      <strong>identificador</strong> y el <strong>nombre</strong> exactos con
      los que autorizó esta tablet o teléfono.
    </p>

    <AppInput
      v-model="form.identifier"
      :label="bound ? 'Código del dispositivo' : 'Identificador del dispositivo'"
      :placeholder="bound ? 'Ej. 0190a5f0…' : 'Ej. shared-tablet'"
      autocomplete="off"
      :disabled="loading"
      :error="errors.identifier"
      @blur="validateIdentifier"
    />

    <AppInput
      v-model="form.name"
      label="Nombre del dispositivo"
      placeholder="Ej. Shared tablet"
      autocomplete="off"
      :disabled="loading"
      :error="errors.name"
      @blur="validateName"
    />
    <p
      v-if="bound"
      class="device-identify-form__hint"
    >
      El código sirve una sola vez.
    </p>

    <!-- El padre pasa aquí el mensaje (403 "no registrado", 409 "identificador
         ya usado" u otro error de red) y su gravedad: la molécula solo lo
         muestra, y el formulario sigue editable para reintentar. -->
    <AppAlert
      v-if="error"
      :type="errorType"
      :dismissible="false"
    >
      {{ error }}
    </AppAlert>

    <AppButton
      type="submit"
      variant="primary"
      size="lg"
      block
      :loading="loading"
      :disabled="loading"
    >
      Identificar dispositivo
    </AppButton>
  </form>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import AppInput from '@/components/ui/molecules/AppInput.vue'
import AppButton from '@/components/ui/atoms/AppButton.vue'
import AppAlert from '@/components/ui/molecules/AppAlert.vue'
import type { DeviceIdentifyPayload } from '@/types/device.types'

withDefaults(defineProps<{
  /** Controlado por el padre mientras espera la respuesta de POST /devices/identify */
  loading?: boolean
  /** Mensaje a mostrar (ej. 403 "dispositivo no registrado", 409 "identificador ya usado") */
  error?: string | null
  /** Gravedad de la alerta: "error" por defecto; "warning" para un identificador ya usado */
  errorType?: 'error' | 'warning'
  /** Cuenta personal (atada a un socio): pide un código a un socio en vez del identificador de la tablet. */
  bound?: boolean
}>(), {
  loading: false,
  error: null,
  errorType: 'error',
  bound: false,
})

const emit = defineEmits<{
  /** Se emite únicamente cuando la validación de cliente pasa */
  submit: [payload: DeviceIdentifyPayload]
}>()

const form = reactive({ identifier: '', name: '' })
const errors = reactive({ identifier: '', name: '' })

function validateIdentifier() {
  errors.identifier = form.identifier.trim() ? '' : 'Escribe el identificador del dispositivo.'
}

function validateName() {
  errors.name = form.name.trim() ? '' : 'Escribe el nombre del dispositivo.'
}

function isValid() {
  validateIdentifier()
  validateName()
  return !errors.identifier && !errors.name
}

function handleSubmit() {
  if (!isValid()) return

  emit('submit', {
    identifier: form.identifier.trim(),
    name: form.name.trim(),
  })
}
</script>

<style scoped>
.device-identify-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.device-identify-form__hint {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
</style>
