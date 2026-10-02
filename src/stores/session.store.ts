import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Member } from '@/types/member.types'
import { isMember } from '@/utils/member'
import { currentSessionOwner, sameOwner } from '@/services/session-owner'
import type { SessionOwner } from '@/services/session-owner'

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

  const deviceId    = ref<string | null>(null)
  const deviceName  = ref<string | null>(null)
  // Secreto: solo lo lee el interceptor de Axios para la cabecera
  // x-device-token; no se muestra en la UI ni se escribe en logs.
  const deviceToken = ref<string | null>(null)

  const member   = ref<Member | null>(null)
  const memberId = ref<string | null>(null)

  const isDeviceIdentified = computed(() => !!deviceId.value)
  const isMemberSelected   = computed(() => !!memberId.value)
  // El contexto está listo cuando ambos pasos (dispositivo + persona) se
  // completaron — es lo que exige el guard de rutas operativas (/app).
  const isContextReady = computed(() => isDeviceIdentified.value && isMemberSelected.value)

  const owner = ref<SessionOwner | null>(null)
  const recoveryReason = ref<'changed' | 'legacy' | 'rejected' | null>(null)
  function storedOwner(storage: Storage, key: string): unknown {
    try { return JSON.parse(storage.getItem(key + '_owner') ?? 'null') } catch { return null }
  }
  function hideDevice() {
    deviceId.value = null
    deviceName.value = null
    deviceToken.value = null
  }
  function reconcileOwnership() {
    const current = currentSessionOwner()
    if (sameOwner(owner.value, current)) return
    owner.value = current
    hideDevice()
    member.value = null
    memberId.value = null
    if (!current) return
    const deviceOwner = storedOwner(localStorage, DEVICE_KEY)
    const memberOwner = storedOwner(sessionStorage, MEMBER_KEY)
    if (sameOwner(deviceOwner, current)) {
      const device = readDevice()
      deviceId.value = device?.deviceId ?? null
      deviceName.value = device?.name ?? null
      deviceToken.value = device?.deviceToken ?? null
    } else if (localStorage.getItem(DEVICE_KEY)) {
      recoveryReason.value = deviceOwner ? 'changed' : 'legacy'
      clearDevice()
    }
    if (sameOwner(memberOwner, current)) {
      const selected = readMember()
      member.value = selected
      memberId.value = selected?.id ?? null
    } else if (sessionStorage.getItem(MEMBER_KEY)) {
      recoveryReason.value = memberOwner ? 'changed' : 'legacy'
      clearMember()
    }
  }
  reconcileOwnership()

  function setDevice(payload: StoredDevice) {
    reconcileOwnership()
    // Se guarda siempre la forma normalizada (sin claves de más): sin token
    // para los dispositivos heredados, y nunca el identificador original.
    const device: StoredDevice = payload.deviceToken
      ? { deviceId: payload.deviceId, name: payload.name, deviceToken: payload.deviceToken }
      : { deviceId: payload.deviceId, name: payload.name }
    recoveryReason.value = null
    deviceId.value    = device.deviceId
    deviceName.value  = device.name
    deviceToken.value = device.deviceToken ?? null
    if (owner.value) localStorage.setItem(DEVICE_KEY + '_owner', JSON.stringify(owner.value))
    localStorage.setItem(DEVICE_KEY, JSON.stringify(device))
  }

  function setMember(payload: Member) {
    reconcileOwnership()
    member.value   = payload
    memberId.value = payload.id
    sessionStorage.setItem(MEMBER_KEY, JSON.stringify(payload))
    if (owner.value) sessionStorage.setItem(MEMBER_KEY + '_owner', JSON.stringify(owner.value))
  }

  function clearMember() {
    member.value   = null
    memberId.value = null
    sessionStorage.removeItem(MEMBER_KEY)
    sessionStorage.removeItem(MEMBER_KEY + '_owner')
  }

  function clearDevice() {
    deviceId.value    = null
    deviceName.value  = null
    deviceToken.value = null
    localStorage.removeItem(DEVICE_KEY)
    localStorage.removeItem(DEVICE_KEY + '_owner')
  }

  /** Retain owned device storage, but expose no selection after logout. */
  function clearOnLogout() {
    clearMember()
    owner.value = null
    hideDevice()
  }

  return {
    deviceId, deviceName, deviceToken, owner, recoveryReason, reconcileOwnership,
    member, memberId,
    isDeviceIdentified, isMemberSelected, isContextReady,
    setDevice, setMember, clearMember, clearDevice, clearOnLogout,
  }
})
