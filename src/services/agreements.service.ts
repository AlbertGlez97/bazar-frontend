import api from './api'
import { asObject, isInstant } from './finance-shared'
import { text, validChange } from './finance-rules.service'
import type { AgreementOutcome, AgreementPage, CorreoConfirmationPage } from '@/types/finance-rules.types'

export class AgreementContractError extends Error {
  constructor() {
    super('Invalid agreement response')
    this.name = 'AgreementContractError'
  }
}

const OUTCOMES: readonly string[] = ['aprobada', 'vigente', 'objetada', 'en_revision']
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(text)
const checked = <T>(ok: boolean, data: T): T => {
  if (!ok) throw new AgreementContractError()
  return data
}

function validPage(value: unknown): value is AgreementPage {
  const r = asObject(value)
  if (!r || (r.state !== 'pendiente' && r.state !== 'en_revision')) return false
  if (!(r.message === null || text(r.message)) || !text(r.business) || !text(r.memberName) || !text(r.proposerName)) return false
  if (!Number.isInteger(r.version) || !(r.submittedAt === null || isInstant(r.submittedAt)) || !isInstant(r.expiresAt)) return false
  if (!strings(r.rules) || !strings(r.approvedBy) || !strings(r.waitingFor)) return false
  if (!Array.isArray(r.warnings) || !r.warnings.every((w) => text(asObject(w)?.code) && text(asObject(w)?.message))) return false
  return r.changes === null || (Array.isArray(r.changes) && r.changes.every(validChange))
}

/**
 * The two public pages an emailed link opens. No session: the single-use token in the BODY is the
 * only credential, and it never travels in a URL that proxies log. Reading never consumes the link.
 */
export const AgreementsService = {
  async inspect(token: string): Promise<AgreementPage> {
    const { data } = await api.post<unknown>('/agreements/inspect', { token })
    return checked(validPage(data), data as AgreementPage)
  },

  async respond(token: string, decision: 'approve' | 'object', reason?: string): Promise<{ outcome: AgreementOutcome }> {
    const { data } = await api.post<unknown>('/agreements/respond', {
      token,
      decision,
      ...(decision === 'object' ? { reason } : {}),
    })
    const r = asObject(data)
    return checked(!!r && OUTCOMES.includes(r.outcome as string), data as { outcome: AgreementOutcome })
  },
}

/** "Escribir mi correo": the page that confirms an address with the link sent to it. */
export const MemberEmailService = {
  async inspect(token: string): Promise<CorreoConfirmationPage> {
    const { data } = await api.post<unknown>('/member-emails/inspect', { token })
    const r = asObject(data)
    return checked(!!r && text(r.memberName) && text(r.correo) && isInstant(r.expiresAt), data as CorreoConfirmationPage)
  },

  async confirm(token: string): Promise<{ correo: string }> {
    const { data } = await api.post<unknown>('/member-emails/confirm', { token })
    const r = asObject(data)
    return checked(!!r && r.ok === true && text(r.correo), { correo: r?.correo as string })
  },
}
