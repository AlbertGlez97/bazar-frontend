/**
 * Traducción de errores de `POST /deudas` a la voz de La Marchanta. Mismo
 * principio que `sale-errors.ts`: nunca se muestra el texto crudo del
 * servidor (inglés, con ids). Un fallo aquí NUNCA se reintenta solo —la
 * persona corrige el formulario y vuelve a tocar "Registrar"— así que no
 * hace falta la clasificación red/servidor/auth completa de las ventas.
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

  const text = extractErrorMessages(error).join(' | ')
  if (/insufficient stock/i.test(text)) return VOICE.deuda.insufficientStock
  if (/is deactivated/i.test(text)) return VOICE.deuda.productDeactivated
  if (/does not exist/i.test(text)) return VOICE.deuda.productMissing
  return VOICE.deuda.createError
}
