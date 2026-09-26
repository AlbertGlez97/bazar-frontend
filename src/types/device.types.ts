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

// ── Gestión de dispositivos (solo socios): GET/POST /devices, revoke, reissue ──

export type DeviceStatus = 'pendiente_activacion' | 'activo' | 'revocado'

/** Un dispositivo del negocio, tal como lo lista GET /devices. Nunca trae token ni su hash. */
export interface ManagedDevice {
  id: string
  name: string
  status: DeviceStatus
  /**
   * `true` = activo pero SIN token: se identifica solo con `x-device-id` (todo
   * dispositivo anterior al flujo de un solo uso). Se pasa al acceso nuevo
   * reemitiéndolo.
   */
  legacy: boolean
  createdAt: string
  activatedAt: string | null
  revokedAt: string | null
  /** Código de activación de un solo uso: SOLO mientras el dispositivo está pendiente. */
  identifier?: string
}

export interface CreateDevicePayload {
  name: string
  /** Si se manda, el código llega por correo y NO se devuelve en la respuesta. */
  correoEnvio?: string
}

export interface ReissueDevicePayload {
  correoEnvio?: string
}

/** Adónde fue el correo con el código: `approver-fallback` = modo de prueba, NO a la persona. */
export type DeviceEmailDelivery = 'recipient' | 'approver-fallback'

/**
 * Respuesta de POST /devices y de reissue: el dispositivo con su código (sin
 * `correoEnvio`) o, con `correoEnvio`, sin código y con `deliveredTo`.
 */
export interface DeviceWithCode extends ManagedDevice {
  deliveredTo?: DeviceEmailDelivery
}

export interface DeviceIdentifyResponse {
  deviceId: string
  /**
   * Secreto del dispositivo, visible SOLO en esta respuesta de activación.
   * Ausente para un dispositivo heredado. Viaja como header `x-device-token`.
   */
  deviceToken?: string
}
