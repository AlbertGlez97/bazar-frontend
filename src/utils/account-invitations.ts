import { formatRuleDate, formatRuleDateTime, joinNames } from './finance-rules'
import type {
  AccountOrigin,
  InvitationStatus,
  RecentInvitedApprover,
} from '@/types/account-invitation.types'

/** Same policy as the server (and as "Cambiar mi contraseña"): used exactly as typed. */
export const MIN_PASSWORD = 10
export const MAX_PASSWORD = 128

export function passwordProblem(password: string, confirm: string): string {
  if (!password) return 'Escribe una contraseña.'
  if (password.length < MIN_PASSWORD) return `Tu contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`
  if (password.length > MAX_PASSWORD) return `Tu contraseña puede tener hasta ${MAX_PASSWORD} caracteres.`
  if (password !== confirm) return 'Las dos contraseñas deben ser iguales.'
  return ''
}

const codeOf = (error: unknown): string => {
  const code = (error as { response?: { data?: { code?: unknown } } } | null)?.response?.data?.code
  return typeof code === 'string' ? code : ''
}
const statusOf = (error: unknown): number | null => {
  const status = (error as { response?: { status?: unknown } } | null)?.response?.status
  return typeof status === 'number' ? status : null
}
const serverMessage = (error: unknown): string => {
  const message = (error as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message
  return typeof message === 'string' ? message.trim() : ''
}

const CODE_FALLBACK: Record<string, string> = {
  INVITATION_NOT_SENT: 'No pudimos enviar la invitación a ese correo.',
  INVITATION_TOO_SOON: 'Espera un minuto antes de enviar otra invitación.',
  INVITATION_DAILY_LIMIT: 'Ya se enviaron 3 invitaciones hoy. Intenta mañana.',
  INVITATION_INVALID: 'Este enlace no sirve. Pide una invitación nueva.',
  INVITATION_RATE_LIMITED: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
}

/** The server writes these messages in plain Spanish; they are shown as they come. */
export function invitationErrorMessage(error: unknown): string {
  const code = codeOf(error)
  if (CODE_FALLBACK[code]) return serverMessage(error) || CODE_FALLBACK[code]
  switch (statusOf(error)) {
    case 400: return 'Revisa el correo. Debe ser uno solo y estar bien escrito.'
    case 401: return 'La sesión venció. Inicia sesión de nuevo.'
    case 403: return 'Solo las personas socias pueden invitar.'
    case 409: return 'Esta persona ya tiene su cuenta personal.'
    default: return 'No pudimos completar la acción. Revisa tu conexión e inténtalo de nuevo.'
  }
}

export function inviteStatusText(status: InvitationStatus): string {
  const invitation = status.invitation
  if (!invitation) return ''
  return `Invitación enviada a ${invitation.email}. Vence el ${formatRuleDate(invitation.expiresAt)}.`
}

export function resendState(status: InvitationStatus, now: Date): { allowed: boolean; hint: string } {
  // The server decides who may invite whom; the button stays visible, disabled, with its reason.
  if (!status.invite.allowed) return { allowed: false, hint: status.invite.reason ?? '' }
  const invitation = status.invitation
  if (!invitation) return { allowed: true, hint: '' }
  if (invitation.resendsLeftToday <= 0)
    return { allowed: false, hint: 'Ya se enviaron 3 invitaciones hoy. Intenta mañana.' }
  if (now.getTime() < Date.parse(invitation.canResendAt))
    return { allowed: false, hint: 'Espera un minuto antes de reenviar.' }
  return { allowed: true, hint: '' }
}

/** How the account of someone who approved came to exist, in one short sentence. */
export function originText(origin: AccountOrigin | null): string {
  if (!origin) return 'Sin dato de cómo se creó la cuenta.'
  switch (origin.kind) {
    case 'invited':
      return `Cuenta creada por invitación de ${origin.invitedByName} el ${formatRuleDateTime(origin.invitedAt)}.`
    case 'invited_from_shared_login':
      return `Cuenta creada por invitación desde un acceso compartido (ya no existe) el ${formatRuleDateTime(origin.invitedAt)}. No se sabe quién invitó.`
    case 'shared_single_partner':
      return 'Acceso compartido de un solo socio (ya no existe).'
    case 'own_account':
      return origin.accountCreatedAt
        ? `Cuenta personal creada el ${formatRuleDate(origin.accountCreatedAt)}.`
        : 'Cuenta personal.'
  }
}

/** Notice for when rules become in force: who approved with a login invited a short while before. */
export function recentInviteNotice(approvers: readonly RecentInvitedApprover[]): string {
  if (!approvers.length) return ''
  if (approvers.length === 1) {
    const [one] = approvers as [RecentInvitedApprover]
    const date = formatRuleDate(one.acceptedAt)
    return one.fromSharedLogin
      ? `${one.name} aprobó con una cuenta creada desde un acceso compartido (ya no existe) el ${date}. No se sabe quién la invitó.`
      : `${one.name} aprobó con una cuenta invitada por ${one.invitedByName} el ${date}.`
  }
  const names = joinNames(approvers.map((a) => a.name))
  return approvers.some((a) => a.fromSharedLogin)
    ? `${names} aprobaron con cuentas invitadas, alguna desde un acceso compartido (ya no existe). Revisa el historial.`
    : `${names} aprobaron con cuentas invitadas hace poco. Revisa el historial.`
}
