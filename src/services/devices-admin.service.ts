import api from './api'
import type {
  CreateDevicePayload,
  DeviceWithCode,
  ManagedDevice,
  ReissueDevicePayload,
} from '@/types/device.types'

// Gestión de dispositivos (solo socios). La activación (POST /devices/identify)
// vive aparte en devices.service.ts: la hace la persona que recibe el equipo, no un socio.
const DevicesAdminService = {
  /** Dispositivos del negocio con su estado; el código solo aparece mientras está pendiente. */
  async list(): Promise<ManagedDevice[]> {
    const { data } = await api.get<ManagedDevice[]>('/devices')
    return data
  },

  /**
   * Registra un dispositivo (queda pendiente de activar) con un código de un solo
   * uso. Sin `correoEnvio` la respuesta trae el código; con él, va por correo y la
   * respuesta dice adónde llegó. 502 = el correo no salió y no se creó nada.
   */
  async create(payload: CreateDevicePayload): Promise<DeviceWithCode> {
    const { data } = await api.post<DeviceWithCode>('/devices', payload)
    return data
  },

  /** Revoca: deja de operar en su siguiente petición. Idempotente. 404 si ya no existe. */
  async revoke(id: string): Promise<ManagedDevice> {
    const { data } = await api.patch<ManagedDevice>(`/devices/${id}/revoke`)
    return data
  },

  /**
   * Reemite: vuelve a pendiente con un código NUEVO; el acceso anterior deja de
   * servir al instante. El cuerpo siempre es un objeto (el servidor lo espera así).
   */
  async reissue(id: string, payload: ReissueDevicePayload = {}): Promise<DeviceWithCode> {
    const { data } = await api.patch<DeviceWithCode>(`/devices/${id}/reissue`, payload)
    return data
  },
}

export default DevicesAdminService
