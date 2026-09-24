// Servicio de autenticación: login, registro, recuperación y perfil
import api from './api'
import type {
  AuthResponse, LoginPayload, RegisterPayload, User,
  RecoveryInitResponse, RecoveryCompletePayload,
} from '@/types/auth.types'

const AuthService = {
  // Inicia sesión y devuelve el token + datos básicos del usuario
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/login', payload)
    return data
  },

  // Crea una cuenta nueva
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/register', payload)
    return data
  },

  // ── Recuperación con Recovery Phrase (BIP39) ─────────────────────────────

  /**
   * Paso 1: inicia el flujo de recuperación. Backend SIEMPRE responde 200 —
   * si el email existe, devuelve el material real; si no, material plausible
   * derivado determinísticamente (anti-enumeración). El cliente descubre si
   * el email existe recién al intentar desenvolver la DEK con la frase.
   */
  async initRecovery(email: string): Promise<RecoveryInitResponse> {
    const { data } = await api.post<RecoveryInitResponse>('/auth/recovery/init', { email })
    return data
  },

  /**
   * Paso 2: envía el nuevo material de contraseña. Si el email existe y el
   * material es válido, el backend actualiza el hash bcrypt + wrappedDekPassword
   * y emite un JWT fresco (auto-login).
   */
  async completeRecovery(payload: RecoveryCompletePayload): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/recovery/complete', payload)
    return data
  },

  // Obtiene el perfil completo del usuario autenticado
  async getMe(): Promise<User> {
    const { data } = await api.get<User>('/users/me')
    return data
  },

  // Actualiza la regla de presupuesto personalizada (necesidades/deseos/ahorros)
  async updateBudgetRule(needs: number, wants: number, savings: number): Promise<User> {
    const { data } = await api.patch<User>('/users/me/budget-rule', {
      ruleNeeds: needs,
      ruleWants: wants,
      ruleSavings: savings,
    })
    return data
  },
}

export default AuthService
