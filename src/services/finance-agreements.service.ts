import api from './api'
import { asObject, isInstant, isUuid, sameInstant } from './finance-shared'
import { currentQueueOrigin } from './queue-origin'
import { validDistributionSimulation } from './finance-distribution.service'
import { isValidDateKey } from '@/utils/business-time'
import { FinanceAgreementContractError, isAgreementId, normalizeAgreementFields, agreementReason, validCommitment } from '@/utils/finance-agreements'
import type { FinanceOrigin } from './contributions-records'
import type { AgreementCommitment, AgreementFilter, AgreementPage, AgreementReversalReceipt, CreateAgreementPayload,
  DistributionAgreement, ReverseAgreementPayload } from '@/types/finance-agreement.types'

type Rec = Record<string, unknown>
const str = (v: unknown): v is string => typeof v === 'string'
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v)
const count = (v: unknown): v is number => integer(v) && v >= 0
const boundedText = (v: unknown, max: number) => str(v) && v.trim() === v && v.length > 0 && v.length <= max
const note = (v: unknown) => v === null || (str(v) && v.length <= 1000 && v.trim() === v)
const folio = (v: unknown) => str(v) && /^AC-[0-9]{4}-[0-9]{5,}$/.test(v)
const period = (from: unknown, to: unknown) => str(from) && str(to) && isValidDateKey(from) && isValidDateKey(to) && from < to
const reference = (v: unknown): boolean => {
  const r = asObject(v)
  return v === null || (!!r && isAgreementId(r.id) && folio(r.folio))
}
const audit = (r: Rec) => isInstant(r.occurredAt) && isInstant(r.receivedAt) &&
  isUuid(r.createdByMemberId) && isUuid(r.createdByAccountId) && isUuid(r.deviceId)
function reversal(value: unknown, agreementId: unknown): boolean {
  const r = asObject(value)
  return !!r && isAgreementId(r.id) && r.id !== agreementId && r.agreementId === agreementId &&
    boundedText(r.reason, 1000) && audit(r)
}

/** Shape and internal consistency only; the browser never recomputes or claims to verify the server digest. */
export function validAgreement(value: unknown): value is DistributionAgreement {
  const r = asObject(value)
  if (!r || !isAgreementId(r.id) || !isUuid(r.contextId) || !folio(r.folio) ||
      !boundedText(r.title, 120) || !note(r.note) || r.generatedFrom !== 'DISTRIBUTION_SIMULATOR' ||
      r.algorithmVersion !== 1 || !str(r.notice) || !r.notice.trim() ||
      !str(r.snapshotFingerprint) || !/^[0-9a-f]{64}$/.test(r.snapshotFingerprint) ||
      !isInstant(r.occurredAt) || !isInstant(r.receivedAt) || !reference(r.replacesAgreement) || !reference(r.replacedBy)) return false
  const replacement = asObject(r.replacesAgreement)
  if (r.replacesAgreementId !== (replacement?.id ?? null) || r.replacesAgreementId === r.id || asObject(r.replacedBy)?.id === r.id) return false
  const creator = asObject(r.createdBy)
  const p = asObject(r.period)
  const base = asObject(r.financialBase)
  if (!creator || !isUuid(creator.memberId) || !str(creator.name) || !isUuid(creator.accountId) || !isUuid(creator.deviceId) ||
      !p || !period(p.from, p.to) || !isInstant(p.fromInstant) || !isInstant(p.toInstant) || p.interval !== '[from,to)' ||
      !sameInstant(p.fromInstant as string, p.from + 'T06:00:00.000Z') ||
      !sameInstant(p.toInstant as string, p.to + 'T06:00:00.000Z') || !base) return false
  if (!validDistributionSimulation({ ...r, simulation: true, persisted: false, members: r.participants }) ||
      !Array.isArray(r.participants) || !r.participants.every((v) => isUuid(asObject(v)?.memberId)) ||
      !integer(base.requestedAmountMinor) || base.requestedAmountMinor < 1 || base.requestedAmountMinor > 2147483647 ||
      !integer(base.potentiallyAvailableMinor) || base.potentiallyAvailableMinor < base.requestedAmountMinor ||
      base.remainingAvailableMinor !== base.potentiallyAvailableMinor - base.requestedAmountMinor) return false
  if (r.status === 'active') return r.reversal === null && r.replacedBy === null
  return r.status === 'voided' && reversal(r.reversal, r.id)
}
export function validAgreementPage(value: unknown): value is AgreementPage {
  const page = asObject(value)
  if (!page || !(page.nextCursor === null || (str(page.nextCursor) && page.nextCursor.length > 0 && page.nextCursor.length <= 1000)) || !Array.isArray(page.items)) return false
  return page.items.every((value) => {
    const r = asObject(value)
    if (!r || !isAgreementId(r.id) || !folio(r.folio) || !boundedText(r.title, 120) || !note(r.note) ||
        !period(r.from, r.to) || !integer(r.requestedAmountMinor) || r.requestedAmountMinor < 1 || r.requestedAmountMinor > 2147483647 ||
        !count(r.partnerShareBps) || !count(r.workShareBps) || r.partnerShareBps + r.workShareBps !== 10000 ||
        !['WORK_SHIFTS', 'KNOWN_MINUTES'].includes(r.workBasis as string) ||
        !['complete', 'partial'].includes(r.financialStatus as string) || !count(r.distributedMinor) || r.distributedMinor > r.requestedAmountMinor ||
        !count(r.participantCount) || !isInstant(r.occurredAt) || !isInstant(r.receivedAt) || !reference(r.replacesAgreement)) return false
    return r.status === 'active' ? r.voidedAt === null : r.status === 'voided' && isInstant(r.voidedAt)
  })
}
export function validAgreementReversalReceipt(value: unknown): value is AgreementReversalReceipt {
  const r = asObject(value)
  return !!r && isAgreementId(r.agreementId) && reversal(r, r.agreementId) && isUuid(r.contextId) &&
    validAgreement(r.original) && r.original.status === 'active' &&
    r.original.id === r.agreementId && r.original.contextId === r.contextId
}

