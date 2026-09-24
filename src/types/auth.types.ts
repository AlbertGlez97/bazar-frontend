// Legacy login contract, retained until bazar API integration.
export interface User {
  id: string
  email: string
  name: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface AuthResponse {
  accessToken: string
  usuario: User
}
