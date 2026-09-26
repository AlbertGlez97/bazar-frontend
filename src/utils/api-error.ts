/**
 * Convierte lo que rechazó una petición (axios) en algo que la persona pueda
 * leer: qué pasó y, cuando se sabe, qué hacer. Antes cada vista tragaba el error
 * con un `catch { toast('Intenta de nuevo') }` y se perdía el porqué (un 403 por
 * no ser socio, un 400 por un dato mal formado, un dispositivo que ya no existe).
 *
 * No hace HTTP ni toca sesión (el interceptor de `api.ts` ya cierra la sesión en
 * un 401): solo describe. Nunca devuelve tokens, cabeceras ni el cuerpo de la
 * petición; del cuerpo de la respuesta solo lee `message` y solo si es texto
 * plano (un HTML de un proxy o del túnel no se muestra).
 */
import { VOICE } from '@/config/voice'

export type ApiErrorKind =
  | 'network'
  | 'session'
  | 'not-socio'
  | 'context-lost'
  | 'forbidden'
  | 'validation'
  | 'not-found'
  | 'conflict'
  | 'server'
  | 'unknown'

export interface DescribedApiError {
  kind: ApiErrorKind
  /** Código HTTP, o `null` si el servidor no respondió. */
  status: number | null
  /** Texto para la persona. */
  message: string
  /** Mensajes crudos adicionales del servidor (para soporte), si los hay. */
  detail?: string
}

/** Tope de un mensaje crudo mostrado tal cual (los desconocidos). */
const MAX_RAW_LENGTH = 200

// Mensajes de class-validator del alta/edición de producto -> copy amigable.
// El primero que coincide gana; el campo va al inicio del mensaje (`name must…`).
const PRODUCT_VALIDATION_COPY: Array<[RegExp, string]> = [
  [/^name\b/i, VOICE.apiErrors.product.name],
  [/^unitPriceMinor\b/i, VOICE.apiErrors.product.price],
  [/^category\b/i, VOICE.apiErrors.product.category],
  [/^purchaseCostMinor\b/i, VOICE.apiErrors.product.purchaseCost],
  [/^initialStock\b/i, VOICE.apiErrors.product.stock],
  [/^tipo\b/i, VOICE.apiErrors.product.tipo],
  [/^supplier\b/i, VOICE.apiErrors.product.supplier],
  [/^notes\b/i, VOICE.apiErrors.product.notes],
]

interface AxiosLike {
  isAxiosError?: boolean
  response?: { status?: number; data?: unknown }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** El texto del cuerpo, solo si es texto plano no vacío (nunca HTML). */
function plainText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text || text.startsWith('<')) return null
  return text.length > MAX_RAW_LENGTH ? `${text.slice(0, MAX_RAW_LENGTH - 1)}…` : text
}

/** `message` del cuerpo como lista de textos planos (string o string[]). */
function bodyMessages(data: unknown): string[] {
  if (!isRecord(data)) return []
  const raw = data.message
  const list = Array.isArray(raw) ? raw : [raw]
  return list.map(plainText).filter((text): text is string => text !== null)
}

function describeValidation(messages: string[]): Pick<DescribedApiError, 'message' | 'detail'> {
  if (messages.length === 0) return { message: VOICE.apiErrors.invalid }

  const friendly = messages.map((raw) => PRODUCT_VALIDATION_COPY.find(([pattern]) => pattern.test(raw))?.[1] ?? null)
  const firstKnown = friendly.find((text): text is string => text !== null)
  const rest = messages.length > 1 ? messages.slice(1).join(' · ') : undefined

  if (firstKnown) return { message: firstKnown, detail: messages.join(' · ') }
  // Ninguno conocido: se muestra el primero tal cual para que soporte lo lea.
  return { message: messages[0], detail: rest }
}

export function describeApiError(error: unknown): DescribedApiError {
  const axiosLike = isRecord(error) ? (error as AxiosLike) : null
  const response = axiosLike?.response

  if (!axiosLike?.isAxiosError) return { kind: 'unknown', status: null, message: VOICE.genericError }
  if (!response || typeof response.status !== 'number') {
    return { kind: 'network', status: null, message: VOICE.networkError }
  }

  const status = response.status
  const messages = bodyMessages(response.data)

  if (status === 401) return { kind: 'session', status, message: VOICE.apiErrors.session }

  if (status === 403) {
    const text = messages.join(' ').toLowerCase()
    if (text.includes('only socios')) return { kind: 'not-socio', status, message: VOICE.apiErrors.notSocio }
    if (text.includes('selection is not authorized')) return { kind: 'context-lost', status, message: VOICE.apiErrors.contextLost }
    return { kind: 'forbidden', status, message: VOICE.apiErrors.forbidden }
  }

  if (status === 400) return { kind: 'validation', status, ...describeValidation(messages) }
  if (status === 404) return { kind: 'not-found', status, message: VOICE.apiErrors.notFound }
  if (status === 409) return { kind: 'conflict', status, message: messages[0] ?? VOICE.apiErrors.conflict }
  if (status >= 500) return { kind: 'server', status, message: VOICE.apiErrors.server }

  return { kind: 'unknown', status, message: VOICE.genericError }
}

/**
 * "Qué no se pudo hacer" + el motivo, listo para un aviso: `No pudimos guardar el
 * producto. Solo los socios… (código 403)`. Un error que no es de red ni HTTP
 * (no se sabe nada) conserva el texto de siempre: `… Intenta de nuevo.`
 */
export function describeFailure(action: string, error: unknown): { described: DescribedApiError; message: string } {
  const described = describeApiError(error)
  const reason = described.kind === 'unknown' && described.status === null ? 'Intenta de nuevo.' : described.message
  return { described, message: withStatusSuffix({ status: described.status, message: `${action} ${reason}` }) }
}

/** El mensaje con el código HTTP al final, para que soporte sepa qué pasó. */
export function withStatusSuffix(described: Pick<DescribedApiError, 'status' | 'message'>): string {
  return described.status === null ? described.message : `${described.message} (código ${described.status})`
}
