<template>
  <section
    class="select-context"
    aria-label="Identificación del dispositivo"
  >
    <div class="select-context__inner container">
      <!-- La cuenta no puede entrar: su persona está desactivada, la cuenta no
           tiene persona asignada o no se pudo confirmar. Se explica y no hay
           nada más que hacer aquí — ni dispositivo. -->
      <template v-if="blocked">
        <h1 class="select-context__title">
          {{ blocked.title }}
        </h1>
        <p class="select-context__subtitle">
          {{ blocked.body }}
        </p>
        <div class="select-context__actions">
          <AppButton
            v-if="isUnknown"
            data-test="retry"
            :loading="retrying"
            @click="handleRetry"
          >
            {{ VOICE.accountUnconfirmed.retry }}
          </AppButton>
          <AppButton
            variant="secondary"
            data-test="sign-out"
            @click="handleSignOut"
          >
            {{ VOICE.accountInactive.signOut }}
          </AppButton>
        </div>
      </template>

      <template v-else>
        <h1 class="select-context__title">
          {{ heading.title }}
        </h1>
        <p
          v-if="heading.subtitle"
          class="select-context__subtitle"
        >
          {{ heading.subtitle }}
        </p>

        <p
          v-if="sessionStore.recoveryReason"
          role="status"
          class="select-context__subtitle"
        >
          {{ VOICE.contextRecovery[sessionStore.recoveryReason] }}
        </p>

        <!-- Identificar el dispositivo (solo si aún no está guardado en
             localStorage — el dispositivo es físico/fijo, no se repite en
             cada apertura de la app). La persona no se elige: es la de la
             cuenta. -->
        <DeviceIdentifyForm
          v-if="!sessionStore.isDeviceIdentified"
          :bound="isBound"
          :loading="deviceLoading"
          :error="deviceError"
          :error-type="deviceErrorType"
          @submit="handleDeviceSubmit"
        />

        <!-- Salida SIEMPRE disponible: el router devuelve aquí a quien no tiene contexto, así que
             sin esto, quien no tiene el código quedaría atrapado. Cierra la sesión y va al login. -->
        <div class="select-context__exit">
          <AppButton
            type="button"
            variant="secondary"
            block
            data-test="exit"
            @click="handleSignOut"
          >
            {{ needsDevice ? 'No lo tengo, salir' : 'Cerrar sesión' }}
          </AppButton>
          <p
            v-if="needsDevice"
            class="select-context__exit-help"
          >
            Puedes volver cuando un socio te dé el código.
          </p>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
// Vista: única responsable de la llamada real (POST /devices/identify) y de
// escribir en session.store — las moléculas de ui/ solo validan/renderizan y
// emiten eventos (ver reglas del barrel @/components).
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AppButton, DeviceIdentifyForm } from '@/components'
import { VOICE, deviceIdentifyError } from '@/config/voice'
import DevicesService from '@/services/devices.service'
import { useAuthStore } from '@/stores/auth.store'
import { useSessionStore } from '@/stores/session.store'
import type { DeviceIdentifyPayload } from '@/types/device.types'

const router = useRouter()
const sessionStore = useSessionStore()
const authStore = useAuthStore()

const deviceLoading = ref(false)
const deviceError = ref<string | null>(null)
const deviceErrorType = ref<'error' | 'warning'>('error')
const retrying = ref(false)

// Seguridad: la cuenta es de UNA persona y la sesión ya la fijó el guard del
// router (GET /auth/me). Aquí solo se decide qué mostrar.
const isBound = computed(() => authStore.bindingStatus === 'bound')
const isUnknown = computed(() => authStore.bindingStatus === 'unknown')

// Cuentas que no pueden seguir: persona desactivada, sin persona o sin confirmar.
const blocked = computed(() => {
  switch (authStore.bindingStatus) {
    case 'inactive': return VOICE.accountInactive
    case 'unassigned': return VOICE.accountUnassigned
    case 'unknown': return VOICE.accountUnconfirmed
    default: return null
  }
})

// Falta el dispositivo: la persona puede no tener el código, y necesita poder irse sin él.
const needsDevice = computed(() => !sessionStore.isDeviceIdentified)

const heading = computed(() => {
  if (!sessionStore.isDeviceIdentified) {
    // Cuenta sin dispositivo (p. ej. aceptó la invitación en otra computadora): se le
    // explica qué hacer; el texto del formulario ya lo dice, aquí no se repite.
    if (isBound.value) return { title: 'Falta registrar este dispositivo', subtitle: '' }
    return { title: 'Identifica este dispositivo', subtitle: 'Solo lo haces una vez por dispositivo.' }
  }
  // Cuenta lista con el dispositivo ya identificado: la vista solo redirige.
  return { title: 'Entrando…', subtitle: '' }
})

onMounted(() => {
  if (isBound.value && sessionStore.isDeviceIdentified) {
    // Ya es esa persona y el dispositivo ya está identificado: directo a la app.
    router.push({ name: 'AppHome' })
  }
})

async function handleDeviceSubmit(payload: DeviceIdentifyPayload) {
  deviceLoading.value = true
  deviceError.value = null
  try {
    const { deviceId, deviceToken } = await DevicesService.identify(payload)
    // Éxito: se guarda en localStorage (session.store) y ya no se vuelve a
    // pedir en este dispositivo. Se guarda el token (si el servidor lo
    // entregó), NO el identificador: era un código de un solo uso y ya quedó
    // quemado.
    sessionStore.setDevice({ deviceId, name: payload.name, deviceToken })
    router.push({ name: 'AppHome' })
  } catch (cause) {
    // 409 (identificador ya usado / dispositivo revocado) se explica aparte de
    // 403 (datos que no coinciden): son problemas distintos con salidas
    // distintas. El formulario queda editable para reintentar.
    const { message, type } = deviceIdentifyError(cause, isBound.value)
    deviceError.value = message
    deviceErrorType.value = type
  } finally {
    deviceLoading.value = false
  }
}

async function handleRetry() {
  retrying.value = true
  try {
    await authStore.refreshBindingForRecovery()
    if (sessionStore.isContextReady) await router.push({ name: 'AppHome' })
  } finally {
    retrying.value = false
  }
}

function handleSignOut() {
  authStore.logout()
  router.push({ name: 'Login' })
}
</script>

<style scoped>
.select-context { padding: var(--spacing-2xl) var(--spacing-md); }
.select-context__exit { margin-top: var(--spacing-xl); display: flex; flex-direction: column; gap: var(--spacing-sm); }
.select-context__exit-help { margin: 0; text-align: center; font-size: var(--font-size-sm); color: var(--color-text-muted); }
.select-context__inner { max-width: 40rem; margin: 0 auto; }
.select-context__title {
  font-size:   var(--font-size-xl);
  font-weight: 800;
  color:       var(--color-text);
  text-align:  center;
}
.select-context__subtitle {
  margin-top: var(--spacing-sm);
  margin-bottom: var(--spacing-lg);
  color:      var(--color-text-muted);
  text-align: center;
}
.select-context__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  justify-content: center;
}
</style>
