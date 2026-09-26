import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import AuthService from '@/services/auth.service'
import { useToastStore } from '@/stores/toast.store'
import { useSessionStore } from '@/stores/session.store'
import type { AccountBinding, LoginPayload } from '@/types/auth.types'
import type { Member } from '@/types/member.types'
import { isMember } from '@/utils/member'

const ACCESS_TOKEN_KEY = 'access_token'
const EXPIRES_AT_KEY   = 'token_expires_at'
// El backend no devuelve perfil de usuario — guardamos el username tecleado
// en el login solo para mostrarlo en el sidebar (AppLayout), no como dato
// verificado por el servidor.
const USERNAME_KEY = 'auth_username'
// Última respuesta buena de GET /auth/me: solo { username, member } (nunca el
// token). Sirve para seguir sin conexión: se usa únicamente si pertenece al mismo
// usuario de la sesión, y se borra al cerrar sesión y en cualquier 401.
const BINDING_CACHE_KEY = 'account_binding'

/**
 * Qué se sabe de la cuenta de la sesión:
 * - unknown:  todavía no se consultó, o no se pudo (sin conexión y sin caché)
 * - shared:   login compartido del negocio (sin miembro propio): se elige quién atiende
 * - bound:    cuenta ligada a UN miembro: no hay nada que elegir
 * - inactive: cuenta ligada a un miembro que no puede entrar (desactivado o ilegible)
 */
export type BindingStatus = 'unknown' | 'shared' | 'bound' | 'inactive'

function clearStorage() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(EXPIRES_AT_KEY)
  localStorage.removeItem(USERNAME_KEY)
  localStorage.removeItem(BINDING_CACHE_KEY)
}

interface BindingCache {
  username: string
  member:   Member | null
}

function readBindingCache(): BindingCache | null {
  try {
    const raw = localStorage.getItem(BINDING_CACHE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const { username, member } = parsed as Record<string, unknown>
      if (typeof username === 'string' && username !== '') {
        if (member === null) return { username, member: null }
        if (isMember(member)) return { username, member }
      }
    }
  } catch {
    // Caché corrupta ⇒ como si no existiera.
  }
  localStorage.removeItem(BINDING_CACHE_KEY)
  return null
}

function writeBindingCache(entry: BindingCache) {
  try {
    localStorage.setItem(BINDING_CACHE_KEY, JSON.stringify(entry))
  } catch {
    // Sin espacio o storage bloqueado: solo se pierde el soporte sin conexión.
  }
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

  // Vínculo cuenta-persona (GET /auth/me). Ver BindingStatus. `boundMember` es
  // el miembro de una cuenta ligada (también cuando está inactivo, para poder
  // decirlo); null para el login compartido o mientras no se sepa.
  const bindingStatus = ref<BindingStatus>('unknown')
  const boundMember   = ref<Member | null>(null)
  // Una sola consulta por carga de página (o por login): el guard del router la
  // espera en cada navegación protegida sin repetirla.
  let bindingPromise: Promise<void> | null = null

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

      // Antes de dejar pasar a nadie: ¿esta cuenta es de una persona concreta?
      // Si sí, esa persona queda fijada en la sesión (pisando lo que hubiera
      // guardado) y no habrá selector. Nunca lanza: sin respuesta se sigue como
      // antes (selector) y el servidor igual hace cumplir el vínculo.
      resetBinding()
      await ensureBinding()
    } catch (cause) {
      logout()
      const status = (cause as { response?: { status?: number } } | null)?.response?.status
      const serverMessage = (cause as { response?: { data?: { message?: unknown } } } | null)
        ?.response?.data?.message

      error.value = status === 401
        ? 'Ese usuario o contraseña no coincide. Revísalos e intenta de nuevo.'
        : typeof serverMessage === 'string'
          ? serverMessage
          : 'No pudimos iniciar tu sesión. Intenta de nuevo en un momento.'

      // Notifica el fallo también vía el sistema global de toasts.
      useToastStore().error(error.value)
      throw cause
    } finally {
      loading.value = false
    }
  }

  function resetBinding() {
    bindingStatus.value = 'unknown'
    boundMember.value   = null
    bindingPromise      = null
  }

  /** Aplica lo que se sabe de la cuenta. Con miembro propio, ese miembro MANDA. */
  function applyBinding(member: Member | null, memberIdClaimed: string | null = null) {
    const session = useSessionStore()

    if (member === null && memberIdClaimed === null) {
      bindingStatus.value = 'shared'
      boundMember.value   = null
      return
    }

    // Cuenta ligada a un miembro. Si el servidor dice que hay uno pero no se
    // puede leer (o no coincide), se falla CERRADO: nunca se toma por compartida.
    if (!isMember(member) || member.active !== true
        || (memberIdClaimed !== null && memberIdClaimed !== member.id)) {
      bindingStatus.value = 'inactive'
      boundMember.value   = isMember(member) ? member : null
      session.clearMember()
      return
    }

    bindingStatus.value = 'bound'
    boundMember.value   = member
    session.setMember(member)
  }

  async function fetchBinding() {
    if (!token.value) return
    try {
      const data: AccountBinding = await AuthService.me()
      const member = data.member ?? null
      applyBinding(member, data.memberId ?? null)
      // Solo se guarda una respuesta coherente: compartida (sin miembro ni
      // memberId) o un miembro legible cuyo id coincide con memberId.
      const coherent = member === null
        ? data.memberId == null
        : isMember(member) && data.memberId === member.id
      if (username.value && coherent) {
        writeBindingCache({ username: username.value, member })
      }
    } catch (cause) {
      const status = (cause as { response?: { status?: number } } | null)?.response?.status
      if (status === 401) {
        // Sesión vencida o token inválido: se cierra por completo (esto también
        // borra la caché del vínculo).
        logout()
        return
      }
      if (status !== undefined && status < 500) {
        // Una respuesta 4xx (p. ej. un backend sin /auth/me) no es "sin conexión":
        // no se usa la caché y se sigue como antes.
        bindingStatus.value = 'unknown'
        return
      }
      // Sin conexión (o el servidor caído): la última respuesta buena, pero solo
      // si es del mismo usuario. Sin caché, se sigue como antes (selector); el
      // servidor igual rechaza cualquier persona que no sea la de la cuenta.
      const cached = readBindingCache()
      if (cached && cached.username === username.value) {
        applyBinding(cached.member, cached.member?.id ?? null)
      } else {
        bindingStatus.value = 'unknown'
      }
    }
  }

  /**
   * Resuelve una vez el vínculo cuenta-persona antes de que se decida nada por
   * rol. Nunca lanza. Sin sesión no hace nada.
   */
  function ensureBinding(): Promise<void> {
    if (!token.value) return Promise.resolve()
    bindingPromise ??= fetchBinding()
    return bindingPromise
  }

  function logout() {
    token.value     = null
    expiresAt.value = null
    username.value  = null
    error.value     = null
    resetBinding()
    clearStorage()
    // Decisión: la persona seleccionada (member) se limpia con el logout —
    // debe reconfirmarse quién vende en la siguiente sesión — pero el
    // dispositivo identificado NO, porque es una propiedad física de la
    // tablet, independiente de qué cuenta esté abierta en ella.
    useSessionStore().clearOnLogout()
  }

  return {
    token, expiresAt, username, loading, error, isAuthenticated,
    bindingStatus, boundMember,
    login, logout, ensureBinding,
  }
})
