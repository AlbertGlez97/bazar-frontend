import api from './api'
import type { AuthResponse, LoginPayload } from '@/types/auth.types'

const AuthService = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/login', payload)
    return data
  },
}

export default AuthService
