<template>
  <!-- Molécula: confirmación de revocar o reemitir un dispositivo. Dice el efecto en
       claro, avisa cuando es el dispositivo que se está usando (se desconectará) y,
       al reemitir, deja mandar el código nuevo por correo. No hace fetch: emite
       `confirm` y la vista llama al servidor. -->
  <form
    class="device-action-confirm"
    novalidate
    @submit.prevent="handleSubmit"
  >
    <p
      v-if="action === 'revoke'"
      class="device-action-confirm__text"
    >
      «{{ deviceName }}» dejará de poder usar la app de inmediato. Si más adelante lo necesitas otra vez, puedes reemitir un código nuevo.
    </p>
    <p
      v-else
      class="device-action-confirm__text"
    >
      Vamos a generar un código nuevo de un solo uso para «{{ deviceName }}». Su acceso actual dejará de funcionar de inmediato y la persona tendrá que activarlo otra vez con el código nuevo.
    </p>

    <AppAlert
      v-if="isCurrentDevice"
      type="warning"
      :dismissible="false"
    >
      Es el dispositivo que estás usando ahora: se va a desconectar y tendrás que volver a activarlo con un código.
    </AppAlert>

    <AppInput
      v-if="action === 'reissue'"
      v-model="correoEnvio"
      label="Enviar el código por correo (opcional)"
      name="correoEnvio"
      type="email"
      inputmode="email"
      size="lg"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      :disabled="loading"
      :error="emailError || serverErrors.correoEnvio || undefined"
    />

    <AppAlert
      v-if="error"
      type="error"
      :dismissible="false"
    >
      {{ error }}
    </AppAlert>

    <div class="device-action-confirm__actions">
      <AppButton
        type="button"
        variant="secondary"
        size="lg"
        :disabled="loading"
        @click="emit('cancel')"
      >
        Mejor no
      </AppButton>
      <AppButton
        type="submit"
        :variant="action === 'revoke' ? 'danger' : 'primary'"
        size="lg"
        :loading="loading"
        :disabled="loading"
      >
        {{ action === 'revoke' ? 'Sí, revocar' : 'Reemitir código' }}
      </AppButton>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AppInput from '@/components/ui/atoms/AppInput.vue'
import AppButton from '@/components/ui/atoms/AppButton.vue'
import AppAlert from '@/components/ui/molecules/AppAlert.vue'
import { VOICE, type DeviceAdminField } from '@/config/voice'
import type { ReissueDevicePayload } from '@/types/device.types'

const props = withDefaults(defineProps<{
  action: 'revoke' | 'reissue'
  deviceName: string
  /** Es el dispositivo que se está usando ahora: avisa que se desconectará */
  isCurrentDevice?: boolean
  /** Controlado por la vista mientras espera al servidor */
  loading?: boolean
  serverErrors?: Partial<Record<DeviceAdminField, string>>
  error?: string | null
}>(), {
  isCurrentDevice: false,
  loading: false,
  serverErrors: () => ({}),
  error: null,
})

const emit = defineEmits<{
  /** Sin datos al revocar; al reemitir, con `correoEnvio` si se escribió uno válido */
  confirm: [payload: ReissueDevicePayload]
  cancel: []
}>()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const correoEnvio = ref('')
const emailError = ref('')

function handleSubmit() {
  if (props.loading) return
  const payload: ReissueDevicePayload = {}
  if (props.action === 'reissue') {
    const correo = correoEnvio.value.trim()
    emailError.value = correo && !EMAIL_RE.test(correo) ? VOICE.devices.badEmail : ''
    if (emailError.value) return
    if (correo) payload.correoEnvio = correo
  }
  emit('confirm', payload)
}
</script>

<style scoped>
.device-action-confirm {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.device-action-confirm__text { margin: 0; }
.device-action-confirm__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}
</style>
