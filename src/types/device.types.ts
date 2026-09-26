// Contrato real de bazar-api para POST /devices/identify.
// Un socio registra el dispositivo (POST /devices) y obtiene un identificador
// de UN SOLO USO; la persona que va a usar el equipo lo escribe junto con el
// nombre exacto. Al activarse, el servidor responde con el `deviceToken` (solo
// esa vez) y el identificador queda quemado. Los dispositivos anteriores a ese
// flujo (heredados) siguen identificándose solo con `deviceId`.
export interface DeviceIdentifyPayload {
  /** Código de activación de un solo uso, NO el id interno */
  identifier: string
  /** Debe coincidir exactamente (mayúsculas/espacios incluidos) con el nombre registrado */
  name: string
}

export interface DeviceIdentifyResponse {
  deviceId: string
  /**
   * Secreto del dispositivo, visible SOLO en esta respuesta de activación.
   * Ausente para un dispositivo heredado. Viaja como header `x-device-token`.
   */
  deviceToken?: string
}
