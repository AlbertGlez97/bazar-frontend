/**
 * CryptoStore — Ciclo de vida de la DEK con Key Wrapping y Session Restore
 *
 * Lo que vive en localStorage (no secreto sin contraseña):
 *   e2ee_salt_{userId}  → salt de PBKDF2 (128 bits, Base64url)
 *   e2ee_wdek_{userId}  → DEK envuelta con KEK ({ iv, ct } como JSON)
 *
 * Lo que NUNCA persiste:
 *   La DEK en texto plano — solo existe en la variable de módulo _dek (RAM)
 *   La KEK — derivada al vuelo y descartada tras wrap/unwrap
 *   La contraseña — usada solo en deriveKEK() y descartada inmediatamente
 *
 * La DEK está fuera del estado reactivo de Pinia a propósito:
 *   Vue's Proxy no expone el material criptográfico, pero evitamos que
 *   Vue DevTools muestre el objeto CryptoKey en el panel de estado.
 */

import { defineStore } from 'pinia'
import { ref, readonly } from 'vue'
import CryptoService, { type EncryptedPayload, type WrappedKey, type AadContext } from '@/services/crypto.service'

// ── DEK en memoria volátil — fuera de Pinia intencionalmente ─────────────────
let _dek: CryptoKey | null = null

// ── Claves de localStorage ─────────────────────────────────────────────────
const saltKey = (uid: string) => `e2ee_salt_${uid}`
const wdekKey = (uid: string) => `e2ee_wdek_${uid}`

function loadSalt(userId: string): string | null {
  return localStorage.getItem(saltKey(userId))
}

function saveSalt(userId: string, salt: string): void {
  localStorage.setItem(saltKey(userId), salt)
}

function loadWrappedDek(userId: string): WrappedKey | null {
  const raw = localStorage.getItem(wdekKey(userId))
  if (!raw) return null
  try { return JSON.parse(raw) as WrappedKey } catch { return null }
}

function saveWrappedDek(userId: string, wdek: WrappedKey): void {
  localStorage.setItem(wdekKey(userId), JSON.stringify(wdek))
}

// ── Contratos públicos para registro y recuperación ───────────────────────

/** Material criptográfico generado al crear cuenta. El caller lo envía al backend. */
export interface InitSessionResult {
  /** 12 palabras BIP39 español — MOSTRAR al usuario, NUNCA enviar al backend */
  recoveryPhrase:     string[]
  /** Salt para PBKDF2 derivada de la contraseña — al backend */
  saltPassword:       string
  /** DEK envuelta con KEK_password — al backend (y cacheada en localStorage) */
  wrappedDekPassword: WrappedKey
  /** Salt para PBKDF2 derivada de la phrase — al backend */
  saltRecovery:       string
  /** DEK envuelta con KEK_recovery — al backend, NUNCA en localStorage */
  wrappedDekRecovery: WrappedKey
}

/** Material criptográfico tras cambiar contraseña via recovery. */
export interface RotatePasswordResult {
  saltPassword:       string
  wrappedDekPassword: WrappedKey
}

