/**
 * CryptoService — Zero-Knowledge con Key Wrapping y protección contra Replay Attacks
 *
 * Jerarquía de claves:
 *   password ──PBKDF2──► KEK (Key Encrypting Key)  usage: wrapKey/unwrapKey
 *                          │
 *                          ▼ wrapKey / unwrapKey
 *                     Wrapped DEK ──► localStorage (no secreto sin password)
 *                          │
 *                          ▼ unwrapKey (en RAM)
 *                         DEK (Data Encryption Key)  usage: encrypt/decrypt
 *                          │
 *                          ▼ AES-256-GCM + AAD
 *                     { iv, ct } ──► PostgreSQL JSONB
 *
 * Propiedades de seguridad:
 *   - DEK aleatoria por usuario — independiente de la contraseña
 *   - Cambio de contraseña = solo re-wrap de la DEK (O(1), sin tocar datos)
 *   - AAD vincula cada blob al registro exacto — replay attacks imposibles
 *   - KEK con extractable:false — nunca sale del subsistema crypto
 *   - DEK con extractable:true — solo para wrapKey/unwrapKey, nunca exportada manualmente
 */

import { generateMnemonic, validateMnemonic } from '@scure/bip39'
import { wordlist as spanishWordlist } from '@scure/bip39/wordlists/spanish.js'

// ── Constantes ────────────────────────────────────────────────────────────────

const PBKDF2_ITERATIONS = 310_000   // OWASP 2023 para SHA-256
const SALT_BYTES        = 16        // 128 bits
const IV_BYTES          = 12        // 96 bits — óptimo para GCM
const RECOVERY_PHRASE_STRENGTH = 128  // bits → 12 palabras BIP39

// ── Tipos públicos ─────────────────────────────────────────────────────────────

/** Blob cifrado almacenado en PostgreSQL como JSONB */
export interface EncryptedPayload {
  iv: string   // 12 bytes en Base64url
  ct: string   // ciphertext + tag GCM de 16 bytes, en Base64url
}

/** DEK envuelta con KEK — almacenada en localStorage */
export interface WrappedKey {
  iv: string   // IV usado en la operación wrapKey
  ct: string   // DEK cifrada con KEK
}

/** Contexto para construir el AAD de protección contra replay */
export interface AadContext {
  entityId:  string   // PK del registro (transaction.id, income.id, etc.)
  budgetId:  string   // FK al presupuesto
  createdAt: number   // Unix ms del servidor (timestamp inmutable del registro)
}

// ── Helpers de codificación ───────────────────────────────────────────────────

function toBase64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(b64: string): Uint8Array {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/')
    .padEnd(b64.length + (4 - b64.length % 4) % 4, '=')
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0))
}

// ── API pública ────────────────────────────────────────────────────────────────

