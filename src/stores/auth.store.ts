import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import AuthService from '@/services/auth.service'
import { useToastStore } from '@/stores/toast.store'
import { useFinanceDistributionStore } from '@/stores/finance-distribution.store'
import { useFinanceOverviewStore } from '@/stores/finance-overview.store'
import { useFinancePaymentsStore } from '@/stores/finance-payments.store'
import { useFinanceReservesStore } from '@/stores/finance-reserves.store'
import { useSessionStore } from '@/stores/session.store'
import type { AccountBinding, LoginPayload } from '@/types/auth.types'
import type { Member } from '@/types/member.types'
import { isMember } from '@/utils/member'
import { currentSessionOwner, sameOwner } from '@/services/session-owner'
import type { SessionOwner } from '@/services/session-owner'

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
 * - unknown:    todavía no se consultó, o no se pudo (sin conexión y sin caché)
 * - bound:      la cuenta es de UNA persona, que entra directo
 * - inactive:   la persona de la cuenta no puede entrar (desactivada o ilegible)
 * - unassigned: la cuenta no tiene persona asignada: no puede entrar
 */
export type BindingStatus = 'unknown' | 'bound' | 'inactive' | 'unassigned'

function clearStorage() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(EXPIRES_AT_KEY)
  localStorage.removeItem(USERNAME_KEY)
  localStorage.removeItem(BINDING_CACHE_KEY)
}

interface BindingCache {
  owner: SessionOwner
  username: string
  member:   Member
}

function readBindingCache(): BindingCache | null {
  try {
    const raw = localStorage.getItem(BINDING_CACHE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const { username, member, owner } = parsed as Record<string, unknown>
      if (typeof username === 'string' && username !== '' && sameOwner(owner, currentSessionOwner())) {
        if (isMember(member)) return { username, member, owner: owner as SessionOwner }
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
  // la persona de la cuenta (también cuando está inactiva, para poder
  // decirlo); null si la cuenta no tiene persona o mientras no se sepa.
  const bindingStatus = ref<BindingStatus>('unknown')
  const boundMember   = ref<Member | null>(null)
  // Una sola consulta por carga de página (o por login): el guard del router la
  // espera en cada navegación protegida sin repetirla.
  let bindingPromise: Promise<void> | null = null
  let bindingGeneration = 0
  let loginGeneration = 0

  // Sesión válida = hay token Y aún no venció. Permite detectar sesión
  // expirada sin depender de una llamada al servidor.
  const isAuthenticated = computed(
    () => !!token.value && !!expiresAt.value && expiresAt.value > Date.now()
  )

  // Phase4 caches are volatile and must not survive account or attribution changes.
  // Keep prior phases' durable queues and IndexedDB untouched.
  const activeSession = useSessionStore()
  function resetPhase4() {
    useFinanceOverviewStore().reset()
    useFinanceReservesStore().reset()
    useFinanceDistributionStore().reset()
    useFinancePaymentsStore().reset()
  }
  watch(
    [token, () => activeSession.owner?.accountId, () => activeSession.owner?.apiBase,
      () => activeSession.memberId, () => activeSession.deviceId],
    resetPhase4,
    { flush: 'sync' },
  )

  async function login(payload: LoginPayload) {
    const attempt = ++loginGeneration
    loading.value = true
    error.value = null
    try {
      const data = await AuthService.login(payload)
      if (attempt !== loginGeneration) return
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

      // Antes de dejar pasar a nadie: ¿de qué persona es esta cuenta? Esa
      // persona queda fijada en la sesión; no hay nada que elegir. Nunca
      // lanza: sin respuesta la cuenta queda sin confirmar y el servidor
      // igual hace cumplir el vínculo.
      useSessionStore().reconcileOwnership()
      resetBinding()
      await ensureBinding()
    } catch (cause) {
      if (attempt !== loginGeneration) throw cause
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
    bindingGeneration++
    bindingStatus.value = 'unknown'
    boundMember.value   = null
    bindingPromise      = null
  }

  /** Aplica lo que se sabe de la cuenta. La persona de la cuenta MANDA. */
  function applyBinding(member: Member | null, memberIdClaimed: string | null = null) {
    const session = useSessionStore()

    if (member === null && memberIdClaimed === null) {
      bindingStatus.value = 'unassigned'
      boundMember.value   = null
      session.clearMember()
      return
    }

    // Si el servidor dice que hay persona pero no se puede leer (o no
    // coincide), se falla CERRADO: la cuenta no entra.
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
    const requestToken = token.value
    const requestOwner = currentSessionOwner()
    const generation = bindingGeneration
    const isCurrent = () => generation === bindingGeneration && token.value === requestToken
      && localStorage.getItem(ACCESS_TOKEN_KEY) === requestToken
    try {
      const data: AccountBinding = await AuthService.me()
      if (!isCurrent()) return
      const member = data.member ?? null
      applyBinding(member, data.memberId ?? null)
      // Solo se guarda una respuesta coherente: una persona legible cuyo id
      // coincide con memberId.
      if (username.value && requestOwner && isMember(member) && data.memberId === member.id) {
        writeBindingCache({ username: username.value, member, owner: requestOwner })
      }
    } catch (cause) {
      if (!isCurrent()) return
      const status = (cause as { response?: { status?: number } } | null)?.response?.status
      if (status === 401) {
        // Sesión vencida o token inválido: se cierra por completo (esto también
        // borra la caché del vínculo).
        logout()
        return
      }
      if (status !== undefined && status < 500) {
        // Una respuesta 4xx (p. ej. un backend sin /auth/me) no es "sin conexión":
        // no se usa la caché y la cuenta queda sin confirmar.
        bindingStatus.value = 'unknown'
        return
      }
      // Sin conexión (o el servidor caído): la última respuesta buena, pero solo
      // si es del mismo usuario. Sin caché, la cuenta queda sin confirmar.
      const cached = readBindingCache()
      if (cached && cached.username === username.value && sameOwner(cached.owner, requestOwner)) {
        applyBinding(cached.member, cached.member.id)
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
    useSessionStore().reconcileOwnership()
    bindingPromise ??= fetchBinding()
    return bindingPromise
  }

  function refreshBindingForRecovery(): Promise<void> {
    resetBinding()
    return ensureBinding()
  }

  function logout() {
    resetPhase4()
    loginGeneration++
    token.value     = null
    expiresAt.value = null
    username.value  = null
    error.value     = null
    resetBinding()
    clearStorage()
    // Decisión: la persona de la sesión se limpia con el logout (la siguiente
    // cuenta trae la suya), pero el dispositivo identificado NO, porque es una
    // propiedad física de la tablet, independiente de qué cuenta esté abierta.
    useSessionStore().clearOnLogout()
  }

  return {
    token, expiresAt, username, loading, error, isAuthenticated,
    bindingStatus, boundMember,
    login, logout, ensureBinding, refreshBindingForRecovery,
  }
})
