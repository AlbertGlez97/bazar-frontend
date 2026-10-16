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
import { describeRegistrationFailure, readRegistrationFailure } from '@/utils/registration-api-error'
import { EMAIL_INVALID_MESSAGE, PHONE_INVALID_MESSAGE } from '@/validation/business-registration.schema'
import type { BusinessRegistrationPayload } from '@/types/business-registration.types'

/** Espera entre dos correos de verificación (el servidor exige 60 s). */
const RESEND_WAIT_SECONDS = 60

const RESENT_MESSAGE = 'Listo. Si el correo existe, te mandamos otro enlace.'

const siteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '').trim()

const loading = ref(false)
const registered = ref(false)
const sentTo = ref('')
const resending = ref(false)
const resendMessage = ref('')
const cooldown = useCountdown()
const form = ref<InstanceType<typeof BusinessRegistrationForm> | null>(null)
const toast = useToastStore()

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
    const failure = readRegistrationFailure(cause)
    // Un 400 que habla del correo o del teléfono se muestra bajo ese campo, con nuestro
    // texto (el del servidor viene en inglés); todo lo demás, un aviso.
    if (failure.status === 400 && failure.messages.some((m) => /correo|email/i.test(m))) {
      form.value?.setFieldError('correo', EMAIL_INVALID_MESSAGE)
    } else if (failure.status === 400 && failure.messages.some((m) => /tel[eé]fono|phone/i.test(m))) {
      form.value?.setFieldError('telefono', PHONE_INVALID_MESSAGE)
    } else {
      toast.error(describeRegistrationFailure(cause, failure))
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
    resendMessage.value = RESENT_MESSAGE
    cooldown.start(RESEND_WAIT_SECONDS)
  } catch (cause) {
    resendMessage.value = describeRegistrationFailure(cause)
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
