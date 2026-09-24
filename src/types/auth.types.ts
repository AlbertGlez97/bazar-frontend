export interface User {
  id:          string
  email:       string
  name:        string
  currency:    string
  ruleNeeds:   number
  ruleWants:   number
  ruleSavings: number
  isActive:    boolean
  createdAt:   string
}

export interface LoginPayload {
  email:    string
  password: string
}

// Blob cifrado {iv, ct} — shape idéntico a EncryptedPayload del crypto service.
export interface EncryptedBlob {
  iv: string
  ct: string
}

/**
 * Payload de registro con material E2EE completo.
 * El cliente genera saltPassword/wrappedDekPassword/saltRecovery/wrappedDekRecovery
 * en cryptoStore.initSession() ANTES de llamar a este endpoint. El backend exige
 * estos 4 campos (NOT NULL desde día 1 — ver create-user.dto.ts).
 */
export interface RegisterPayload {
  email:       string
  name:        string
  password:    string
  currency?:   string
  ruleNeeds?:  number
  ruleWants?:  number
  ruleSavings?: number
  saltPassword:       string
  wrappedDekPassword: EncryptedBlob
  saltRecovery:       string
  wrappedDekRecovery: EncryptedBlob
}

/** Datos que el usuario tipea en el wizard — el crypto se genera aparte. */
export type RegisterInput = Omit<
  RegisterPayload,
  'saltPassword' | 'wrappedDekPassword' | 'saltRecovery' | 'wrappedDekRecovery'
>

export interface AuthResponse {
  accessToken: string
  usuario:     Pick<User, 'id' | 'name' | 'email' | 'currency'>
  /**
   * Presente en login (camino de contraseña para desenvoltura cross-device).
   * Ausente en register (el cliente ya tiene el material — lo acaba de generar).
   */
  crypto?: {
    saltPassword:       string
    wrappedDekPassword: EncryptedBlob
  }
}

// ── Recuperación de cuenta con Recovery Phrase ─────────────────────────────

/** Respuesta del /auth/recovery/init — material para desenvolver la DEK con la frase. */
export interface RecoveryInitResponse {
  saltRecovery:       string
  wrappedDekRecovery: EncryptedBlob
}

/** Payload de /auth/recovery/complete — nuevo camino de contraseña post-recovery. */
export interface RecoveryCompletePayload {
  email:              string
  saltPassword:       string
  wrappedDekPassword: EncryptedBlob
  newPassword:        string
}
