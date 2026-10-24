import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Member } from '@/types/member.types'
import { API_BASE_URL, currentSessionOwner, sameOwner } from '@/services/session-owner'
import type { SessionOwner } from '@/services/session-owner'

// El dispositivo es físico y fijo: una vez identificado en este navegador/
// tablet no cambia, así que persiste en localStorage (sobrevive recargas y
// cierres de la app).
const DEVICE_KEY = 'device_context'

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

// Un dispositivo POR CUENTA. Una cuenta personal y la cuenta compartida conviven en el mismo
// navegador sin que una borre el dispositivo de la otra. La clave es "<cuenta>|<API>".
const DEVICES_KEY = 'device_contexts'
const DEVICES_VERSION = 1
type DeviceMap = Record<string, StoredDevice>
const deviceSlot = (owner: SessionOwner) => `${owner.accountId}|${owner.apiBase}`

/** Lee el mapa de dispositivos; lo dañado se ignora entrada por entrada, sin romper nada. */
function readDeviceMap(): DeviceMap {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(DEVICES_KEY) ?? 'null')
    const devices = (parsed as { version?: unknown; devices?: unknown } | null)
    if (!devices || devices.version !== DEVICES_VERSION || !devices.devices || typeof devices.devices !== 'object' || Array.isArray(devices.devices)) return {}
    const map: DeviceMap = {}
    for (const [slot, value] of Object.entries(devices.devices as Record<string, unknown>)) {
      const device = normalizeStoredDevice(value)
      if (device) map[slot] = device
    }
    return map
  } catch {
    // Storage corrupto ⇒ se trata como "sin dispositivos".
    return {}
  }
}

function writeDeviceMap(map: DeviceMap) {
  if (Object.keys(map).length === 0) localStorage.removeItem(DEVICES_KEY)
  else localStorage.setItem(DEVICES_KEY, JSON.stringify({ version: DEVICES_VERSION, devices: map }))
}

/**
 * Pasa el dispositivo guardado con la clave anterior (un solo dispositivo, con su dueño) al mapa
 * por cuenta, a nombre de su dueño: no se pierde ni se reasigna. Sin dueño conocido no se puede
 * atribuir, y se descarta como antes.
 */
function migrateSingleDevice(): 'none' | 'migrated' | 'legacy' {
  const raw = localStorage.getItem(DEVICE_KEY)
  if (raw === null) return 'none'
  const ownerRaw = storedOwnerOf(localStorage, DEVICE_KEY)
  const drop = () => { localStorage.removeItem(DEVICE_KEY); localStorage.removeItem(DEVICE_KEY + '_owner') }
  let device: StoredDevice | null = null
  try { device = normalizeStoredDevice(JSON.parse(raw)) } catch { device = null }
  if (!ownerRaw) { drop(); return 'legacy' }
  if (!device) { drop(); return 'none' }
  const map = readDeviceMap()
  const slot = deviceSlot(ownerRaw)
  if (!map[slot]) { map[slot] = device; writeDeviceMap(map) }
  drop()
  return 'migrated'
}

function storedOwnerOf(storage: Storage, key: string): SessionOwner | null {
  try {
    const owner = JSON.parse(storage.getItem(key + '_owner') ?? 'null') as Partial<SessionOwner> | null
    return owner && typeof owner.accountId === 'string' && typeof owner.apiBase === 'string' && owner.accountId
      ? { accountId: owner.accountId, apiBase: owner.apiBase }
      : null
  } catch { return null }
}

export const useSessionStore = defineStore('session', () => {

  const deviceId    = ref<string | null>(null)
  const deviceName  = ref<string | null>(null)
  // Secreto: solo lo lee el interceptor de Axios para la cabecera
  // x-device-token; no se muestra en la UI ni se escribe en logs.
  const deviceToken = ref<string | null>(null)

  // La persona de la cuenta (una cuenta = una persona). Solo vive en memoria y
  // la fija auth.store con lo que responde GET /auth/me: nadie la elige.
  const member   = ref<Member | null>(null)
  const memberId = ref<string | null>(null)

  const isDeviceIdentified = computed(() => !!deviceId.value)
  const hasPerson          = computed(() => !!memberId.value)
  // El contexto está listo cuando el dispositivo está identificado y la cuenta
  // ya tiene su persona: es lo que exige el guard de rutas operativas (/app).
  const isContextReady = computed(() => isDeviceIdentified.value && hasPerson.value)

  const owner = ref<SessionOwner | null>(null)
  const recoveryReason = ref<'legacy' | 'rejected' | null>(null)
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
    if (migrateSingleDevice() === 'legacy') recoveryReason.value = 'legacy'
    // El dispositivo de ESTA cuenta; los de otras cuentas se quedan guardados, intactos.
    const device = readDeviceMap()[deviceSlot(current)]
    deviceId.value = device?.deviceId ?? null
    deviceName.value = device?.name ?? null
    deviceToken.value = device?.deviceToken ?? null
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
    // Se guarda a nombre de la cuenta con sesión abierta; sin sesión no hay a nombre de quién.
    if (owner.value) writeDeviceMap({ ...readDeviceMap(), [deviceSlot(owner.value)]: device })
  }

  /**
   * Guarda un dispositivo a nombre de OTRA cuenta (la que acaba de crear una invitación) sin tocar
   * la sesión actual: cuando esa cuenta entre, lo encuentra y no se le pide identificarlo.
   */
  function saveDeviceForAccount(accountId: string, payload: StoredDevice) {
    const device = normalizeStoredDevice(payload)
    if (!accountId || !device || !device.deviceId) return
    writeDeviceMap({ ...readDeviceMap(), [deviceSlot({ accountId, apiBase: API_BASE_URL })]: device })
  }

  /** Fija la persona de la cuenta (la dicta el servidor); no se guarda en el navegador. */
  function setMember(payload: Member) {
    reconcileOwnership()
    member.value   = payload
    memberId.value = payload.id
  }

  function clearMember() {
    member.value   = null
    memberId.value = null
  }

  function clearDevice() {
    deviceId.value    = null
    deviceName.value  = null
    deviceToken.value = null
    // Solo el dispositivo de la cuenta actual: los de las demás cuentas no se tocan.
    if (!owner.value) return
    const map = readDeviceMap()
    delete map[deviceSlot(owner.value)]
    writeDeviceMap(map)
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
    isDeviceIdentified, hasPerson, isContextReady,
    setDevice, saveDeviceForAccount, setMember, clearMember, clearDevice, clearOnLogout,
  }
})
