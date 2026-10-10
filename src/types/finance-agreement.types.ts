import type { DistributionSimulation, DistributionSimulationRequest } from './finance-distribution.types'
import type { AgreementPaymentSummary } from './finance-payment.types'

export type AgreementStatus = 'active' | 'voided'
export interface AgreementReference { id: string; folio: string }
export interface AgreementFields extends DistributionSimulationRequest {
  title: string
  note?: string | null
  simulationFingerprint: string
  replacesAgreementId?: string | null
}
export interface CreateAgreementPayload extends AgreementFields {
  id: string
  occurredAt: string
  createdByMemberId: string
  deviceId: string
}
export interface ReverseAgreementPayload {
  id: string
  reason: string
  occurredAt: string
  createdByMemberId: string
  deviceId: string
}
export interface AgreementReversal extends ReverseAgreementPayload {
  agreementId: string
  receivedAt: string
  createdByAccountId: string
}
export interface DistributionAgreement extends Omit<DistributionSimulation, 'simulation' | 'persisted' | 'members'> {
  id: string
  contextId: string
  folio: string
  status: AgreementStatus
  title: string
  note: string | null
  replacesAgreementId: string | null
  replacesAgreement: AgreementReference | null
  generatedFrom: 'DISTRIBUTION_SIMULATOR'
  algorithmVersion: 1
  notice: string
  participants: DistributionSimulation['members']
  snapshotFingerprint: string
  occurredAt: string
  receivedAt: string
  createdBy: { memberId: string; name: string; accountId: string; deviceId: string }
  reversal: AgreementReversal | null
  replacedBy: AgreementReference | null
  /** Live payment progress; present on the detail read, absent on creation receipts and replays. */
  paymentSummary?: AgreementPaymentSummary
}
export interface AgreementReversalReceipt extends AgreementReversal {
  contextId: string
  original: DistributionAgreement
}
export interface AgreementListItem extends AgreementReference {
  status: AgreementStatus
  title: string
  note: string | null
  from: string
  to: string
  requestedAmountMinor: number
  partnerShareBps: number
  workShareBps: number
  workBasis: DistributionSimulationRequest['workBasis']
  financialStatus: DistributionSimulation['financialBase']['status']
  distributedMinor: number
  participantCount: number
  occurredAt: string
  receivedAt: string
  replacesAgreement: AgreementReference | null
  voidedAt: string | null
}
export interface AgreementFilter {
  from?: string
  to?: string
  status?: AgreementStatus
  folio?: string
  limit?: number
  cursor?: string
}
export interface AgreementPage { items: AgreementListItem[]; nextCursor: string | null }
