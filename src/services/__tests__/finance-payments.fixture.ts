import { ADID_ID, ALBERTO_ID } from './finance-distribution.fixture'
import { AGREEMENT_ID, agreementOrigin } from './finance-agreements.fixture'
import type { AgreementPaymentSummary, DistributionPayment, ParticipantPaymentSummary, PaymentActor } from '@/types/finance-payment.types'

export const PAYMENT_ID = '0190bbbb-0000-7000-8000-000000000001'
export const PAYMENT_REVERSAL_ID = '0190bbbb-0000-7000-8000-000000000002'
export const actorFixture = (over: Partial<PaymentActor> = {}): PaymentActor => ({
  memberId: agreementOrigin.memberId, name: 'Alberto', accountId: agreementOrigin.accountId, deviceId: agreementOrigin.deviceId, ...over,
})
export const participantSummaryFixture = (over: Partial<ParticipantPaymentSummary> = {}): ParticipantPaymentSummary => ({
  memberId: ALBERTO_ID, memberName: 'Alberto', agreedMinor: 270000, paidMinor: 0, pendingMinor: 270000, status: 'UNPAID', ...over,
})
/** Alberto agreed 270000 (unpaid), Adid agreed 330000 (unpaid) unless overridden. */
export const paymentSummaryFixture = (over: Partial<AgreementPaymentSummary> = {}): AgreementPaymentSummary => ({
  status: 'UNPAID', agreedMinor: 600000, paidMinor: 0, pendingMinor: 600000,
  hasPayments: false, paymentCount: 0, activePaymentCount: 0,
  participants: [
    participantSummaryFixture(),
    participantSummaryFixture({ memberId: ADID_ID, memberName: 'Adid', agreedMinor: 330000, pendingMinor: 330000 }),
  ],
  ...over,
})
export const paymentFixture = (over: Partial<DistributionPayment> = {}): DistributionPayment => ({
  id: PAYMENT_ID, contextId: '0190aaaa-0000-7000-8000-000000000040', agreementId: AGREEMENT_ID,
  participantMemberId: ALBERTO_ID, participantName: 'Alberto', amountMinor: 100000, currency: 'MXN',
  occurredAt: '2026-10-09T15:00:00.000Z', receivedAt: '2026-10-09T15:00:01.000Z', note: null,
  createdBy: actorFixture(), status: 'active', reversal: null, ...over,
})
export const voidedPaymentFixture = (over: Partial<DistributionPayment> = {}): DistributionPayment => paymentFixture({
  status: 'voided',
  reversal: { id: PAYMENT_REVERSAL_ID, reason: 'Monto equivocado', occurredAt: '2026-10-09T16:00:00.000Z', receivedAt: '2026-10-09T16:00:01.000Z', createdBy: actorFixture() },
  ...over,
})
/** Alberto paid 100000 of 270000: partial participant, partial agreement. */
export const partialSummaryFixture = (): AgreementPaymentSummary => paymentSummaryFixture({
  status: 'PARTIALLY_PAID', paidMinor: 100000, pendingMinor: 500000, hasPayments: true, paymentCount: 1, activePaymentCount: 1,
  participants: [
    participantSummaryFixture({ paidMinor: 100000, pendingMinor: 170000, status: 'PARTIALLY_PAID' }),
    participantSummaryFixture({ memberId: ADID_ID, memberName: 'Adid', agreedMinor: 330000, pendingMinor: 330000 }),
  ],
})
/** A receipt as returned by create / reversal: live participant and agreement summaries attached. */
export const paymentReceiptFixture = (over: Partial<DistributionPayment> = {}): DistributionPayment => paymentFixture({
  participantSummary: partialSummaryFixture().participants[0], paymentSummary: partialSummaryFixture(), ...over,
})
