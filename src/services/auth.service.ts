import api from './api'
import type { AccountBinding, AuthResponse, ChangePasswordPayload, LoginPayload } from '@/types/auth.types'

const AuthService = {
  /**
   * Quién es la cuenta de la sesión y a qué miembro está ligada (solo JWT, sin
   * x-member-id ni x-device-id). Los errores se propagan tal cual para que quien
   * llama distinga 401 (sesión vencida), sin respuesta / 5xx (sin conexión) y
   * los demás.
   */
  async me(): Promise<AccountBinding> {
    const { data } = await api.get<AccountBinding>('/auth/me')
    return data
  },

  async login(payload: LoginPayload): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/login', payload)
    return data
  },

  /**
   * Cambia la contraseña de quien tiene la sesión abierta (204, sin cuerpo).
   * Errores que la vista distingue por estado HTTP: 403 = la contraseña actual
   * no es correcta; 400 = la nueva no cumple las reglas.
   */
  async changePassword(payload: ChangePasswordPayload): Promise<void> {
    await api.post('/auth/change-password', payload)
  },
}

export default AuthService
