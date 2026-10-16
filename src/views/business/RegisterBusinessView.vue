<template>
  <section
    class="register-business"
    aria-label="Registro de negocio"
  >
    <div class="register-business__inner container">
      <template v-if="!registered">
        <h1 class="register-business__title">
          Registra tu negocio
        </h1>
        <p class="register-business__subtitle">
          Cuéntanos de tu negocio. Cuando lo revisemos, te escribimos por WhatsApp.
        </p>
      </template>

      <!-- El formulario se OCULTA (no se destruye) al pasar a "Revisa tu correo": si la persona
           se equivocó de correo, vuelve con todo lo escrito en su sitio. -->
      <BusinessRegistrationForm
        v-show="!registered"
        ref="form"
        :loading="loading"
        :site-key="siteKey"
        @submit="handleSubmit"
      />

      <!-- Todavía NO hay solicitud en revisión: el aprobador no sabe nada hasta que la persona
           confirme su correo con el enlace. Aquí se le dice qué hacer. -->
      <CheckEmailNotice
        v-if="registered"
        class="register-business__check"
        :correo="sentTo"
        :seconds-left="cooldown.remaining.value"
        :resending="resending"
        :message="resendMessage"
        @resend="handleResend"
        @change-email="backToForm"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
// Vista: única responsable de la llamada real al backend (las moléculas de
// ui/ no acceden a stores ni hacen fetch, ver reglas del barrel @/components).
import { nextTick, ref } from 'vue'
import { BusinessRegistrationForm, CheckEmailNotice } from '@/components'
import BusinessRegistrationService from '@/services/business-registration.service'
import { useToastStore } from '@/stores/toast.store'
import { useCountdown } from '@/composables/useCountdown'
import { VOICE, isNetworkError } from '@/config/voice'
import { EMAIL_INVALID_MESSAGE, PHONE_INVALID_MESSAGE } from '@/validation/business-registration.schema'
import type { BusinessRegistrationPayload } from '@/types/business-registration.types'

/** Espera entre dos correos de verificación (el servidor exige 60 s). */
const RESEND_WAIT_SECONDS = 60

const MESSAGES = {
  rateLimited: 'Hiciste muchos intentos. Espera un rato y vuelve a intentar.',
  emailUnavailable: 'Por ahora no pudimos mandar el correo. Intenta de nuevo en un rato.',
  turnstileUnavailable: 'Por ahora no podemos hacer la verificación de seguridad. Intenta de nuevo en un rato.',
  turnstileInvalid: 'No pudimos confirmar la verificación de seguridad. Inténtalo de nuevo.',
  resent: 'Listo. Si el correo existe, te mandamos otro enlace.',
} as const

const siteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '').trim()

const loading = ref(false)
const registered = ref(false)
const sentTo = ref('')
const resending = ref(false)
const resendMessage = ref('')
const cooldown = useCountdown()
const form = ref<InstanceType<typeof BusinessRegistrationForm> | null>(null)
const toast = useToastStore()

interface ApiFailure { status: number | null; code: string | null; messages: string[] }

/** Los 400 de class-validator traen `message` como string o como array de strings. */
function readFailure(cause: unknown): ApiFailure {
  const response = (cause as { response?: { status?: number; data?: { code?: unknown; message?: unknown } } } | null)?.response
  const message = response?.data?.message
  return {
    status: response?.status ?? null,
    code: typeof response?.data?.code === 'string' ? response.data.code : null,
    messages: (Array.isArray(message) ? message : [message]).filter((m): m is string => typeof m === 'string'),
  }
}

/** Texto para un fallo de red/servidor que no tiene un campo propio. */
function describeFailure(cause: unknown, failure: ApiFailure): string {
  if (isNetworkError(cause)) return VOICE.networkError
  if (failure.status === 429) return MESSAGES.rateLimited
  if (failure.status === 503) {
    return failure.code === 'turnstile_unavailable' ? MESSAGES.turnstileUnavailable : MESSAGES.emailUnavailable
  }
  if (failure.status === 400 && failure.code === 'turnstile_invalid') return MESSAGES.turnstileInvalid
  return VOICE.genericError
}

async function handleSubmit(payload: BusinessRegistrationPayload) {
  if (loading.value) return // doble envío
  loading.value = true
  try {
    await BusinessRegistrationService.register(payload)
    sentTo.value = payload.correo
    resendMessage.value = ''
    registered.value = true
    cooldown.start(RESEND_WAIT_SECONDS)
  } catch (cause) {
    const failure = readFailure(cause)
    // Un 400 que habla del correo o del teléfono se muestra bajo ese campo, con nuestro
    // texto (el del servidor viene en inglés); todo lo demás, un aviso.
    if (failure.status === 400 && failure.messages.some((m) => /correo|email/i.test(m))) {
      form.value?.setFieldError('correo', EMAIL_INVALID_MESSAGE)
    } else if (failure.status === 400 && failure.messages.some((m) => /tel[eé]fono|phone/i.test(m))) {
      form.value?.setFieldError('telefono', PHONE_INVALID_MESSAGE)
    } else {
      toast.error(describeFailure(cause, failure))
    }
  } finally {
    loading.value = false
  }
}

async function handleResend() {
  if (resending.value || cooldown.running.value) return
  resending.value = true
  resendMessage.value = ''
  try {
    await BusinessRegistrationService.resend(sentTo.value)
    resendMessage.value = MESSAGES.resent
    cooldown.start(RESEND_WAIT_SECONDS)
  } catch (cause) {
    resendMessage.value = describeFailure(cause, readFailure(cause))
  } finally {
    resending.value = false
  }
}

async function backToForm() {
  registered.value = false
  await nextTick()
  document.querySelector<HTMLElement>('input[name="correo"]')?.focus()
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
