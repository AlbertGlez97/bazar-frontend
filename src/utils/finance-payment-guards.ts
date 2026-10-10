import { asObject, isInstant, isUuid } from '@/services/finance-shared'
import { isAgreementId } from './finance-agreements'
import { MAX_PAYMENT_MINOR } from './finance-payments'
import type { AgreementPaymentSummary, DistributionPayment, ParticipantPaymentSummary, PaymentList } from '@/types/finance-payment.types'

type Rec = Record<string, unknown>
const str = (v: unknown): v is string => typeof v === 'string'
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const PROGRESS = ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'NOT_DUE']

/** Shape and arithmetic consistency only; the browser never recomputes what the server owns. */
export function validParticipantSummary(value: unknown): value is ParticipantPaymentSummary {
  const r = asObject(value)
  if (!r || !isUuid(r.memberId) || !str(r.memberName) || !r.memberName.trim() ||
      !count(r.agreedMinor) || !count(r.paidMinor) || !count(r.pendingMinor)) return false
  if (r.paidMinor > r.agreedMinor || r.pendingMinor !== r.agreedMinor - r.paidMinor) return false
  const expected = r.agreedMinor === 0 ? 'NOT_DUE' : r.paidMinor === 0 ? 'UNPAID' : r.paidMinor === r.agreedMinor ? 'PAID' : 'PARTIALLY_PAID'
  return r.status === expected
}
export function validPaymentSummary(value: unknown): value is AgreementPaymentSummary {
  const r = asObject(value)
  if (!r || !PROGRESS.includes(r.status as string) || !count(r.agreedMinor) || !count(r.paidMinor) || !count(r.pendingMinor) ||
      !count(r.paymentCount) || !count(r.activePaymentCount) || typeof r.hasPayments !== 'boolean' ||
      !Array.isArray(r.participants) || r.participants.length === 0 || !r.participants.every(validParticipantSummary)) return false
  const people = r.participants as ParticipantPaymentSummary[]
  if (new Set(people.map((p) => p.memberId)).size !== people.length) return false
  if (r.activePaymentCount > r.paymentCount || r.hasPayments !== r.paymentCount > 0 || r.pendingMinor !== r.agreedMinor - r.paidMinor ||
      r.agreedMinor !== people.reduce((sum, p) => sum + p.agreedMinor, 0) || r.paidMinor !== people.reduce((sum, p) => sum + p.paidMinor, 0)) return false
  const due = people.filter((p) => p.agreedMinor > 0)
  const expected = !due.length ? 'NOT_DUE' : due.every((p) => p.status === 'PAID') ? 'PAID' : due.every((p) => p.status === 'UNPAID') ? 'UNPAID' : 'PARTIALLY_PAID'
  return r.status === expected
}

const actor = (value: unknown): boolean => {
  const r = asObject(value)
  return !!r && isUuid(r.memberId) && str(r.name) && r.name.trim() !== '' && isUuid(r.accountId) && isUuid(r.deviceId)
}
function reversal(value: unknown, paymentId: unknown): boolean {
  const r = asObject(value)
  return !!r && isAgreementId(r.id) && r.id !== paymentId && str(r.reason) && r.reason.trim() === r.reason &&
    r.reason.length > 0 && r.reason.length <= 1000 && isInstant(r.occurredAt) && isInstant(r.receivedAt) && actor(r.createdBy)
}
export function validPayment(value: unknown): value is DistributionPayment {
  const r: Rec | null = asObject(value)
  if (!r || !isAgreementId(r.id) || !isUuid(r.contextId) || !isAgreementId(r.agreementId) || r.id === r.agreementId ||
      !isUuid(r.participantMemberId) || !str(r.participantName) || !r.participantName.trim() ||
      !count(r.amountMinor) || r.amountMinor < 1 || r.amountMinor > MAX_PAYMENT_MINOR || r.currency !== 'MXN' ||
      !isInstant(r.occurredAt) || !isInstant(r.receivedAt) || !(r.note === null || (str(r.note) && r.note.length <= 1000 && r.note.trim() === r.note)) ||
      !actor(r.createdBy)) return false
  if (r.participantSummary !== undefined && !(validParticipantSummary(r.participantSummary) && r.participantSummary.memberId === r.participantMemberId)) return false
  if (r.paymentSummary !== undefined && !validPaymentSummary(r.paymentSummary)) return false
  if (r.status === 'active') return r.reversal === null
  return r.status === 'voided' && reversal(r.reversal, r.id)
}
export function validPaymentList(value: unknown, agreementId?: string): value is PaymentList {
  const r = asObject(value)
  return !!r && Array.isArray(r.items) && validPaymentSummary(r.paymentSummary) &&
    r.items.every((item) => validPayment(item) && (agreementId === undefined || item.agreementId === agreementId) &&
      (r.paymentSummary as AgreementPaymentSummary).participants.some((p) => p.memberId === item.participantMemberId)) &&
    new Set(r.items.map((item) => (item as DistributionPayment).id)).size === r.items.length
}
