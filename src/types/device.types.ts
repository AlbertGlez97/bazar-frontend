// Contrato real de bazar-api para POST /devices/identify.
// No existe endpoint para listar ni crear dispositivos: se aprovisionan
// fuera de banda (seed, ver doc/api-contract-for-frontend.md §4). Este
// endpoint solo traduce un identifier+name ya autorizados a su deviceId
// interno, que de ahí en adelante viaja como header x-device-id.
export interface DeviceIdentifyPayload {
  /** Identificador estable asignado fuera de banda, NO el id interno */
  identifier: string
  /** Debe coincidir exactamente (mayúsculas/espacios incluidos) con el nombre registrado */
  name: string
}

export interface DeviceIdentifyResponse {
  deviceId: string
}
