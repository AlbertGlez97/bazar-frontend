import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import AuthService from '@/services/auth.service'
import type { LoginPayload, User } from '@/types/auth.types'

function isUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false
  const user = value as Partial<User>
  return typeof user.id === 'string' && user.id.length > 0
    && typeof user.name === 'string' && typeof user.email === 'string'
}

function clearStorage() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('user')
}

function restoreSession(): { token: string; user: User } | null {
  try {
    const token = localStorage.getItem('access_token')
    const user: unknown = JSON.parse(localStorage.getItem('user') ?? 'null')
    if (token?.trim() && isUser(user)) return { token, user }
  } catch {
    // Invalid JSON is a logged-out session, not an application startup error.
  }
  clearStorage()
  return null
}

export const useAuthStore = defineStore('auth', () => {
  const session = restoreSession()
  const token = ref<string | null>(session?.token ?? null)
  const user = ref<User | null>(session?.user ?? null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  // Local credentials do not imply server-side JWT validation.
  const isAuthenticated = computed(() => !!token.value && !!user.value)

  async function login(payload: LoginPayload) {
    loading.value = true
    error.value = null
    try {
      const data = await AuthService.login(payload)
      if (!data.accessToken?.trim() || !isUser(data.usuario)) {
        throw new Error('Invalid login response')
      }
      localStorage.setItem('access_token', data.accessToken)
      localStorage.setItem('user', JSON.stringify(data.usuario))
      token.value = data.accessToken
      user.value = data.usuario
    } catch (cause) {
      logout()
      const message = (cause as { response?: { data?: { message?: unknown } } } | null)
        ?.response?.data?.message
      error.value = typeof message === 'string' ? message : 'Error desconocido'
      throw cause
    } finally {
      loading.value = false
    }
  }

  function logout() {
    token.value = null
    user.value = null
    error.value = null
    clearStorage()
  }

  return { token, user, loading, error, isAuthenticated, login, logout }
})
