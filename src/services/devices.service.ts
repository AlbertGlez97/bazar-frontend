import api from './api'
import type { DeviceIdentifyPayload, DeviceIdentifyResponse } from '@/types/device.types'

const DevicesService = {
  /**
   * Activa el dispositivo con su identificador de un solo uso + nombre exacto.
   * Éxito: `{ deviceId, deviceToken }` (el token se ve solo aquí) o, para un
   * dispositivo heredado, `{ deviceId }`. Errores que la vista distingue por
   * estado HTTP: 403 = no coincide con ningún dispositivo del negocio;
   * 409 = el identificador ya fue usado (o el dispositivo fue revocado).
   */
  async identify(payload: DeviceIdentifyPayload): Promise<DeviceIdentifyResponse> {
    const { data } = await api.post<DeviceIdentifyResponse>('/devices/identify', payload)
    return data
  },
}

export default DevicesService