// ── Store ──────────────────────────────────────────────────────────────────
export const useCryptoStore = defineStore('crypto', () => {

  const isReady   = ref(false)
  const isLoading = ref(false)
  const error     = ref<string | null>(null)

  // ── Inicializar sesión nueva (login / register) ──────────────────────────

  /**
   * Genera material criptográfico completo para una cuenta nueva.
   *
   * Produce:
   *   - DEK aleatoria (vive solo en RAM)
   *   - Recovery Phrase (12 palabras BIP39 — debe mostrarse al user)
   *   - Dos salts independientes (password y recovery)
   *   - Dos wrappedDEKs (uno con KEK_password, otro con KEK_recovery)
   *
   * Efectos:
   *   - DEK queda en RAM (isReady = true).
   *   - saltPassword y wrappedDekPassword se cachean en localStorage (restore rápido).
   *   - El material recovery NO se guarda en localStorage por diseño —
   *     su lugar es el backend, no el dispositivo que usás día a día.
   *
   * Retorna los 5 elementos para que el caller los envíe al backend.
   * Si el backend falla, el caller DEBE llamar `wipeSession(userId)` para limpiar.
   */
  async function initSession(password: string, userId?: string): Promise<InitSessionResult> {
    isLoading.value = true
    error.value     = null
    try {
      // 1. Generar DEK y phrase
      const dek            = await CryptoService.generateDEK()
      const recoveryPhrase = CryptoService.generateRecoveryPhrase()

      // 2. Dos salts independientes — cada camino de recuperación tiene su propio salt
      const saltPassword = CryptoService.generateSalt()
      const saltRecovery = CryptoService.generateSalt()

      // 3. Derivar las dos KEKs en paralelo (operaciones costosas, ~300ms c/u)
      const [kekPassword, kekRecovery] = await Promise.all([
        CryptoService.deriveKEK(password, saltPassword),
        CryptoService.deriveKEKFromPhrase(recoveryPhrase, saltRecovery),
      ])

      // 4. Envolver la DEK por ambos caminos
      const [wrappedDekPassword, wrappedDekRecovery] = await Promise.all([
        CryptoService.wrapDEK(dek, kekPassword),
        CryptoService.wrapDEK(dek, kekRecovery),
      ])

      // 5. Cache local SOLO del camino de contraseña — y solo si conocemos el userId.
      //    En el flujo de registro el userId todavía no existe al momento de generar
      //    el material; el caller llama persistPasswordCache() tras recibir la
      //    respuesta del backend.
      if (userId) {
        saveSalt(userId, saltPassword)
        saveWrappedDek(userId, wrappedDekPassword)
      }

      // 6. La DEK vive en RAM a partir de aquí
      _dek          = dek
      isReady.value = true

      return {
        recoveryPhrase,
        saltPassword,
        wrappedDekPassword,
        saltRecovery,
        wrappedDekRecovery,
      }
    } catch (e) {
      error.value   = 'No se pudo inicializar el cifrado de sesión'
      isReady.value = false
      _dek          = null
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Persiste el cache local del camino de contraseña una vez que el userId es conocido.
   * Uso típico: justo después de que el backend responda OK al register, con el
   * material que ya se generó en un initSession previo (sin userId).
   */
  function persistPasswordCache(
    userId: string,
    saltPassword: string,
    wrappedDekPassword: WrappedKey,
  ): void {
    saveSalt(userId, saltPassword)
    saveWrappedDek(userId, wrappedDekPassword)
  }

  // ── Restaurar sesión tras recarga de página ──────────────────────────────

  /**
   * Detecta si hay datos de sesión E2EE en localStorage y si el usuario
   * tiene sesión activa, pero la DEK no está en RAM (caso: recarga de página).
   *
   * @returns true si hay wrapped DEK en localStorage (sesión restaurable)
   */
  function canRestore(userId: string): boolean {
    return !!loadSalt(userId) && !!loadWrappedDek(userId)
  }

  /**
   * Restaura la DEK en RAM a partir de la contraseña del usuario.
   * Usar en el modal de restauración de sesión tras una recarga de página.
   *
   * @throws Error si la contraseña es incorrecta o no hay datos en localStorage
   */
  async function restoreSession(password: string, userId: string): Promise<void> {
    isLoading.value = true
    error.value     = null
    try {
      const salt = loadSalt(userId)
      const wdek = loadWrappedDek(userId)

      if (!salt || !wdek) {
        throw new Error('No hay sesión E2EE guardada para este usuario')
      }

      // Derivar KEK con la misma contraseña y el mismo salt → misma KEK
      const kek = await CryptoService.deriveKEK(password, salt)

      // Unwrap: si la contraseña es incorrecta, unwrapKey lanza DOMException
      _dek = await CryptoService.unwrapDEK(wdek, kek)
      isReady.value = true
    } catch (e: unknown) {
      _dek          = null
      isReady.value = false
      // Distinguir contraseña incorrecta de error genérico
      const isDomEx = e instanceof DOMException
      error.value   = isDomEx
        ? 'Contraseña incorrecta. La clave no pudo restaurarse.'
        : 'Error al restaurar la sesión de cifrado'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  // ── Recuperación con Recovery Phrase ─────────────────────────────────────

  /**
   * Restaura la DEK usando la Recovery Phrase del usuario.
   *
   * Flujo:
   *   1. Normaliza la frase (NFC, lowercase, whitespace colapsado).
   *   2. Valida BIP39 (12 palabras + checksum + wordlist español).
   *   3. Deriva KEK_recovery con la phrase + saltRecovery.
   *   4. unwrapKey(wrappedDekRecovery, KEK_recovery) → DEK en RAM.
   *
   * El caller debe obtener saltRecovery + wrappedDekRecovery del backend
   * vía POST /auth/recovery/init (endpoint que se implementa en Fase B).
   *
   * Si la frase es incorrecta, unwrapKey lanza DOMException y la DEK queda null.
   *
   * Tras una recuperación exitosa, el caller DEBE llamar rotatePasswordAfterRecovery()
   * para que el usuario defina una contraseña nueva — si no, la sesión queda sin
   * camino de contraseña activo.
   */
  async function recoverWithPhrase(
    phraseInput: string[] | string,
    saltRecovery: string,
    wrappedDekRecovery: WrappedKey,
  ): Promise<void> {
    isLoading.value = true
    error.value     = null
    try {
      // Aceptar string crudo (pegado del usuario) o array ya separado
      const phrase = Array.isArray(phraseInput)
        ? CryptoService.normalizeRecoveryPhrase(phraseInput.join(' '))
        : CryptoService.normalizeRecoveryPhrase(phraseInput)

      if (!CryptoService.validateRecoveryPhrase(phrase)) {
        throw new Error('RECOVERY_PHRASE_INVALID')
      }

      const kekRecovery = await CryptoService.deriveKEKFromPhrase(phrase, saltRecovery)

      // Si la frase es incorrecta (pero válida BIP39), unwrapKey lanza DOMException
      _dek = await CryptoService.unwrapDEK(wrappedDekRecovery, kekRecovery)
      isReady.value = true
    } catch (e: unknown) {
      _dek          = null
      isReady.value = false
      if (e instanceof Error && e.message === 'RECOVERY_PHRASE_INVALID') {
        error.value = 'La frase no es válida. Revisá que sean 12 palabras del listado español.'
      } else if (e instanceof DOMException) {
        error.value = 'La frase no coincide con esta cuenta.'
      } else {
        error.value = 'Error al recuperar la cuenta.'
      }
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Tras recoverWithPhrase(), define una contraseña nueva para el usuario.
   *
   * Genera nuevo saltPassword + nuevo wrappedDekPassword. El caller DEBE enviar
   * estos valores al backend (endpoint /auth/recovery/complete) para que la
   * nueva contraseña sea válida cross-device.
   *
   * Efecto lateral: actualiza el cache local (localStorage) con el nuevo material.
   *
   * Requiere que la DEK esté en RAM (típicamente, tras un recoverWithPhrase).
   */
  async function rotatePasswordAfterRecovery(
    newPassword: string,
    userId?: string,
  ): Promise<RotatePasswordResult> {
    assertDekReady()
    isLoading.value = true
    try {
      const saltPassword       = CryptoService.generateSalt()
      const kekPassword        = await CryptoService.deriveKEK(newPassword, saltPassword)
      const wrappedDekPassword = await CryptoService.wrapDEK(_dek!, kekPassword)

      // Cache local SOLO si conocemos el userId. En el flujo de recuperación
      // el userId no se conoce hasta que el backend responde tras /recovery/complete;
      // el caller llama persistPasswordCache() con el userId real después.
      if (userId) {
        saveSalt(userId, saltPassword)
        saveWrappedDek(userId, wrappedDekPassword)
      }

      return { saltPassword, wrappedDekPassword }
    } finally {
      isLoading.value = false
    }
  }

  // ── Cambio de contraseña (O(1) — solo re-wrap, sin tocar datos) ──────────

  /**
   * Cambia la contraseña del usuario sin re-cifrar ningún dato.
   *
   * Proceso:
   *   1. Derivar nueva KEK con newPassword y el mismo salt existente
   *   2. Envolver la DEK actual con la nueva KEK
   *   3. Guardar el nuevo wrapped DEK en localStorage
   *
   * Los blobs en PostgreSQL NO se modifican — la DEK es la misma.
   *
   * Importante: el cambio de contraseña en el backend (hash bcrypt) debe
   * ocurrir en la misma transacción para mantener consistencia.
   */
  async function rotatePassword(newPassword: string, userId: string): Promise<void> {
    assertDekReady()
    isLoading.value = true
    try {
      const salt   = loadSalt(userId)
      if (!salt) throw new Error('Salt no encontrado para este usuario')

      const newKek  = await CryptoService.deriveKEK(newPassword, salt)
      const newWdek = await CryptoService.wrapDEK(_dek!, newKek)
      saveWrappedDek(userId, newWdek)
    } finally {
      isLoading.value = false
    }
  }

  // ── Destruir sesión ───────────────────────────────────────────────────────

  /**
   * Destruye la DEK en RAM al hacer logout.
   * El salt y el wrapped DEK permanecen en localStorage para una
   * restauración futura cuando el usuario vuelva a iniciar sesión.
   */
  function clearSession(): void {
    _dek          = null
    isReady.value = false
    error.value   = null
  }

  /**
   * Limpieza total: elimina también los datos de localStorage.
   * Usar al eliminar la cuenta del usuario o en un "olvidar este dispositivo".
   * ADVERTENCIA: los datos cifrados en el servidor serán irrecuperables
   * si no existe copia del wrapped DEK en otro dispositivo.
   */
  function wipeSession(userId: string): void {
    _dek = null
    isReady.value = false
    localStorage.removeItem(saltKey(userId))
    localStorage.removeItem(wdekKey(userId))
  }

  // ── Operaciones de cifrado (proxy a CryptoService con DEK implícita) ──────

  async function encrypt(data: unknown, aad?: AadContext): Promise<EncryptedPayload> {
    assertDekReady()
    return CryptoService.encrypt(_dek!, data, aad)
  }

  async function decrypt<T>(payload: EncryptedPayload, aad?: AadContext): Promise<T> {
    assertDekReady()
    return CryptoService.decrypt<T>(_dek!, payload, aad)
  }

  async function encryptFields<T extends object>(
    obj: T,
    fields: (keyof T)[],
    aad?: AadContext,
  ): Promise<Record<string, unknown>> {
    assertDekReady()
    return CryptoService.encryptFields(_dek!, obj, fields, aad)
  }

  async function decryptFields<T extends object>(
    obj: Record<string, unknown>,
    fields: string[],
    aad?: AadContext,
  ): Promise<T> {
    assertDekReady()
    return CryptoService.decryptFields<T>(_dek!, obj, fields, aad)
  }

  // ── Guard ─────────────────────────────────────────────────────────────────

  function assertDekReady(): void {
    if (!_dek || !isReady.value) {
      throw new Error(
        '[E2EE] DEK no disponible en RAM. ' +
        'Llamá initSession() tras login, o restoreSession() tras recarga de página.'
      )
    }
  }

  return {
    isReady:   readonly(isReady),
    isLoading: readonly(isLoading),
    error:     readonly(error),
    canRestore,
    initSession,
    persistPasswordCache,
    restoreSession,
    recoverWithPhrase,
    rotatePasswordAfterRecovery,
    rotatePassword,
    clearSession,
    wipeSession,
    encrypt,
    decrypt,
    encryptFields,
    decryptFields,
  }
})
