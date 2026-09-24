import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Member } from '@/types/member.types'

// El dispositivo es físico y fijo: una vez identificado en este navegador/
// tablet no cambia, así que persiste en localStorage (sobrevive recargas y
// cierres de la app).
const DEVICE_KEY = 'device_context'

// La persona que atiende SÍ debe reconfirmarse en cada apertura de la app,
// aunque el dispositivo sea el mismo (tablet compartida entre socios y
// colaboradores) — por eso vive en sessionStorage, no en localStorage: se
// pierde al cerrar la pestaña/navegador, pero sobrevive un recargo (F5)
// dentro de la misma sesión de uso.
const MEMBER_KEY = 'member_context'

interface StoredDevice {
  deviceId:   string
  identifier: string
  name:       string
}

function isStoredDevice(value: unknown): value is StoredDevice {
  const v = value as Partial<StoredDevice> | null
  return !!v && typeof v.deviceId === 'string' && typeof v.identifier === 'string'
    && typeof v.name === 'string'
}

function isMember(value: unknown): value is Member {
  const v = value as Partial<Member> | null
  return !!v && typeof v.id === 'string' && typeof v.name === 'string'
    && (v.role === 'socio' || v.role === 'colaborador')
}

function readDevice(): StoredDevice | null {
  try {
    const raw = localStorage.getItem(DEVICE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (isStoredDevice(parsed)) return parsed
  } catch {
    // Storage corrupto ⇒ se trata como "dispositivo aún no identificado".
  }
  localStorage.removeItem(DEVICE_KEY)
  return null
}

function readMember(): Member | null {
  try {
    const raw = sessionStorage.getItem(MEMBER_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (isMember(parsed)) return parsed
  } catch {
    // Storage corrupto ⇒ se trata como "persona aún no seleccionada".
  }
  sessionStorage.removeItem(MEMBER_KEY)
  return null
}

export const useSessionStore = defineStore('session', () => {
  const storedDevice = readDevice()
  const storedMember = readMember()

  const deviceId         = ref<string | null>(storedDevice?.deviceId ?? null)
  const deviceIdentifier = ref<string | null>(storedDevice?.identifier ?? null)
  const deviceName       = ref<string | null>(storedDevice?.name ?? null)

  const member   = ref<Member | null>(storedMember)
  const memberId = ref<string | null>(storedMember?.id ?? null)

  const isDeviceIdentified = computed(() => !!deviceId.value)
  const isMemberSelected   = computed(() => !!memberId.value)
  // El contexto está listo cuando ambos pasos (dispositivo + persona) se
  // completaron — es lo que exige el guard de rutas operativas (/app).
  const isContextReady = computed(() => isDeviceIdentified.value && isMemberSelected.value)

  function setDevice(payload: StoredDevice) {
    deviceId.value         = payload.deviceId
    deviceIdentifier.value = payload.identifier
    deviceName.value       = payload.name
    localStorage.setItem(DEVICE_KEY, JSON.stringify(payload))
  }

  function setMember(payload: Member) {
    member.value   = payload
    memberId.value = payload.id
    sessionStorage.setItem(MEMBER_KEY, JSON.stringify(payload))
  }

  function clearMember() {
    member.value   = null
    memberId.value = null
    sessionStorage.removeItem(MEMBER_KEY)
  }

  function clearDevice() {
    deviceId.value         = null
    deviceIdentifier.value = null
    deviceName.value       = null
    localStorage.removeItem(DEVICE_KEY)
  }

  /**
   * Se llama desde auth.store.logout(). Decisión de diseño: solo limpia la
   * persona seleccionada, NO el dispositivo. El dispositivo es una propiedad
   * física de la tablet (independiente de qué cuenta/persona esté usándola),
   * mientras que "quién vende" debe reconfirmarse cada vez que alguien nuevo
   * inicia sesión, por seguridad operativa.
   */
  function clearOnLogout() {
    clearMember()
  }

  return {
    deviceId, deviceIdentifier, deviceName,
    member, memberId,
    isDeviceIdentified, isMemberSelected, isContextReady,
    setDevice, setMember, clearMember, clearDevice, clearOnLogout,
  }
})
