import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Member } from '@/types/member.types'
import { isMember } from '@/utils/member'
import { API_BASE_URL, currentSessionOwner, sameOwner } from '@/services/session-owner'
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
    if (migrateSingleDevice() === 'legacy') recoveryReason.value = 'legacy'
    // El dispositivo de ESTA cuenta; los de otras cuentas se quedan guardados, intactos.
    const device = readDeviceMap()[deviceSlot(current)]
    deviceId.value = device?.deviceId ?? null
    deviceName.value = device?.name ?? null
    deviceToken.value = device?.deviceToken ?? null
    const memberOwner = storedOwner(sessionStorage, MEMBER_KEY)
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
    isDeviceIdentified, isMemberSelected, isContextReady,
    setDevice, saveDeviceForAccount, setMember, clearMember, clearDevice, clearOnLogout,
  }
})
