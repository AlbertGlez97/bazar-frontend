<template>
  <!-- Molécula: formulario para identificar el dispositivo físico (tablet).
       No hace fetch (regla del barrel @/components): solo valida y emite
       `submit`; la vista (SelectContextView) hace la llamada real a
       POST /devices/identify y decide qué hacer con la respuesta/error. -->
  <form
    class="device-identify-form"
    novalidate
    @submit.prevent="handleSubmit"
  >
    <p class="device-identify-form__hint">
      Este dispositivo todavía no está identificado. Pide a un socio el
      <strong>identificador</strong> y <strong>nombre</strong> exactos con los
      que autorizó esta tablet o teléfono.
    </p>

    <AppInput
      v-model="form.identifier"
      label="Identificador del dispositivo"
      placeholder="Ej. shared-tablet"
      :disabled="loading"
      :error="errors.identifier"
      @blur="validateIdentifier"
    />

    <AppInput
      v-model="form.name"
      label="Nombre del dispositivo"
      placeholder="Ej. Shared tablet"
      :disabled="loading"
      :error="errors.name"
      @blur="validateName"
    />

    <!-- El padre pasa aquí el mensaje de 403 ("Device is unknown or
         unauthorized") u otro error de red — la molécula solo lo muestra. -->
    <AppAlert
      v-if="error"
      type="error"
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
import AppInput from '@/components/ui/atoms/AppInput.vue'
import AppButton from '@/components/ui/atoms/AppButton.vue'
import AppAlert from '@/components/ui/molecules/AppAlert.vue'
import type { DeviceIdentifyPayload } from '@/types/device.types'

withDefaults(defineProps<{
  /** Controlado por el padre mientras espera la respuesta de POST /devices/identify */
  loading?: boolean
  /** Mensaje de error a mostrar (ej. 403 "dispositivo no autorizado") */
  error?: string | null
}>(), {
  loading: false,
  error: null,
})

const emit = defineEmits<{
  /** Se emite únicamente cuando la validación de cliente pasa */
  submit: [payload: DeviceIdentifyPayload]
}>()

const form = reactive({ identifier: '', name: '' })
const errors = reactive({ identifier: '', name: '' })

function validateIdentifier() {
  errors.identifier = form.identifier.trim() ? '' : 'El identificador es requerido'
}

function validateName() {
  errors.name = form.name.trim() ? '' : 'El nombre del dispositivo es requerido'
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
