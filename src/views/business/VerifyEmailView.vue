<template>
  <!-- Vista: /verificar-correo?token=… (el enlace del correo de verificación). Abrir la página NO
       confirma nada: los escáneres de correo abren los enlaces solos. Solo el botón hace el POST. -->
  <section
    class="verify-email"
    aria-label="Confirmar correo"
  >
    <div class="verify-email__inner container">
      <h1
        ref="titleEl"
        class="verify-email__title"
        tabindex="-1"
      >
        {{ title }}
      </h1>

      <template v-if="state === 'ready' || state === 'working' || state === 'error'">
        <p class="verify-email__text">
          Toca el botón para terminar. Después revisaremos tu solicitud.
        </p>
        <p
          v-if="errorMessage"
          class="verify-email__text"
          role="alert"
        >
          {{ errorMessage }}
        </p>
        <AppButton
          type="button"
          variant="primary"
          size="lg"
          block
          :loading="state === 'working'"
          :disabled="state === 'working'"
          @click="confirm"
        >
          Confirmar mi correo
        </AppButton>
      </template>

      <p
        v-else-if="state === 'done'"
        class="verify-email__text verify-email__text--ok"
        role="status"
      >
        Listo. Revisaremos tu solicitud y te escribiremos por WhatsApp.
      </p>

      <template v-else-if="state === 'expired'">
        <p
          class="verify-email__text"
          role="alert"
        >
          Este enlace ya se usó o venció. Escribe tu correo y te mandamos otro.
        </p>
        <AppInput
          v-model="correo"
          name="correo"
          type="email"
          inputmode="email"
          label="Tu correo"
          placeholder="tu@correo.com"
          autocomplete="email"
          :disabled="asking"
          :error="correoError"
        />
        <p
          v-if="askMessage"
          class="verify-email__text"
          role="status"
        >
          {{ askMessage }}
        </p>
        <AppButton
          type="button"
          variant="primary"
          size="lg"
          block
          :loading="asking"
          :disabled="asking"
          @click="askAnother"
        >
          Pedir otro enlace
        </AppButton>
      </template>

      <template v-else>
        <p
          class="verify-email__text"
          role="alert"
        >
          Revisa que hayas abierto el enlace completo del correo, o regístrate de nuevo.
        </p>
        <RouterLink
          class="verify-email__link"
          to="/registro-negocio"
        >
          Ir al registro
        </RouterLink>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppButton from '@/components/ui/atoms/AppButton.vue'
import AppInput from '@/components/ui/molecules/AppInput.vue'
import BusinessRegistrationService from '@/services/business-registration.service'
import { businessRegistrationSchema } from '@/validation/business-registration.schema'
import { describeRegistrationFailure, readRegistrationFailure } from '@/utils/registration-api-error'

type State = 'ready' | 'working' | 'done' | 'expired' | 'error' | 'invalid'

const route = useRoute()
// Un solo ?token=… de texto; cualquier otra cosa (falta, varios) no sirve
const token = typeof route.query.token === 'string' ? route.query.token : ''

const state = ref<State>(token ? 'ready' : 'invalid')
const errorMessage = ref('')
const titleEl = ref<HTMLElement | null>(null)

const correo = ref('')
const correoError = ref('')
const asking = ref(false)
const askMessage = ref('')

const TITLES: Record<State, string> = {
  ready: 'Confirma tu correo',
  working: 'Confirma tu correo',
  done: 'Correo confirmado',
  expired: 'Enlace vencido',
  error: 'Confirma tu correo',
  invalid: 'Este enlace no sirve',
}
const title = computed(() => TITLES[state.value])

// El resultado se anuncia llevando el foco al título del nuevo estado
watch(state, async (now) => {
  if (now === 'working') return
  await nextTick()
  titleEl.value?.focus()
})

async function confirm() {
  if (state.value === 'working') return
  state.value = 'working'
  errorMessage.value = ''
  try {
    await BusinessRegistrationService.verifyEmail(token)
    state.value = 'done'
  } catch (cause) {
    const failure = readRegistrationFailure(cause)
    if (failure.status === 400 && failure.code === 'link_invalid') {
      state.value = 'expired'
    } else {
      errorMessage.value = describeRegistrationFailure(cause, failure, 'Por ahora no pudimos terminar. Intenta de nuevo en un rato.')
      state.value = 'error'
    }
  }
}

async function askAnother() {
  if (asking.value) return
  const parsed = businessRegistrationSchema.shape.correo.safeParse(correo.value)
  if (!parsed.success) {
    correoError.value = parsed.error.issues[0]?.message ?? ''
    return
  }
  correoError.value = ''
  asking.value = true
  askMessage.value = ''
  try {
    await BusinessRegistrationService.resend(parsed.data)
    askMessage.value = 'Listo. Si ese correo tiene una solicitud sin confirmar, te mandamos otro enlace.'
  } catch (cause) {
    askMessage.value = describeRegistrationFailure(cause)
  } finally {
    asking.value = false
  }
}
</script>

<style scoped>
.verify-email { padding: var(--spacing-xl) var(--spacing-md) var(--spacing-2xl); }
.verify-email__inner { max-width: 32rem; margin: 0 auto; display: flex; flex-direction: column; gap: var(--spacing-md); }
.verify-email__title { margin: 0; font-size: var(--font-size-2xl); font-weight: 800; color: var(--color-text); text-align: center; }
.verify-email__title:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 4px; border-radius: var(--radius-sm); }
.verify-email__text { margin: 0; color: var(--color-text); line-height: 1.55; text-align: center; }
.verify-email__text--ok { font-weight: 600; }
.verify-email__link {
  align-self: center;
  color: var(--color-primary-hover);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
.verify-email__link:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; border-radius: var(--radius-sm); }
</style>
