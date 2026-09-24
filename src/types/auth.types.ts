// Contrato real de bazar-api para autenticación.
// El backend NO devuelve un objeto de usuario/perfil — solo el JWT y su
// vigencia. Cualquier dato de "quién soy" (nombre, rol, etc.) se resolverá
// en una vista posterior (selector de member/device), fuera de este alcance.
export interface LoginPayload {
  username: string
  password: string
}

export interface AuthResponse {
  accessToken: string
  tokenType:   string
  /** Segundos de vigencia del token a partir del momento de la respuesta */
  expiresIn:   number
}
