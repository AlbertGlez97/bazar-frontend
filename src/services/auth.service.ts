import api from './api'
import type { AuthResponse, ChangePasswordPayload, LoginPayload } from '@/types/auth.types'

const AuthService = {
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
