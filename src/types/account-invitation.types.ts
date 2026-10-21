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
  | { kind: 'own_account'; accountCreatedAt: string | null }

export interface RecentInvitedApprover {
  memberId: string
  name: string
  invitedByName: string
  acceptedAt: string
}