const CryptoService = {

  // ── Generación de material criptográfico ───────────────────────────────────

  /** 128 bits CSPRNG → Base64url. Almacenar en localStorage (no es secreto). */
  generateSalt(): string {
    return toBase64url(crypto.getRandomValues(new Uint8Array(SALT_BYTES)).buffer)
  },

  /**
   * Genera una DEK aleatoria AES-256-GCM.
   * extractable:true es requerido para poder envolver/desenvolver con KEK.
   * La DEK nunca se exporta manualmente — solo pasa por wrapKey/unwrapKey.
   */
  async generateDEK(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,                               // extractable para wrapKey
      ['encrypt', 'decrypt'],
    )
  },

  /**
   * Deriva la KEK desde la contraseña usando PBKDF2.
   * usage: ['wrapKey', 'unwrapKey'] — la KEK NUNCA cifra datos directamente.
   * extractable: false — el material de la KEK nunca sale del subsistema crypto.
   */
  async deriveKEK(password: string, saltB64: string): Promise<CryptoKey> {
    const enc = new TextEncoder()

    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'],
    )

    return crypto.subtle.deriveKey(
      {
        name:       'PBKDF2',
        salt:       fromBase64url(saltB64),
        iterations: PBKDF2_ITERATIONS,
        hash:       'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,                              // KEK no extractable — nunca sale
      ['wrapKey', 'unwrapKey'],
    )
  },

  // ── Recovery Phrase (BIP39 español) ────────────────────────────────────────

  /**
   * Genera una frase de recuperación aleatoria de 12 palabras (BIP39 español).
   * La frase contiene 128 bits de entropía criptográfica + 4 bits de checksum.
   *
   * El usuario DEBE guardarla físicamente — es el único camino de recuperación
   * si olvida su contraseña. Zero-Knowledge significa que el servidor no puede
   * regenerarla ni recuperarla.
   */
  generateRecoveryPhrase(): string[] {
    return generateMnemonic(spanishWordlist, RECOVERY_PHRASE_STRENGTH).split(' ')
  },

  /**
   * Normaliza input del usuario a la forma canónica BIP39.
   *
   * Aplica:
   *   - NFKD Unicode normalization (el wordlist BIP39 español está en NFKD —
   *     "ábaco" son 6 codepoints: 'a' + combining tilde. NO NFC precompuesto).
   *     Esto es CRÍTICO: si no se usa NFKD, la comparación contra el wordlist
   *     y la derivación de KEK producen bytes distintos y la recuperación falla.
   *   - lowercase (normaliza mayúsculas al pegar del PDF)
   *   - trim + split por cualquier whitespace (tabs, newlines, múltiples espacios)
   */
  normalizeRecoveryPhrase(input: string): string[] {
    return input
      .normalize('NFKD')
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 0)
  },

  /**
   * Valida que la frase sea correcta según BIP39:
   *   - 12 palabras
   *   - todas en el wordlist español oficial
   *   - checksum criptográfico válido (los últimos 4 bits son hash del resto)
   *
   * Si alguno de estos falla → false. La librería @scure/bip39 hace todo esto
   * internamente en validateMnemonic().
   */
  validateRecoveryPhrase(phrase: string[]): boolean {
    if (phrase.length !== 12) return false
    return validateMnemonic(phrase.join(' '), spanishWordlist)
  },

  /**
   * Deriva una KEK desde la frase de recuperación usando PBKDF2.
   *
   * La frase ya tiene 128 bits de entropía aleatoria — PBKDF2 acá es para:
   *   1. Costo computacional (brute force resistance si alguien intenta probar
   *      frases aleatorias — cada intento cuesta ~300ms).
   *   2. Uniformización del material (la frase como string → bytes derivados).
   *
   * Reutiliza deriveKEK internamente — misma implementación, input distinto.
   */
  async deriveKEKFromPhrase(phrase: string[], saltB64: string): Promise<CryptoKey> {
    return CryptoService.deriveKEK(phrase.join(' '), saltB64)
  },

  // ── Key Wrapping ───────────────────────────────────────────────────────────

  /**
   * Envuelve (cifra) la DEK con la KEK.
   * El resultado puede almacenarse en localStorage sin riesgo:
   * sin la contraseña nadie puede derivar la KEK para desenvolver.
   *
   * Usa SubtleCrypto.wrapKey() — la DEK nunca existe como bytes en JS.
   */
  async wrapDEK(dek: CryptoKey, kek: CryptoKey): Promise<WrappedKey> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))

    const wrapped = await crypto.subtle.wrapKey(
      'raw',
      dek,
      kek,
      { name: 'AES-GCM', iv },
    )

    return { iv: toBase64url(iv.buffer), ct: toBase64url(wrapped) }
  },

  /**
   * Desenvuelve la DEK y la importa directamente como CryptoKey lista para usar.
   * Usa SubtleCrypto.unwrapKey() — los bytes de la DEK nunca pasan por JS.
   *
   * @throws DOMException si la contraseña es incorrecta (KEK no matchea)
   */
  async unwrapDEK(wrapped: WrappedKey, kek: CryptoKey): Promise<CryptoKey> {
    return crypto.subtle.unwrapKey(
      'raw',
      fromBase64url(wrapped.ct),
      kek,
      { name: 'AES-GCM', iv: fromBase64url(wrapped.iv) },
      { name: 'AES-GCM', length: 256 },
      true,                               // extractable para poder re-wrap en cambio de password
      ['encrypt', 'decrypt'],
    )
  },

  // ── AAD — Protección contra Replay Attacks ─────────────────────────────────

  /**
   * Construye el Additional Authenticated Data para una operación de cifrado.
   *
   * El AAD vincula el ciphertext al registro exacto:
   *   entityId  — PK del registro en la BD
   *   budgetId  — scope del presupuesto
   *   createdAt — timestamp inmutable asignado por el servidor
   *
   * Si alguien copia { iv, ct } a otro registro (diferente entityId o budgetId),
   * AES-GCM rechaza el descifrado con DOMException: operationError.
   *
   * El AAD NO se cifra — el servidor puede leer entityId/budgetId/createdAt
   * (ya los tiene). Lo que no puede hacer es moverlos sin romper el tag.
   */
  buildAad(ctx: AadContext): Uint8Array {
    return new TextEncoder().encode(
      `${ctx.entityId}|${ctx.budgetId}|${ctx.createdAt}`
    )
  },

  // ── Cifrado / Descifrado de datos ──────────────────────────────────────────

  /**
   * Cifra cualquier valor serializable a JSON usando la DEK.
   *
   * @param dek   Data Encryption Key (en RAM)
   * @param data  Dato a cifrar (number, string, object…)
   * @param aad   Contexto para Replay Protection (recomendado para montos)
   */
  async encrypt(dek: CryptoKey, data: unknown, aad?: AadContext): Promise<EncryptedPayload> {
    const iv        = crypto.getRandomValues(new Uint8Array(IV_BYTES))
    const plaintext = new TextEncoder().encode(JSON.stringify(data))

    const params: AesGcmParams = { name: 'AES-GCM', iv }
    if (aad) params.additionalData = CryptoService.buildAad(aad)

    const ciphertext = await crypto.subtle.encrypt(params, dek, plaintext)

    return { iv: toBase64url(iv.buffer), ct: toBase64url(ciphertext) }
  },

  /**
   * Descifra un EncryptedPayload y devuelve el valor original tipado.
   *
   * AES-GCM verifica el auth tag automáticamente:
   *   - Dato manipulado  → DOMException: operationError
   *   - AAD incorrecto   → DOMException: operationError (replay bloqueado)
   *   - Clave incorrecta → DOMException: operationError
   *
   * @throws DOMException en cualquier fallo de integridad
   */
  async decrypt<T>(dek: CryptoKey, payload: EncryptedPayload, aad?: AadContext): Promise<T> {
    const params: AesGcmParams = {
      name: 'AES-GCM',
      iv:   fromBase64url(payload.iv),
    }
    if (aad) params.additionalData = CryptoService.buildAad(aad)

    const plaintext = await crypto.subtle.decrypt(params, dek, fromBase64url(payload.ct))
    return JSON.parse(new TextDecoder().decode(plaintext)) as T
  },

  // ── Helpers para cifrado selectivo de campos ───────────────────────────────

  /**
   * Cifra solo los campos indicados de un objeto.
   * Los campos no listados pasan sin modificar.
   *
   * @example
   *   const body = await CryptoService.encryptFields(dek, transaction, ['amount'])
   *   // { amount: { iv, ct }, category: 'mercado', date: '2026-04-04' }
   */
  async encryptFields<T extends object>(
    dek: CryptoKey,
    obj: T,
    fields: (keyof T)[],
    aad?: AadContext,
  ): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = { ...obj }
    for (const field of fields) {
      if (obj[field] !== undefined && obj[field] !== null) {
        result[field as string] = await CryptoService.encrypt(dek, obj[field], aad)
      }
    }
    return result
  },

  /**
   * Descifra los campos cifrados de un objeto recibido del servidor.
   * Los campos que no son EncryptedPayload se ignoran silenciosamente.
   */
  async decryptFields<T extends object>(
    dek: CryptoKey,
    obj: Record<string, unknown>,
    fields: string[],
    aad?: AadContext,
  ): Promise<T> {
    const result: Record<string, unknown> = { ...obj }
    for (const field of fields) {
      const val = obj[field]
      if (val && typeof val === 'object' && 'iv' in val && 'ct' in val) {
        result[field] = await CryptoService.decrypt(dek, val as EncryptedPayload, aad)
      }
    }
    return result as T
  },
}

export default CryptoService
