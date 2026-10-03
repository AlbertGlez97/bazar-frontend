import type { QueueOrigin } from './queue-origin'
import type {
  Contribution,
  ContributionPayload,
  ReversalPayload,
} from '@/types/contribution.types'
import type { Member } from '@/types/member.types'
export interface FinanceOrigin extends QueueOrigin {
  contextId?: string
}
export type FinancialOperation =
  | { kind: 'create'; payload: ContributionPayload }
  | { kind: 'reverse'; contributionId: string; payload: ReversalPayload }
export type PendingContribution = FinancialOperation & {
  key: string
  scope: string
  id: string
  origin: FinanceOrigin
  createdAt: string
  state: 'pending' | 'needs_review' | 'paused'
  attempts: number
  nextAttemptAt: number
  lastError?: string
}
export interface ContributionHistory {
  key: string
  scope: string
  contribution: Contribution
}
export interface FinanceReferences {
  scope: string
  members: Member[]
  savedAt: string
  contextId?: string
}
export function financeScope(
  origin: Pick<QueueOrigin, 'accountId' | 'apiBase'>,
): string {
  return JSON.stringify([origin.accountId, origin.apiBase])
}
