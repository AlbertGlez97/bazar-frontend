/**
 * Traducción de errores de `POST /deudas` a la voz de La Marchanta. Mismo
 * principio que `sale-errors.ts`: nunca se muestra el texto crudo del
 * servidor (inglés, con ids). Creation uses the shared sale-errors retry
 * classification; this module only formats debt-specific messages.
 * Later payments intentionally remain connection-required.
 */
import { VOICE } from '@/config/voice'

interface HttpLike {
  response?: { status?: number; data?: unknown }
}

function statusOf(error: unknown): number | undefined {
  const status = (error as HttpLike | null)?.response?.status
  return typeof status === 'number' ? status : undefined
}

/** `message` del cuerpo del error, normalizado a arreglo (mismo formato que §1.8). */
function extractErrorMessages(error: unknown): string[] {
  const data = (error as HttpLike | null)?.response?.data
  if (!data || typeof data !== 'object') return []
  const message = (data as { message?: unknown }).message
  if (message === undefined || message === null) return []
  const list = Array.isArray(message) ? message : [message]
  return list.filter((entry): entry is string => typeof entry === 'string')
}

/**
 * Texto amable para un fallo de `POST /deudas`. Sin respuesta (red/timeout)
 * -> aviso de conexión; 5xx -> genérico; 4xx documentados (§10) -> mensaje
 * específico; cualquier otro 4xx -> genérico de deuda.
 */
export function friendlyDeudaErrorMessage(error: unknown): string {
  const status = statusOf(error)
  if (status === undefined) return VOICE.networkError
  if (status >= 500) return VOICE.genericError
  if (status === 409) return 'Este fiado/apartado ya se guardó con otros datos. Un socio puede revisarlo.'

  const text = extractErrorMessages(error).join(' | ')
  if (/insufficient stock/i.test(text)) return VOICE.deuda.insufficientStock
  if (/is deactivated/i.test(text)) return VOICE.deuda.productDeactivated
  if (/does not exist/i.test(text)) return VOICE.deuda.productMissing
  // BE-15: abonoInicialMinor va dentro de POST /deudas; si por sí solo excede
  // el total, el mismo mensaje que un abono normal excesivo ("exceeds the
  // remaining balance") — aquí significa que nada se creó, ni la deuda.
  if (/exceeds the remaining balance/i.test(text)) return VOICE.deuda.abonoInicialExceedsBalance
  return VOICE.deuda.createError
}
