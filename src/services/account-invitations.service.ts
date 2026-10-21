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

/** 32 random bytes in base64url, like the server issues. */
const DEVICE_TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/
export interface AcceptedInvitation {
  email: string
  accountId: string
  /** The device this browser now has, in the shape the session store keeps. */
  device: { deviceId: string; name: string; deviceToken: string }
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
  const invite = asObject(r?.invite)
  return !!r && isUuid(r.memberId) && text(r.name) && typeof r.hasPersonalAccount === 'boolean' &&
    !!invite && typeof invite.allowed === 'boolean' && (invite.reason === null || text(invite.reason)) &&
    (r.invitation === null || validInfo(r.invitation))
}

export const AccountInvitationsService = {
  // ── Public page (no session). The token travels in the body, never in a URL. ──
  async inspect(token: string): Promise<InvitationPreview> {
    const { data } = await api.post<unknown>('/invitations/inspect', { token })
    const r = asObject(data)
    return checked(!!r && text(r.memberName) && text(r.email) && isInstant(r.expiresAt), data as InvitationPreview)
  },

  /**
   * Creates the login and registers the device of THIS browser. The device token comes back once
   * and only here; the one-time identifier is already spent, so it is not returned onward.
   */
  async accept(token: string, password: string): Promise<AcceptedInvitation> {
    const { data } = await api.post<unknown>('/invitations/accept', { token, password })
    const r = asObject(data)
    const device = asObject(r?.device)
    checked(
      !!r && r.ok === true && text(r.email) && isUuid(r.accountId) &&
        !!device && isUuid(device.id) && text(device.name) &&
        typeof device.token === 'string' && DEVICE_TOKEN_SHAPE.test(device.token),
      data,
    )
    return {
      email: r!.email as string,
      accountId: r!.accountId as string,
      device: { deviceId: device!.id as string, name: device!.name as string, deviceToken: device!.token as string },
    }
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
