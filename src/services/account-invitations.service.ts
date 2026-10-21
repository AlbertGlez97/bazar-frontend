import api from './api'
import { asObject, isInstant, isUuid } from './finance-shared'
import { socioRequest } from './finance-request'
import type { FinanceOrigin } from './contributions-records'
import type { InvitationInfo, InvitationPreview, InvitationStatus } from '@/types/account-invitation.types'

export class AccountInvitationsContractError extends Error {
  constructor() {
    super('Invalid account invitation response')
    this.name = 'AccountInvitationsContractError'
  }
}

const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const checked = <T>(ok: boolean, data: T): T => {
  if (!ok) throw new AccountInvitationsContractError()
  return data
}

function validInfo(value: unknown): value is InvitationInfo {
  const r = asObject(value)
  return !!r && text(r.email) && isInstant(r.sentAt) && isInstant(r.expiresAt) && isInstant(r.canResendAt) &&
    Number.isInteger(r.resendsLeftToday) && (r.resendsLeftToday as number) >= 0
}
function validStatus(value: unknown): value is InvitationStatus {
  const r = asObject(value)
  return !!r && isUuid(r.memberId) && text(r.name) && typeof r.hasPersonalAccount === 'boolean' &&
    (r.invitation === null || validInfo(r.invitation))
}

export const AccountInvitationsService = {
  // ── Public page (no session). The token travels in the body, never in a URL. ──
  async inspect(token: string): Promise<InvitationPreview> {
    const { data } = await api.post<unknown>('/invitations/inspect', { token })
    const r = asObject(data)
    return checked(!!r && text(r.memberName) && text(r.email) && isInstant(r.expiresAt), data as InvitationPreview)
  },

  async accept(token: string, password: string): Promise<{ email: string }> {
    const { data } = await api.post<unknown>('/invitations/accept', { token, password })
    const r = asObject(data)
    checked(!!r && r.ok === true && text(r.email), data)
    return { email: (r as { email: string }).email }
  },

  // ── Team screen (socios only) ──
  async status(origin: FinanceOrigin): Promise<InvitationStatus[]> {
    const { data } = await api.get<unknown>('/members/account-status', socioRequest(origin))
    return checked(Array.isArray(data) && data.every(validStatus), data as InvitationStatus[])
  },

  async invite(origin: FinanceOrigin, memberId: string, email: string): Promise<{ expiresAt: string }> {
    if (!isUuid(memberId)) throw new Error('Invalid member id')
    const { data } = await api.post<unknown>(`/members/${encodeURIComponent(memberId)}/invitation`, { email }, socioRequest(origin))
    const r = asObject(data)
    checked(!!r && r.ok === true && isInstant(r.expiresAt), data)
    return { expiresAt: (r as { expiresAt: string }).expiresAt }
  },
}
