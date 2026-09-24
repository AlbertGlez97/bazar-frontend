// Store de autenticación — persiste el token y los datos del usuario en localStorage
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import AuthService from '@/services/auth.service'
import type {
  User, LoginPayload, RegisterPayload,
  RecoveryInitResponse,
} from '@/types/auth.types'
import { useCryptoStore } from '@/stores/crypto.store'

// Mensajes de error E2EE — constantes para evitar strings mágicos en el código (R16)
const MSG_CRYPTO_DOMEXCEPTION =
  'No se pudo restaurar tu cifrado local. Volvé a intentar o continuá sin cifrado en este dispositivo.'
const MSG_CRYPTO_FALLBACK =
  'El cifrado local no está disponible en este dispositivo.'

// Parsea el usuario de localStorage de forma segura.
// ?? 'null' no es suficiente: si el valor guardado es "" (cadena vacía o dato
// corrupto), JSON.parse("") lanza "Unexpected end of JSON input".
// Por eso usamos try/catch y limpiamos la entrada inválida.
function _loadUser(): User | null {
  try {
    const raw = localStorage.getItem('user')
    if (!raw) return null           // null o "" → sin usuario
    return JSON.parse(raw) as User
  } catch {
    // Dato corrupto → lo limpiamos para evitar errores en recargas futuras
    localStorage.removeItem('user')
    localStorage.removeItem('access_token')
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  // ── Estado ────────────────────────────────────────────────────────────────
  const token        = ref<string | null>(localStorage.getItem('access_token'))
  const user         = ref<User | null>(_loadUser())
  const loading      = ref(false)
  const error        = ref<string | null>(null)
  // Señal pública de fallo E2EE — null si no hubo fallo, string legible si hubo.
  // Solo se setea cuando el backend respondió OK pero el crypto subsystem falló.
  const cryptoWarning = ref<string | null>(null)

  // CryptoStore se instancia dentro del store para evitar el error de Pinia
  // "getActivePinia was called with no active Pinia" en el contexto de módulo
  const cryptoStore = useCryptoStore()

  // ── Computed ──────────────────────────────────────────────────────────────
  // Sesión válida = token + usuario cargado. Si alguno falta, hay estado
  // inconsistente (ej. localStorage parcialmente corrupto) → no autenticado.
  const isAuthenticated = computed(() => !!token.value && !!user.value)

  // ── Acciones ──────────────────────────────────────────────────────────────
  // Inicia sesión y guarda el token en localStorage
  async function login(payload: LoginPayload) {
    loading.value        = true
    error.value          = null
    cryptoWarning.value  = null   // REQ-AS-LOGIN-01: reset al inicio de cada llamada

    // userData declarado acá para estar accesible en el secondary try (crypto init)
    let userData: User

    try {
      // Try primario: autenticación backend — si falla, relanza hacia el caller
      try {
        const response = await AuthService.login(payload)
        userData = response.usuario as unknown as User
        _saveSession(response.accessToken, userData)
      } catch (e: unknown) {
        error.value = _extractError(e)
        throw e   // REQ-AS-LOGIN-08: relanza → el try secundario nunca se ejecuta
      }

      // Try secundario: E2EE — solo se alcanza si el backend respondió OK.
      // Los errores de crypto se absorben aquí; NO se relanza (REQ-AS-LOGIN-07).
      try {
        await _initOrRestoreCrypto(payload.password, userData.id)
      } catch (cryptoErr: unknown) {
        // Fallo de E2EE con sesión válida → señal pública, no error bloqueante
        cryptoWarning.value = _extractCryptoWarning(cryptoErr)
      }
    } finally {
      loading.value = false   // único finally para todo el flujo
    }
  }

  /**
   * Registra un usuario nuevo con material E2EE ya generado.
   *
   * CONTRATO (Fase C):
   * - El cliente DEBE generar el material criptográfico ANTES de llamar acá
   *   (vía cryptoStore.initSession(password), típicamente en el paso 2 del
   *   wizard de registro). Ese material se pasa completo dentro del payload.
   * - El backend exige los 4 campos crypto NOT NULL — la validación del DTO
   *   rechaza el registro si faltan.
   * - Si el POST falla, limpiamos la DEK en RAM con clearSession y propagamos
   *   el error para que el wizard pueda ofrecer reintentar.
   * - Si el POST tiene éxito, persistimos el cache local con el userId real
   *   (initSession no lo guardó porque el userId aún no existía).
   */
  async function register(payload: RegisterPayload) {
    loading.value       = true
    error.value         = null
    cryptoWarning.value = null

    try {
      const response = await AuthService.register(payload)
      const userData = response.usuario as unknown as User
      _saveSession(response.accessToken, userData)

      // Cache local del camino de contraseña con el userId real.
      cryptoStore.persistPasswordCache(
        userData.id,
        payload.saltPassword,
        payload.wrappedDekPassword,
      )
    } catch (e: unknown) {
      // Backend rechazó → DEK en RAM queda huérfana (sin usuario). Limpiar.
      cryptoStore.clearSession()
      error.value = _extractError(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  // ── Recuperación con Recovery Phrase ─────────────────────────────────────
  //
  // Flow orquestado por RecoverAccountView.vue en 3 pasos:
  //   1) recoverInit(email) → obtiene material de desenvoltura del backend.
  //   2) El cliente intenta cryptoStore.recoverWithPhrase(phrase, material).
  //      Si falla, queda claro que el email no existe o la frase es incorrecta.
  //   3) recoverComplete(email, newPassword) → genera nuevo camino de contraseña,
  //      lo envía al backend, recibe JWT, guarda sesión y cachea localStorage.

  /** Paso 1 — consulta el material de recuperación. Backend siempre responde OK. */
  async function recoverInit(email: string): Promise<RecoveryInitResponse> {
    loading.value = true
    error.value   = null
    try {
      return await AuthService.initRecovery(email)
    } catch (e) {
      error.value = _extractError(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Paso 3 — genera nuevo camino de contraseña y lo persiste. Requiere que la DEK
   * esté en RAM (el paso 2 la cargó con recoverWithPhrase). Al volver del backend
   * con auto-login, guarda sesión y cachea localStorage con el userId real.
   */
  async function recoverComplete(email: string, newPassword: string): Promise<void> {
    loading.value       = true
    error.value         = null
    cryptoWarning.value = null

    try {
      // Genera nuevo salt + wrappedDekPassword (no persiste todavía — falta userId)
      const { saltPassword, wrappedDekPassword } =
        await cryptoStore.rotatePasswordAfterRecovery(newPassword)

      // Backend actualiza material y devuelve JWT (auto-login)
      const response = await AuthService.completeRecovery({
        email,
        saltPassword,
        wrappedDekPassword,
        newPassword,
      })

      const userData = response.usuario as unknown as User
      _saveSession(response.accessToken, userData)

      // Cache local con userId real
      cryptoStore.persistPasswordCache(userData.id, saltPassword, wrappedDekPassword)
    } catch (e) {
      error.value = _extractError(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  // Carga el perfil completo del usuario (incluye regla presupuestal)
  async function fetchMe() {
    try {
      const me = await AuthService.getMe()
      user.value = me
      localStorage.setItem('user', JSON.stringify(me))
    } catch {
      logout()
    }
  }

  // Cierra sesión: limpia estado y destruye la DEK de memoria
  function logout() {
    cryptoStore.clearSession()   // _dek = null → GC la recolecta
    token.value         = null
    user.value          = null
    cryptoWarning.value = null   // REQ-AS-STATE-02: el warning no sobrevive al logout
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  /**
   * Si ya existe una wrapped DEK en localStorage, la restaura con la contraseña.
   * Si no existe (primer login o datos limpiados), crea una DEK nueva.
   *
   * Si la restauración falla (salt corrupto, wrapped DEK de otra sesión),
   * limpia los datos viejos y crea una DEK nueva.
   */
  async function _initOrRestoreCrypto(password: string, userId: string) {
    if (cryptoStore.canRestore(userId)) {
      try {
        await cryptoStore.restoreSession(password, userId)
        return
      } catch {
        // Wrapped DEK incompatible (password diferente, datos corruptos, etc.)
        // Limpiar y crear nueva DEK
        cryptoStore.wipeSession(userId)
      }
    }
    await cryptoStore.initSession(password, userId)
  }

  function _saveSession(accessToken: string, userData: User) {
    token.value = accessToken
    user.value  = userData
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('user', JSON.stringify(userData))
  }

  function _extractError(e: unknown): string {
    if (e && typeof e === 'object' && 'response' in e) {
      const resp = (e as { response?: { data?: { message?: string } } }).response
      return resp?.data?.message ?? 'Error desconocido'
    }
    return 'Error desconocido'
  }

  // Convierte cualquier excepción del subsistema E2EE en un mensaje legible.
  // Diferencia DOMException (caso más frecuente: password no matchea wdek)
  // del resto para dar feedback más preciso al usuario (design §2.5).
  function _extractCryptoWarning(e: unknown): string {
    if (e instanceof DOMException) return MSG_CRYPTO_DOMEXCEPTION
    if (e && typeof e === 'object' && 'message' in e) {
      const msg = (e as { message: unknown }).message
      if (typeof msg === 'string' && msg.length > 0) return msg
    }
    return MSG_CRYPTO_FALLBACK
  }

  return {
    token,
    user,
    loading,
    error,
    cryptoWarning,   // REQ-AS-STATE-01: expuesto como parte del estado público
    isAuthenticated,
    login,
    register,
    recoverInit,
    recoverComplete,
    fetchMe,
    logout,
  }
})
