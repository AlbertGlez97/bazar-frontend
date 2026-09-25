<template>
  <section
    class="register-business"
    aria-label="Registro de negocio"
  >
    <div class="register-business__inner container">
      <template v-if="!submitted">
        <h1 class="register-business__title">
          Registra tu negocio
        </h1>
        <p class="register-business__subtitle">
          Cuéntanos de tu negocio y lo revisamos para activar tu cuenta.
        </p>

        <BusinessRegistrationForm
          ref="form"
          :loading="loading"
          @submit="handleSubmit"
        />
      </template>

      <!-- Confirmación tras envío exitoso — NO hay login ni sesión aquí:
           la aprobación es manual y posterior por parte de Alberto. Se dice lo
           que pasa de verdad: solo si se aprueba llegan las credenciales, al
           correo que dio; si se rechaza no se envía nada. -->
      <AppAlert
        v-else
        type="success"
        title="Solicitud enviada"
      >
        Recibimos tu solicitud y la vamos a revisar. Si la aprobamos, te
        mandamos tu usuario y contraseña a <strong>{{ sentTo }}</strong>. Si
        no, no te enviamos nada.
      </AppAlert>
    </div>
  </section>
</template>

<script setup lang="ts">
// Vista: única responsable de la llamada real al backend (las moléculas de
// ui/ no acceden a stores ni hacen fetch, ver reglas del barrel @/components).
import { ref } from 'vue'
import { BusinessRegistrationForm, AppAlert } from '@/components'
import BusinessRegistrationService from '@/services/business-registration.service'
import { useToastStore } from '@/stores/toast.store'
import { VOICE, isNetworkError } from '@/config/voice'
import { EMAIL_INVALID_MESSAGE } from '@/validation/business-registration.schema'
import type { BusinessRegistrationPayload } from '@/types/business-registration.types'

const loading = ref(false)
const submitted = ref(false)
const sentTo = ref('')
const form = ref<InstanceType<typeof BusinessRegistrationForm> | null>(null)
const toast = useToastStore()

/** Los 400 de class-validator traen \`message\` como string o como array de strings. */
function serverMessages(cause: unknown): string[] {
  const message = (cause as { response?: { data?: { message?: unknown } } } | null)
    ?.response?.data?.message
  return (Array.isArray(message) ? message : [message]).filter(
    (m): m is string => typeof m === 'string',
  )
}

async function handleSubmit(payload: BusinessRegistrationPayload) {
  if (loading.value) return // doble envío
  loading.value = true
  try {
    await BusinessRegistrationService.register(payload)
    sentTo.value = payload.correo
    submitted.value = true
  } catch (cause) {
    const status = (cause as { response?: { status?: number } } | null)?.response?.status
    // Un 400 que habla del correo se muestra bajo ese campo, con nuestro texto
    // (el del servidor viene en inglés); todo lo demás, un aviso genérico.
    if (status === 400 && serverMessages(cause).some((m) => /correo|email/i.test(m))) {
      form.value?.setFieldError('correo', EMAIL_INVALID_MESSAGE)
    } else {
      toast.error(isNetworkError(cause) ? VOICE.networkError : VOICE.genericError)
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.register-business { padding: var(--spacing-xl) var(--spacing-md) var(--spacing-2xl); }
.register-business__inner { max-width: 32rem; margin: 0 auto; }
.register-business__title {
  font-size:   var(--font-size-2xl);
  font-weight: 800;
  color:       var(--color-text);
  text-align:  center;
}
.register-business__subtitle {
  margin: var(--spacing-sm) 0 var(--spacing-lg);
  color:      var(--color-text-muted);
  text-align: center;
}
</style>
