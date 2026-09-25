import api from './api'
import type { DeviceIdentifyPayload, DeviceIdentifyResponse } from '@/types/device.types'

const DevicesService = {
  /**
   * Traduce identifier+name (asignados fuera de banda a un dispositivo ya
   * autorizado) al deviceId interno. Responde 403 si no coinciden con
   * ningún dispositivo del negocio — no hay forma de registrar uno nuevo
   * desde el frontend ni desde la API (no existe POST /devices).
   */
  async identify(payload: DeviceIdentifyPayload): Promise<DeviceIdentifyResponse> {
    const { data } = await api.post<DeviceIdentifyResponse>('/devices/identify', payload)
    return data
  },
}

export default DevicesService
