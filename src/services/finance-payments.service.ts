import api from './api'
import { sameInstant } from './finance-shared'
import { currentQueueOrigin } from './queue-origin'
import { isAgreementId } from '@/utils/finance-agreements'
import { validPayment, validPaymentList, validPaymentSummary } from '@/utils/finance-payment-guards'
import { FinancePaymentContractError, isPaymentId, normalizePaymentFields, paymentReasonText } from '@/utils/finance-payments'
import type { FinanceOrigin } from './contributions-records'
import type { CreatePaymentPayload, DistributionPayment, PaymentList, ReversePaymentPayload } from '@/types/finance-payment.types'

export { validPayment, validPaymentList, validPaymentSummary }

function assertOrigin(origin: FinanceOrigin) {
  if (!navigator.onLine) throw new Error('Payment requests require a connection')
  const current = currentQueueOrigin()
  if (!current || ['accountId', 'apiBase', 'memberId', 'deviceId'].some((key) =>
    current[key as keyof typeof current] !== origin[key as keyof FinanceOrigin]))
    throw new Error('Payment origin no longer matches the active selection')
}
/** Payments are never queued: the selection must still match at dispatch time too. */
function config(origin: FinanceOrigin) {
  assertOrigin(origin)
  const transforms = api.defaults.transformRequest
  return {
    headers: { 'x-member-id': origin.memberId, 'x-device-id': origin.deviceId }, financialOrigin: origin,
    transformRequest: [function (data: unknown) { assertOrigin(origin); return data },
      ...(Array.isArray(transforms) ? transforms : transforms ? [transforms] : [])],
  }
}
function identity(origin: FinanceOrigin, payload: { id: string; createdByMemberId: string; deviceId: string }) {
  if (!isPaymentId(payload.id) || payload.createdByMemberId !== origin.memberId || payload.deviceId !== origin.deviceId)
    throw new Error('Invalid payment attempt identity')
  return { createdByMemberId: origin.memberId, deviceId: origin.deviceId }
}

const agreements = '/finance/distribution-agreements/'
const payments = '/finance/distribution-payments/'
export const FinancePaymentsService = {
  async create(origin: FinanceOrigin, agreementId: string, payload: CreatePaymentPayload): Promise<DistributionPayment> {
    if (!isAgreementId(agreementId)) throw new Error('Invalid agreement id')
    const audit = identity(origin, payload)
    const body = { id: payload.id, ...normalizePaymentFields(payload), ...audit }
    const { data } = await api.post<unknown>(agreements + encodeURIComponent(agreementId) + '/payments', body, config(origin))
    if (!validPayment(data) || !data.paymentSummary || !data.participantSummary ||
        data.id !== body.id || data.agreementId !== agreementId || data.participantMemberId !== body.participantMemberId ||
        data.amountMinor !== body.amountMinor || !sameInstant(data.occurredAt, body.occurredAt) ||
        data.note !== (body.note ?? null) ||
        data.createdBy.memberId !== origin.memberId || data.createdBy.deviceId !== origin.deviceId || data.createdBy.accountId !== origin.accountId)
      throw new FinancePaymentContractError()
    return data
  },
  async list(origin: FinanceOrigin, agreementId: string): Promise<PaymentList> {
    if (!isAgreementId(agreementId)) throw new Error('Invalid agreement id')
    const { data } = await api.get<unknown>(agreements + encodeURIComponent(agreementId) + '/payments', config(origin))
    if (!validPaymentList(data, agreementId)) throw new FinancePaymentContractError()
    return data
  },
  async get(origin: FinanceOrigin, id: string): Promise<DistributionPayment> {
    if (!isPaymentId(id)) throw new Error('Invalid payment id')
    const { data } = await api.get<unknown>(payments + encodeURIComponent(id), config(origin))
    if (!validPayment(data) || data.id !== id) throw new FinancePaymentContractError()
    return data
  },
  async reverse(origin: FinanceOrigin, paymentId: string, payload: ReversePaymentPayload): Promise<DistributionPayment> {
    if (!isPaymentId(paymentId) || paymentId === payload.id) throw new Error('Invalid payment reversal target')
    const audit = identity(origin, payload)
    const body = { id: payload.id, reason: paymentReasonText(payload.reason), occurredAt: payload.occurredAt, ...audit }
    if (!Number.isFinite(Date.parse(body.occurredAt))) throw new Error('Invalid payment reversal time')
    const { data } = await api.post<unknown>(payments + encodeURIComponent(paymentId) + '/reversals', body, config(origin))
    if (!validPayment(data) || data.id !== paymentId || data.status !== 'voided' || !data.paymentSummary || !data.participantSummary ||
        data.reversal?.id !== body.id || data.reversal.reason !== body.reason || !sameInstant(data.reversal.occurredAt, body.occurredAt) ||
        data.reversal.createdBy.memberId !== origin.memberId || data.reversal.createdBy.deviceId !== origin.deviceId ||
        data.reversal.createdBy.accountId !== origin.accountId)
      throw new FinancePaymentContractError()
    return data
  },
}
