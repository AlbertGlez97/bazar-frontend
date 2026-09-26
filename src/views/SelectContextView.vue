<template>
  <section
    class="select-context"
    aria-label="Selección de dispositivo y persona"
  >
    <div class="select-context__inner container">
      <!-- Cuenta ligada a una persona que ya no puede entrar (miembro
           desactivado): se explica y no hay nada más que hacer aquí — ni
           dispositivo, ni selector. -->
      <template v-if="isInactive">
        <h1 class="select-context__title">
          {{ VOICE.accountInactive.title }}
        </h1>
        <p class="select-context__subtitle">
          {{ VOICE.accountInactive.body }}
        </p>
        <div class="select-context__actions">
          <AppButton
            variant="secondary"
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
        <p class="select-context__subtitle">
          {{ heading.subtitle }}
        </p>

        <!-- Paso 1: identificar el dispositivo (solo si aún no está guardado
             en localStorage — el dispositivo es físico/fijo, no se repite en
             cada apertura de la app). -->
        <DeviceIdentifyForm
          v-if="!sessionStore.isDeviceIdentified"
          :loading="deviceLoading"
          :error="deviceError"
          :error-type="deviceErrorType"
          @submit="handleDeviceSubmit"
        />

        <!-- Paso 2: elegir quién atiende (se repite en cada sesión, aunque el
             dispositivo ya esté identificado — tablet compartida). SOLO para el
             login compartido: una cuenta ligada a un miembro no elige a nadie,
             ya es esa persona (el servidor rechaza a cualquier otra). -->
        <template v-else-if="showSelector">
          <p
            v-if="membersLoading"
            class="select-context__loading"
          >
            Cargando a tu equipo…
          </p>
          <MemberSelector
            v-else
            :members="members"
            :loading="selectingMember"
            :locked-member-id="null"
            @select="handleMemberSelect"
          />
        </template>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
// Vista: única responsable de las llamadas reales (POST /devices/identify,
// GET /members) y de escribir en session.store — las moléculas de ui/ solo
// validan/renderizan y emiten eventos (ver reglas del barrel @/components).
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AppButton, DeviceIdentifyForm, MemberSelector } from '@/components'
import { VOICE, deviceIdentifyError } from '@/config/voice'
import DevicesService from '@/services/devices.service'
import MembersService from '@/services/members.service'
import { useAuthStore } from '@/stores/auth.store'
import { useSessionStore } from '@/stores/session.store'
import { useToastStore } from '@/stores/toast.store'
import type { DeviceIdentifyPayload } from '@/types/device.types'
import type { Member } from '@/types/member.types'

const router = useRouter()
const toast = useToastStore()
const sessionStore = useSessionStore()
const authStore = useAuthStore()

const deviceLoading = ref(false)
const deviceError = ref<string | null>(null)
const deviceErrorType = ref<'error' | 'warning'>('error')

const members = ref<Member[]>([])
const membersLoading = ref(false)
const selectingMember = ref(false)

// Seguridad: una cuenta ligada a un miembro (creada con POST /members) es SIEMPRE
// esa persona; la sesión ya la fijó el guard (GET /auth/me). Aquí solo se decide
// qué mostrar: nunca el selector para ella.
const isBound = computed(() => authStore.bindingStatus === 'bound')
const isInactive = computed(() => authStore.bindingStatus === 'inactive')
// El selector existe solo para el login compartido (o cuando no se pudo saber:
// se conserva el flujo de siempre y el servidor igual hace cumplir el vínculo).
const showSelector = computed(
  () => sessionStore.isDeviceIdentified && !isBound.value && !isInactive.value,
)

const heading = computed(() => {
  if (showSelector.value) return { title: '¿Quién atiende hoy?', subtitle: 'Toca tu nombre para seguir.' }
  if (!sessionStore.isDeviceIdentified) {
    return { title: 'Identifica este dispositivo', subtitle: 'Solo lo haces una vez por dispositivo.' }
  }
  // Cuenta ligada con el dispositivo ya identificado: la vista solo redirige.
  return { title: 'Entrando…', subtitle: '' }
})

onMounted(() => {
  if (isBound.value && sessionStore.isDeviceIdentified) {
    // Ya es esa persona y el dispositivo ya está identificado: directo a la app.
    router.push({ name: 'AppHome' })
    return
  }
  if (showSelector.value) {
    loadMembers()
  }
})

async function handleDeviceSubmit(payload: DeviceIdentifyPayload) {
  deviceLoading.value = true
  deviceError.value = null
  try {
    const { deviceId, deviceToken } = await DevicesService.identify(payload)
    // Éxito: se guarda en localStorage (session.store) y ya no se vuelve a
    // pedir en este dispositivo — continúa automáticamente al selector.
    // Se guarda el token (si el servidor lo entregó), NO el identificador: era
    // un código de un solo uso y ya quedó quemado.
    sessionStore.setDevice({ deviceId, name: payload.name, deviceToken })
    if (isBound.value) {
      // Cuenta ligada: no hay a quién elegir, la persona ya está en la sesión.
      router.push({ name: 'AppHome' })
      return
    }
    await loadMembers()
  } catch (cause) {
    // 409 (identificador ya usado / dispositivo revocado) se explica aparte de
    // 403 (datos que no coinciden): son problemas distintos con salidas
    // distintas. El formulario queda editable para reintentar.
    const { message, type } = deviceIdentifyError(cause)
    deviceError.value = message
    deviceErrorType.value = type
  } finally {
    deviceLoading.value = false
  }
}

async function loadMembers() {
  membersLoading.value = true
  try {
    members.value = await MembersService.list()
  } catch {
    toast.error('No pudimos cargar la lista de personas. Intenta de nuevo.')
  } finally {
    membersLoading.value = false
  }
}

function handleMemberSelect(member: Member) {
  // Defensa en profundidad: una cuenta ligada a un miembro no elige a nadie.
  if (isBound.value || isInactive.value) return
  selectingMember.value = true
  // "Quién atiende" vive en sessionStorage (no localStorage): debe
  // reconfirmarse en cada apertura de la app, a diferencia del dispositivo.
  sessionStore.setMember(member)
  router.push({ name: 'AppHome' })
}

function handleSignOut() {
  authStore.logout()
  router.push({ name: 'Login' })
}
</script>

<style scoped>
.select-context { padding: var(--spacing-2xl) var(--spacing-md); }
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
.select-context__loading {
  color: var(--color-text-muted);
  text-align: center;
}
.select-context__actions {
  display: flex;
  justify-content: center;
}
</style>
