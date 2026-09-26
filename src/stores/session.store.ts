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

// `deviceToken` solo existe en dispositivos activados con el flujo de un solo
// uso; los dispositivos heredados (anteriores a BE-12) se identifican solo con
// `deviceId`. El identificador original NO se guarda: era el código de
// activación y deja de servir una vez usado.
interface StoredDevice {
  deviceId:     string
  name:         string
  deviceToken?: string
}

/**
 * Devuelve la forma actual del dispositivo guardado, o `null` si el valor está
 * corrupto. Acepta el valor heredado `{ deviceId, identifier, name }` (guardado
 * antes de que existiera el token): lo migra soltando el `identifier` en vez
 * de descartarlo, así nadie tiene que volver a identificar su tablet.
 */
function normalizeStoredDevice(value: unknown): StoredDevice | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const v = value as Record<string, unknown>
  if (typeof v.deviceId !== 'string' || typeof v.name !== 'string') return null
  if (v.deviceToken === undefined) return { deviceId: v.deviceId, name: v.name }
  if (typeof v.deviceToken !== 'string' || v.deviceToken === '') return null
  return { deviceId: v.deviceId, name: v.name, deviceToken: v.deviceToken }
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
    const device = normalizeStoredDevice(parsed)
    if (device) {
      // Valor heredado (con `identifier`) o con claves de más: se reescribe ya
      // normalizado para que el identificador no siga guardado en el equipo.
      if (Object.keys(parsed as object).length !== Object.keys(device).length) {
        localStorage.setItem(DEVICE_KEY, JSON.stringify(device))
      }
      return device
    }
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

  const deviceId    = ref<string | null>(storedDevice?.deviceId ?? null)
  const deviceName  = ref<string | null>(storedDevice?.name ?? null)
  // Secreto: solo lo lee el interceptor de Axios para la cabecera
  // x-device-token; no se muestra en la UI ni se escribe en logs.
  const deviceToken = ref<string | null>(storedDevice?.deviceToken ?? null)

  const member   = ref<Member | null>(storedMember)
  const memberId = ref<string | null>(storedMember?.id ?? null)

  const isDeviceIdentified = computed(() => !!deviceId.value)
  const isMemberSelected   = computed(() => !!memberId.value)
  // El contexto está listo cuando ambos pasos (dispositivo + persona) se
  // completaron — es lo que exige el guard de rutas operativas (/app).
  const isContextReady = computed(() => isDeviceIdentified.value && isMemberSelected.value)

  function setDevice(payload: StoredDevice) {
    // Se guarda siempre la forma normalizada (sin claves de más): sin token
    // para los dispositivos heredados, y nunca el identificador original.
    const device: StoredDevice = payload.deviceToken
      ? { deviceId: payload.deviceId, name: payload.name, deviceToken: payload.deviceToken }
      : { deviceId: payload.deviceId, name: payload.name }
    deviceId.value    = device.deviceId
    deviceName.value  = device.name
    deviceToken.value = device.deviceToken ?? null
    localStorage.setItem(DEVICE_KEY, JSON.stringify(device))
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
    deviceId.value    = null
    deviceName.value  = null
    deviceToken.value = null
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
    deviceId, deviceName, deviceToken,
    member, memberId,
    isDeviceIdentified, isMemberSelected, isContextReady,
    setDevice, setMember, clearMember, clearDevice, clearOnLogout,
  }
})
