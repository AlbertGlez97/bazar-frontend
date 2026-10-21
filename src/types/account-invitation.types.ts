export interface InvitationPreview {
  memberName: string
  email: string
  expiresAt: string
}

export interface InvitationInfo {
  email: string
  sentAt: string
  expiresAt: string
  canResendAt: string
  resendsLeftToday: number
}

export interface InvitationStatus {
  memberId: string
  name: string
  hasPersonalAccount: boolean
  /** Whether the person using the app may invite this socio now, and why not when they may not. */
  invite: { allowed: boolean; reason: string | null }
  invitation: InvitationInfo | null
}

/** How the approving login was created; the server writes it once inside the approval. */
export type AccountOrigin =
  | { kind: 'shared_single_partner' }
  | {
      kind: 'invited'
      invitedByMemberId: string
      invitedByName: string
      invitedAt: string
      acceptedAt: string
      recent: boolean
    }
  | {
      /** Created from the shared login, which cannot prove who used it: no inviter is recorded. */
      kind: 'invited_from_shared_login'
      invitedAt: string
      acceptedAt: string
      recent: boolean
    }
  | { kind: 'own_account'; accountCreatedAt: string | null }

export interface RecentInvitedApprover {
  memberId: string
  name: string
  /** null when the account was created from the shared login: nobody can say who invited. */
  invitedByName: string | null
  acceptedAt: string
  fromSharedLogin: boolean
}