function assertOrigin(origin: FinanceOrigin) {
  if (!navigator.onLine) throw new Error('Agreement requests require a connection')
  const current = currentQueueOrigin()
  if (!current || ['accountId', 'apiBase', 'memberId', 'deviceId'].some((key) =>
    current[key as keyof typeof current] !== origin[key as keyof FinanceOrigin]))
    throw new Error('Agreement origin no longer matches the active selection')
}
function config(origin: FinanceOrigin) {
  assertOrigin(origin)
  const transforms = api.defaults.transformRequest
  return {
    headers: { 'x-device-id': origin.deviceId }, financialOrigin: origin,
    // Unlike offline financial entries, agreements must retain the selected member at dispatch too.
    transformRequest: [function (data: unknown) { assertOrigin(origin); return data },
      ...(Array.isArray(transforms) ? transforms : transforms ? [transforms] : [])],
  }
}
function auditPayload(origin: FinanceOrigin, payload: ReverseAgreementPayload) {
  if (!isAgreementId(payload.id) || !isInstant(payload.occurredAt) ||
      payload.createdByMemberId !== origin.memberId || payload.deviceId !== origin.deviceId)
    throw new Error('Invalid agreement attempt identity')
  return { id: payload.id, occurredAt: payload.occurredAt, createdByMemberId: origin.memberId, deviceId: origin.deviceId }
}
const endpoint = '/finance/distribution-agreements'
export const FinanceAgreementsService = {
  async create(origin: FinanceOrigin, payload: CreateAgreementPayload): Promise<DistributionAgreement> {
    const body = { ...normalizeAgreementFields(payload), ...auditPayload(origin, { ...payload, reason: '' }) }
    const { data } = await api.post<unknown>(endpoint, body, config(origin))
    if (!validAgreement(data) || data.id !== body.id ||
        data.title !== body.title || data.note !== (body.note ?? null) ||
        data.replacesAgreementId !== (body.replacesAgreementId ?? null) || data.simulationFingerprint !== body.simulationFingerprint ||
        data.period.from !== body.from || data.period.to !== body.to || data.financialBase.requestedAmountMinor !== body.requestedAmountMinor ||
        data.rule.partnerShareBps !== body.partnerShareBps || data.rule.workShareBps !== body.workShareBps || data.rule.workBasis !== body.workBasis ||
        !sameInstant(data.occurredAt, body.occurredAt) || data.createdBy.memberId !== origin.memberId ||
        data.createdBy.deviceId !== origin.deviceId || data.createdBy.accountId !== origin.accountId)
      throw new FinanceAgreementContractError()
    return data
  },
  async list(origin: FinanceOrigin, filter: AgreementFilter = {}): Promise<AgreementPage> {
    const params: Record<string, string | number> = {}
    for (const key of ['from', 'to', 'status', 'folio', 'limit', 'cursor'] as const) {
      const value = filter[key]
      if (value !== undefined && value !== '') params[key] = value
    }
    const { data } = await api.get<unknown>(endpoint, { ...config(origin), params })
    if (!validAgreementPage(data)) throw new FinanceAgreementContractError()
    return data
  },
  /** Disponible / comprometido / libre de un período exacto. Solo es un aviso: al crear, el servidor revisa de nuevo. */
  async commitment(origin: FinanceOrigin, range: { from: string; to: string }): Promise<AgreementCommitment> {
    if (!period(range.from, range.to)) throw new Error('Invalid commitment period')
    const { data } = await api.get<unknown>(endpoint + '/commitment', { ...config(origin), params: { from: range.from, to: range.to } })
    if (!validCommitment(data) || data.from !== range.from || data.to !== range.to) throw new FinanceAgreementContractError()
    return data
  },
  async get(origin: FinanceOrigin, id: string): Promise<DistributionAgreement> {
    if (!isAgreementId(id)) throw new Error('Invalid agreement id')
    const { data } = await api.get<unknown>(endpoint + '/' + encodeURIComponent(id), config(origin))
    if (!validAgreement(data) || data.id !== id) throw new FinanceAgreementContractError()
    return data
  },
  async reverse(origin: FinanceOrigin, id: string, payload: ReverseAgreementPayload): Promise<AgreementReversalReceipt> {
    if (!isAgreementId(id) || id === payload.id) throw new Error('Invalid agreement reversal target')
    const body = { ...auditPayload(origin, payload), reason: agreementReason(payload.reason) }
    const { data } = await api.post<unknown>(endpoint + '/' + encodeURIComponent(id) + '/reversals', body, config(origin))
    if (!validAgreementReversalReceipt(data) || data.id !== body.id || data.agreementId !== id || data.reason !== body.reason ||
        !sameInstant(data.occurredAt, body.occurredAt) || data.createdByMemberId !== origin.memberId ||
        data.deviceId !== origin.deviceId || data.createdByAccountId !== origin.accountId)
      throw new FinanceAgreementContractError()
    return data
  },
}
