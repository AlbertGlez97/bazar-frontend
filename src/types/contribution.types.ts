export interface ContributionPayload {
  id: string
  memberId: string
  amountMinor: number
  occurredAt: string
  note?: string | null
  createdByMemberId: string
  deviceId: string
}
export interface ReversalPayload {
  id: string
  occurredAt: string
  reason: string
  createdByMemberId: string
  deviceId: string
  replacement?: ContributionPayload
}
export interface ContributionReversal extends Omit<
  ReversalPayload,
  'replacement'
> {
  contributionId: string
  replacementContributionId: string | null
  receivedAt: string
}
export interface Contribution extends ContributionPayload {
  note: string | null
  contextId: string
  currency: 'MXN'
  createdByAccountId: string
  receivedAt: string
  member?: { id: string; name: string; active: boolean }
  reversal?: ContributionReversal | null
}
export interface ReversalReceipt extends ContributionReversal {
  contextId: string
  createdByAccountId: string
  original: Contribution
  replacement: Contribution | null
}
export interface ContributionPage {
  items: Contribution[]
  nextCursor: string | null
}
export interface ContributionFilter {
  from?: string
  to?: string
  memberId?: string
  cursor?: string
  limit?: number
}
