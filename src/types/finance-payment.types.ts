/**
 * Real payments recorded against the frozen participants of a distribution agreement.
 * La Marchanta never moves money: a payment only records that it already happened.
 */
export type PaymentStatus = 'active' | 'voided'
export type PaymentProgress = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'NOT_DUE'

export interface PaymentActor { memberId: string; name: string; accountId: string; deviceId: string }
export interface PaymentReversal {
  id: string
  reason: string
  occurredAt: string
  receivedAt: string
  createdBy: PaymentActor
}
export interface ParticipantPaymentSummary {
  memberId: string
  memberName: string
  agreedMinor: number
  paidMinor: number
  pendingMinor: number
  status: PaymentProgress
}
export interface AgreementPaymentSummary {
  status: PaymentProgress
  agreedMinor: number
  paidMinor: number
  pendingMinor: number
  /** True when ANY payment row exists, active or voided. */
  hasPayments: boolean
  paymentCount: number
  activePaymentCount: number
  participants: ParticipantPaymentSummary[]
}
export interface DistributionPayment {
  id: string
  contextId: string
  agreementId: string
  participantMemberId: string
  /** Name frozen in the agreement, never the live member name. */
  participantName: string
  amountMinor: number
  currency: 'MXN'
  occurredAt: string
  receivedAt: string
  note: string | null
  createdBy: PaymentActor
  status: PaymentStatus
  reversal: PaymentReversal | null
  participantSummary?: ParticipantPaymentSummary
  paymentSummary?: AgreementPaymentSummary
}
export interface PaymentList { items: DistributionPayment[]; paymentSummary: AgreementPaymentSummary }

export interface PaymentFields {
  participantMemberId: string
  amountMinor: number
  occurredAt: string
  note?: string | null
}
export interface CreatePaymentPayload extends PaymentFields {
  id: string
  createdByMemberId: string
  deviceId: string
}
export interface ReversePaymentPayload {
  id: string
  reason: string
  occurredAt: string
  createdByMemberId: string
  deviceId: string
}
