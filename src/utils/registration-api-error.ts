/**
 * Qué le pasó a una llamada del registro de negocio (registrar, reenviar, confirmar el
 * correo), dicho con palabras de La Marchanta. Solo lee `status`, `data.code` y
 * `data.message` (si es texto) de la respuesta; nunca el cuerpo enviado ni cabeceras.
 */
import { VOICE, isNetworkError } from '@/config/voice'

export const REGISTRATION_MESSAGES = {
  rateLimited: 'Hiciste muchos intentos. Espera un rato y vuelve a intentar.',
  emailUnavailable: 'Por ahora no pudimos mandar el correo. Intenta de nuevo en un rato.',
  turnstileUnavailable: 'Por ahora no podemos hacer la verificación de seguridad. Intenta de nuevo en un rato.',
  turnstileInvalid: 'No pudimos confirmar la verificación de seguridad. Inténtalo de nuevo.',
} as const

export interface RegistrationApiFailure {
  status: number | null
  code: string | null
  /** Mensajes de class-validator (string o arreglo de strings) */
  messages: string[]
}

export function readRegistrationFailure(cause: unknown): RegistrationApiFailure {
  const response = (cause as { response?: { status?: number; data?: { code?: unknown; message?: unknown } } } | null)?.response
  const message = response?.data?.message
  return {
    status: response?.status ?? null,
    code: typeof response?.data?.code === 'string' ? response.data.code : null,
    messages: (Array.isArray(message) ? message : [message]).filter((m): m is string => typeof m === 'string'),
  }
}

/** Texto para un fallo que no tiene un campo propio. `unavailable` es el 503 sin código conocido. */
export function describeRegistrationFailure(
  cause: unknown,
  failure: RegistrationApiFailure = readRegistrationFailure(cause),
  unavailable: string = REGISTRATION_MESSAGES.emailUnavailable,
): string {
  if (isNetworkError(cause)) return VOICE.networkError
  if (failure.status === 429) return REGISTRATION_MESSAGES.rateLimited
  if (failure.status === 503) {
    return failure.code === 'turnstile_unavailable' ? REGISTRATION_MESSAGES.turnstileUnavailable : unavailable
  }
  if (failure.status === 400 && failure.code === 'turnstile_invalid') return REGISTRATION_MESSAGES.turnstileInvalid
  return VOICE.genericError
}
