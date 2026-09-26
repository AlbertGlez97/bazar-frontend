// Contrato real de bazar-api para autenticación.
// El backend NO devuelve un objeto de usuario/perfil — solo el JWT y su
// vigencia. Cualquier dato de "quién soy" (nombre, rol, etc.) se resolverá
// en una vista posterior (selector de member/device), fuera de este alcance.
export interface LoginPayload {
  username: string
  password: string
}

// Contrato real de POST /auth/change-password (cualquier persona autenticada):
// 204 sin cuerpo. Contraseña actual incorrecta = 403 (a propósito NO 401, para
// que el interceptor no lo confunda con un token vencido y cierre la sesión).
export interface ChangePasswordPayload {
  currentPassword: string
  /** 10 a 128 caracteres y distinta de la actual */
  newPassword: string
}

export interface AuthResponse {
  accessToken: string
  tokenType:   string
  /** Segundos de vigencia del token a partir del momento de la respuesta */
  expiresIn:   number
}
