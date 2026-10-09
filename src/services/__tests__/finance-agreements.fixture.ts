import { simulationFixture } from './finance-distribution.fixture'
import type { AgreementListItem, AgreementReversalReceipt, DistributionAgreement } from '@/types/finance-agreement.types'

export const AGREEMENT_ID = '0190aaaa-0000-7000-8000-000000000010'
export const REVERSAL_ID = '0190aaaa-0000-7000-8000-000000000011'
export const agreementOrigin = {
  accountId: '0190aaaa-0000-7000-8000-000000000020',
  memberId: '0190aaaa-0000-7000-8000-000000000001',
  deviceId: '0190aaaa-0000-7000-8000-000000000030', apiBase: '/api/v1',
}
export const agreementFixture = (over: Partial<DistributionAgreement> = {}): DistributionAgreement => {
  const snapshot = simulationFixture()
  return {
    period: snapshot.period, currency: snapshot.currency, financialBase: snapshot.financialBase,
    rule: snapshot.rule, pools: snapshot.pools, totals: snapshot.totals, simulationFingerprint: snapshot.simulationFingerprint,
    id: AGREEMENT_ID, contextId: '0190aaaa-0000-7000-8000-000000000040',
    folio: 'AC-2026-00001', status: 'active', title: 'October agreement', note: null,
    replacesAgreementId: null, replacesAgreement: null, replacedBy: null, reversal: null,
    generatedFrom: 'DISTRIBUTION_SIMULATOR', algorithmVersion: 1,
    notice: 'Documento generado a partir de una simulación aceptada por los participantes. No es un contrato legal ni registra pagos.',
    participants: snapshot.members, snapshotFingerprint: 'b'.repeat(64),
    occurredAt: '2026-10-09T12:00:00.000Z', receivedAt: '2026-10-09T12:00:01.000Z',
    createdBy: { memberId: agreementOrigin.memberId, accountId: agreementOrigin.accountId, deviceId: agreementOrigin.deviceId, name: 'Alberto' },
    warnings: [{ code: 'PARTNER_ELIGIBILITY_IS_CURRENT_STATE', message: 'Current eligibility' }],
    ...over,
  }
}
export const agreementItemFixture = (over: Partial<AgreementListItem> = {}): AgreementListItem => ({
  id: AGREEMENT_ID, folio: 'AC-2026-00001', status: 'active', title: 'October agreement', note: null,
  from: '2026-10-01', to: '2026-11-01', requestedAmountMinor: 600000,
  partnerShareBps: 5000, workShareBps: 5000, workBasis: 'WORK_SHIFTS', financialStatus: 'complete',
  distributedMinor: 600000, participantCount: 2, occurredAt: '2026-10-09T12:00:00.000Z',
  receivedAt: '2026-10-09T12:00:01.000Z', replacesAgreement: null, voidedAt: null, ...over,
})
export const reversalFixture = (over: Partial<AgreementReversalReceipt> = {}): AgreementReversalReceipt => ({
  id: REVERSAL_ID, agreementId: AGREEMENT_ID, reason: 'Correction',
  occurredAt: '2026-10-09T12:00:00.000Z', receivedAt: '2026-10-09T12:00:01.000Z',
  createdByMemberId: agreementOrigin.memberId, deviceId: agreementOrigin.deviceId,
  createdByAccountId: agreementOrigin.accountId, contextId: agreementFixture().contextId,
  original: agreementFixture(), ...over,
})
