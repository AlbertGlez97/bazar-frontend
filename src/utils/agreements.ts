import type { AgreementOutcome } from '@/types/finance-rules.types'

/** Same limit as the server: a reason is plain text of 1 to 500 characters. */
export const MAX_REASON = 500

export const AGREEMENT_INVALID_TEXT = 'Este enlace no sirve. Pide a un socio que te lo envíe de nuevo.'
export const EMAIL_LINK_INVALID_TEXT = 'Este enlace no sirve. Escribe tu correo de nuevo para recibir otro.'
const GENERIC = 'No pudimos completar la acción. Revisa tu conexión e inténtalo de nuevo.'
const RATE_LIMITED = 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'

const statusOf = (error: unknown): number | null => {
  const status = (error as { response?: { status?: unknown } } | null)?.response?.status
  return typeof status === 'number' ? status : null
}
const codeOf = (error: unknown): string => {
  const code = (error as { response?: { data?: { code?: unknown } } } | null)?.response?.data?.code
  return typeof code === 'string' ? code : ''
}

/** A link that does not work (unknown, used, replaced, expired, closed): the server says the same for all. */
export const isInvalidLink = (error: unknown) => statusOf(error) === 404

export function agreementErrorMessage(error: unknown): string {
  if (isInvalidLink(error)) return AGREEMENT_INVALID_TEXT
  if (statusOf(error) === 429) return RATE_LIMITED
  switch (codeOf(error)) {
    case 'AGREEMENT_REASON_REQUIRED': return 'Escribe en pocas palabras por qué no estás de acuerdo.'
    case 'AGREEMENT_REASON_TOO_LONG': return `Usa máximo ${MAX_REASON} letras.`
    default: return GENERIC
  }
}

export function emailLinkErrorMessage(error: unknown): string {
  if (isInvalidLink(error)) return EMAIL_LINK_INVALID_TEXT
  return statusOf(error) === 429 ? RATE_LIMITED : GENERIC
}

/** What the person typed as a reason, or why it cannot be sent (empty when it can). */
export function reasonProblem(reason: string): string {
  const clean = reason.trim()
  if (!clean) return 'Escribe en pocas palabras por qué no estás de acuerdo.'
  if (clean.length > MAX_REASON) return `Usa máximo ${MAX_REASON} letras.`
  return ''
}

export interface OutcomeText { title: string; detail: string }

/** What the page says once the answer was recorded. */
export function outcomeText(outcome: AgreementOutcome): OutcomeText {
  switch (outcome) {
    case 'vigente':
      return { title: 'Listo, aprobaste', detail: 'Eras el último en responder. Las reglas ya están vigentes.' }
    case 'aprobada':
      return { title: 'Listo, aprobaste', detail: 'Cuando todos los socios aprueben, las reglas entrarán en vigor.' }
    case 'objetada':
      return { title: 'Guardamos tu respuesta', detail: 'Los demás socios verán tu motivo. Recibirás la versión nueva por correo.' }
    case 'en_revision':
      return { title: 'Esta propuesta está en revisión', detail: 'Esta propuesta está en revisión; recibirás la versión nueva por correo.' }
  }
}
