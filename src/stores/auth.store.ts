import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import AuthService from '@/services/auth.service'
import { useToastStore } from '@/stores/toast.store'
import { useSessionStore } from '@/stores/session.store'
import type { LoginPayload } from '@/types/auth.types'

const ACCESS_TOKEN_KEY = 'access_token'
const EXPIRES_AT_KEY   = 'token_expires_at'
// El backend no devuelve perfil de usuario — guardamos el username tecleado
// en el login solo para mostrarlo en el sidebar (AppLayout), no como dato
// verificado por el servidor.
const USERNAME_KEY = 'auth_username'

function clearStorage() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(EXPIRES_AT_KEY)
  localStorage.removeItem(USERNAME_KEY)
}

interface StoredSession {
  token:     string
  expiresAt: number
  username:  string | null
}

function restoreSession(): StoredSession | null {
  try {
    const token       = localStorage.getItem(ACCESS_TOKEN_KEY)
    const expiresAtRaw = localStorage.getItem(EXPIRES_AT_KEY)
    const expiresAt    = expiresAtRaw ? Number(expiresAtRaw) : NaN
    const username      = localStorage.getItem(USERNAME_KEY)

    if (token?.trim() && Number.isFinite(expiresAt) && expiresAt > Date.now()) {
      return { token, expiresAt, username }
    }
  } catch {
    // Storage corrupto ⇒ se trata como sesión cerrada, no como error de arranque.
  }
  clearStorage()
  return null
}

export const useAuthStore = defineStore('auth', () => {
  const session = restoreSession()

  const token     = ref<string | null>(session?.token ?? null)
  const expiresAt = ref<number | null>(session?.expiresAt ?? null)
  const username  = ref<string | null>(session?.username ?? null)
  const loading   = ref(false)
  const error     = ref<string | null>(null)

  // Sesión válida = hay token Y aún no venció. Permite detectar sesión
  // expirada sin depender de una llamada al servidor.
  const isAuthenticated = computed(
    () => !!token.value && !!expiresAt.value && expiresAt.value > Date.now()
  )

  async function login(payload: LoginPayload) {
    loading.value = true
    error.value = null
    try {
      const data = await AuthService.login(payload)
      if (!data.accessToken?.trim() || !Number.isFinite(data.expiresIn)) {
        throw new Error('Invalid login response')
      }

      const expiry = Date.now() + data.expiresIn * 1000
      localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken)
      localStorage.setItem(EXPIRES_AT_KEY, String(expiry))
      localStorage.setItem(USERNAME_KEY, payload.username)

      token.value     = data.accessToken
      expiresAt.value = expiry
      username.value  = payload.username
    } catch (cause) {
      logout()
      const status = (cause as { response?: { status?: number } } | null)?.response?.status
      const serverMessage = (cause as { response?: { data?: { message?: unknown } } } | null)
        ?.response?.data?.message

      error.value = status === 401
        ? 'Usuario o contraseña incorrectos'
        : typeof serverMessage === 'string'
          ? serverMessage
          : 'No se pudo iniciar sesión, intenta de nuevo'

      // Notifica el fallo también vía el sistema global de toasts.
      useToastStore().error(error.value)
      throw cause
    } finally {
      loading.value = false
    }
  }

  function logout() {
    token.value     = null
    expiresAt.value = null
    username.value  = null
    error.value     = null
    clearStorage()
    // Decisión: la persona seleccionada (member) se limpia con el logout —
    // debe reconfirmarse quién vende en la siguiente sesión — pero el
    // dispositivo identificado NO, porque es una propiedad física de la
    // tablet, independiente de qué cuenta esté abierta en ella.
    useSessionStore().clearOnLogout()
  }

  return { token, expiresAt, username, loading, error, isAuthenticated, login, logout }
})
