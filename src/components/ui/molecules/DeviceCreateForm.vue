<template>
  <!-- Molécula: formulario para registrar un dispositivo (solo socios). No hace
       fetch (regla del barrel @/components): valida y emite `submit`; la vista llama
       a POST /devices. El nombre es lo que la persona tendrá que escribir, exacto,
       junto al código; el correo es opcional: sin él, el código se muestra aquí. -->
  <form
    class="device-create-form"
    novalidate
    @submit.prevent="handleSubmit"
  >
    <AppInput
      v-model="form.name"
      label="Nombre del dispositivo"
      name="name"
      size="lg"
      autocomplete="off"
      placeholder="Ej. Tablet del mostrador"
      aria-describedby="device-create-name-hint"
      :disabled="loading"
      :error="errors.name || serverErrors.name || undefined"
    />
    <p
      id="device-create-name-hint"
      class="device-create-form__hint"
    >
      Quien active el dispositivo tendrá que escribir este nombre exactamente igual, junto con el código.
    </p>

    <AppInput
      v-model="form.correoEnvio"
      label="Correo para enviarle el código (opcional)"
      name="correoEnvio"
      type="email"
      inputmode="email"
      size="lg"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      aria-describedby="device-create-email-hint"
      :disabled="loading"
      :error="errors.correoEnvio || serverErrors.correoEnvio || undefined"
    />
    <p
      id="device-create-email-hint"
      class="device-create-form__hint"
    >
      Déjalo vacío para ver el código aquí y compartirlo tú mismo.
    </p>

    <AppAlert
      v-if="error"
      type="error"
      :dismissible="false"
    >
      {{ error }}
    </AppAlert>

    <div class="device-create-form__actions">
      <AppButton
        type="button"
        variant="secondary"
        size="lg"
        :disabled="loading"
        @click="emit('cancel')"
      >
        Cancelar
      </AppButton>
      <AppButton
        type="submit"
        variant="primary"
        size="lg"
        :loading="loading"
        :disabled="loading"
      >
        Registrar dispositivo
      </AppButton>
    </div>
  </form>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import AppInput from '@/components/ui/atoms/AppInput.vue'
import AppButton from '@/components/ui/atoms/AppButton.vue'
import AppAlert from '@/components/ui/molecules/AppAlert.vue'
import { VOICE, type DeviceAdminField } from '@/config/voice'
import type { CreateDevicePayload } from '@/types/device.types'

const props = withDefaults(defineProps<{
  /** Controlado por la vista mientras espera la respuesta de POST /devices */
  loading?: boolean
  /** Lo que el servidor señaló campo por campo (400) */
  serverErrors?: Partial<Record<DeviceAdminField, string>>
  /** Error general (403, 502, red…) */
  error?: string | null
}>(), {
  loading: false,
  serverErrors: () => ({}),
  error: null,
})

const emit = defineEmits<{
  /** Solo cuando la validación de cliente pasa */
  submit: [payload: CreateDevicePayload]
  cancel: []
}>()

const MAX_NAME = 100
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const form = reactive({ name: '', correoEnvio: '' })
const errors = reactive({ name: '', correoEnvio: '' })

function validate(): boolean {
  const name = form.name.trim()
  errors.name = !name ? 'Escribe el nombre del dispositivo.'
    : name.length > MAX_NAME ? `El nombre es demasiado largo (máximo ${MAX_NAME} caracteres).` : ''

  const correo = form.correoEnvio.trim()
  errors.correoEnvio = correo && !EMAIL_RE.test(correo) ? VOICE.devices.badEmail : ''

  return !errors.name && !errors.correoEnvio
}

function handleSubmit() {
  if (props.loading) return
  if (!validate()) return

  const payload: CreateDevicePayload = { name: form.name.trim() }
  const correo = form.correoEnvio.trim()
  if (correo) payload.correoEnvio = correo
  emit('submit', payload)
}
</script>

<style scoped>
.device-create-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.device-create-form__hint {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  margin: calc(var(--spacing-sm) * -1) 0 0;
}
.device-create-form__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}
</style>
