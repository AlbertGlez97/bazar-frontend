<template>
  <section
    class="select-context"
    aria-label="Selección de dispositivo y persona"
  >
    <div class="select-context__inner container">
      <h1 class="select-context__title">
        {{ sessionStore.isDeviceIdentified ? '¿Quién atiende?' : 'Identifica este dispositivo' }}
      </h1>
      <p class="select-context__subtitle">
        {{ sessionStore.isDeviceIdentified
          ? 'Selecciona tu nombre para continuar.'
          : 'Este paso ocurre una sola vez por dispositivo.' }}
      </p>

      <!-- Paso 1: identificar el dispositivo (solo si aún no está guardado
           en localStorage — el dispositivo es físico/fijo, no se repite en
           cada apertura de la app). -->
      <DeviceIdentifyForm
        v-if="!sessionStore.isDeviceIdentified"
        :loading="deviceLoading"
        :error="deviceError"
        @submit="handleDeviceSubmit"
      />

      <!-- Paso 2: elegir quién atiende (se repite en cada sesión, aunque el
           dispositivo ya esté identificado — tablet compartida). -->
      <template v-else>
        <p
          v-if="membersLoading"
          class="select-context__loading"
        >
          Cargando personas…
        </p>
        <MemberSelector
          v-else
          :members="members"
          :loading="selectingMember"
          @select="handleMemberSelect"
        />
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
// Vista: única responsable de las llamadas reales (POST /devices/identify,
// GET /members) y de escribir en session.store — las moléculas de ui/ solo
// validan/renderizan y emiten eventos (ver reglas del barrel @/components).
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { DeviceIdentifyForm, MemberSelector } from '@/components'
import DevicesService from '@/services/devices.service'
import MembersService from '@/services/members.service'
import { useSessionStore } from '@/stores/session.store'
import { useToastStore } from '@/stores/toast.store'
import type { DeviceIdentifyPayload } from '@/types/device.types'
import type { Member } from '@/types/member.types'

const router = useRouter()
const toast = useToastStore()
const sessionStore = useSessionStore()

const deviceLoading = ref(false)
const deviceError = ref<string | null>(null)

const members = ref<Member[]>([])
const membersLoading = ref(false)
const selectingMember = ref(false)

onMounted(() => {
  if (sessionStore.isDeviceIdentified) {
    loadMembers()
  }
})

async function handleDeviceSubmit(payload: DeviceIdentifyPayload) {
  deviceLoading.value = true
  deviceError.value = null
  try {
    const { deviceId } = await DevicesService.identify(payload)
    // Éxito: se guarda en localStorage (session.store) y ya no se vuelve a
    // pedir en este dispositivo — continúa automáticamente al selector.
    sessionStore.setDevice({ deviceId, identifier: payload.identifier, name: payload.name })
    await loadMembers()
  } catch (cause) {
    const status = (cause as { response?: { status?: number } } | null)?.response?.status
    deviceError.value = status === 403
      ? 'Este dispositivo no está autorizado. Contacta a soporte.'
      : 'No se pudo verificar el dispositivo, intenta de nuevo'
  } finally {
    deviceLoading.value = false
  }
}

async function loadMembers() {
  membersLoading.value = true
  try {
    members.value = await MembersService.list()
  } catch {
    toast.error('No se pudo cargar la lista de personas, intenta de nuevo')
  } finally {
    membersLoading.value = false
  }
}

function handleMemberSelect(member: Member) {
  selectingMember.value = true
  // "Quién atiende" vive en sessionStorage (no localStorage): debe
  // reconfirmarse en cada apertura de la app, a diferencia del dispositivo.
  sessionStore.setMember(member)
  router.push({ name: 'AppHome' })
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
</style>
