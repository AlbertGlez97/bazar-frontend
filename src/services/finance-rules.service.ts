import api from './api'
import { asObject, isInstant, isUuid } from './finance-shared'
import { socioRequest } from './finance-request'
import type { FinanceOrigin } from './contributions-records'
import type {
  CorreoRequestResult,
  FinanceRulesConfig,
  ResendResult,
  RuleSetView,
  RulesOverview,
  SubmitResult,
} from '@/types/finance-rules.types'

const endpoint = '/finance/rules'
const STATES = ['sin_aprobar', 'pendiente', 'en_revision', 'vigente']
const STATUSES = ['borrador', 'pendiente', 'en_revision', 'vigente', 'reemplazada', 'descartada', 'retirada']

export class FinanceRulesContractError extends Error {
  constructor() {
    super('Invalid finance rules response')
    this.name = 'FinanceRulesContractError'
  }
}

export const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const optionalInstant = (v: unknown) => v === null || isInstant(v)
const optionalText = (v: unknown) => v === null || text(v)
const partner = (v: unknown) => {
  const r = asObject(v)
  return !!r && isUuid(r.memberId) && text(r.name)
}
const partners = (v: unknown) => Array.isArray(v) && v.every(partner)
const strings = (v: unknown) => Array.isArray(v) && v.every(text)

// `correo` and `via` must be present: a missing key is a broken contract, not "no data".
const validApproval = (a: unknown) => {
  const r = asObject(a)
  return partner(a) && isInstant(r?.approvedAt) && !!r && 'correo' in r && optionalText(r.correo) &&
    (r.via === 'correo' || r.via === 'sesion')
}
const validObjection = (o: unknown) => {
  const r = asObject(o)
  return partner(o) && text(r?.correo) && text(r?.reason) && isInstant(r?.createdAt)
}
export const validChange = (c: unknown) => {
  const r = asObject(c)
  return !!r && text(r.topic) && text(r.before) && text(r.after)
}
const validChanges = (v: unknown) => v === null || (Array.isArray(v) && v.every(validChange))
const validBasedOn = (v: unknown) => {
  if (v === null) return true
  const r = asObject(v)
  return !!r && isUuid(r.id) && Number.isInteger(r.version) && Array.isArray(r.objections) && r.objections.every(validObjection)
}

/** Shape only: the server owns every rule, the browser recomputes nothing. */
export function validRuleSet(value: unknown): value is RuleSetView {
  const r = asObject(value)
  if (!r || !isUuid(r.id) || !Number.isInteger(r.version) || (r.version as number) < 1) return false
  if (!STATUSES.includes(r.status as string) || !asObject(r.config) || !/^[0-9a-f]{64}$/.test(String(r.configHash))) return false
  if (!partner(r.proposedBy) || !isInstant(r.createdAt)) return false
  if (![r.submittedAt, r.inReviewAt, r.activatedAt, r.supersededAt, r.discardedAt, r.withdrawnAt].every(optionalInstant)) return false
  if (!optionalText(r.closedNote)) return false
  if (!Array.isArray(r.warnings) || !r.warnings.every((w) => text(asObject(w)?.code) && text(asObject(w)?.message))) return false
  return Array.isArray(r.approvals) && r.approvals.every(validApproval) &&
    Array.isArray(r.objections) && r.objections.every(validObjection) &&
    validChanges(r.changes) && validBasedOn(r.basedOn) && partners(r.missing)
}

function validPartnerStatus(value: unknown): boolean {
  const r = asObject(value)
  if (!r || !partner(value) || typeof r.hasCorreo !== 'boolean' || !optionalText(r.correo)) return false
  if (r.response !== null && r.response !== 'aprobo' && r.response !== 'objeto') return false
  if (r.link === null) return true
  const link = asObject(r.link)
  return !!link && isInstant(link.sentAt) && isInstant(link.expiresAt) && typeof link.expired === 'boolean' &&
    optionalInstant(link.canResendAt)
}

export function validOverview(value: unknown): value is RulesOverview {
  const r = asObject(value)
  const me = asObject(r?.me)
  if (!r || !me || !STATES.includes(r.state as string) || !text(r.disclaimer)) return false
  if (![r.inForce, r.proposal, r.draft].every((v) => v === null || validRuleSet(v))) return false
  if (!Array.isArray(r.history) || !r.history.every(validRuleSet)) return false
  if (!Array.isArray(r.partners) || !r.partners.every(validPartnerStatus)) return false
  const pending = me.pendingCorreo === null ||
    (!!asObject(me.pendingCorreo) && text(asObject(me.pendingCorreo)?.correo) && isInstant(asObject(me.pendingCorreo)?.expiresAt))
  return isUuid(me.memberId) && optionalText(me.correo) && typeof me.hasCorreo === 'boolean' && pending
}

function validSubmit(value: unknown): boolean {
  const emails = asObject(asObject(value)?.emails)
  return validRuleSet(value) && !!emails && strings(emails.sent) && strings(emails.failed) &&
    Array.isArray(emails.sent) && Array.isArray(emails.failed)
}

function validResend(value: unknown): value is ResendResult {
  const r = asObject(value)
  return !!r && typeof r.activated === 'boolean' && Array.isArray(r.resent) && Array.isArray(r.skipped) &&
    partners(r.noEmail) &&
    r.resent.every((v) => partner(v) && typeof asObject(v)?.emailSent === 'boolean') &&
    r.skipped.every((v) => partner(v) && isInstant(asObject(v)?.nextAt))
}

const config = socioRequest
const checked = <T>(ok: boolean, data: T): T => {
  if (!ok) throw new FinanceRulesContractError()
  return data
}
const ruleSetUrl = (id: string, action: string) => {
  if (!isUuid(id)) throw new Error('Invalid rule set id')
  return `${endpoint}/${encodeURIComponent(id)}/${action}`
}

export const FinanceRulesService = {
  async overview(origin: FinanceOrigin): Promise<RulesOverview> {
    const { data } = await api.get<unknown>(endpoint, config(origin))
    return checked(validOverview(data), data as RulesOverview)
  },
  async saveDraft(origin: FinanceOrigin, rules: FinanceRulesConfig): Promise<RuleSetView> {
    const { data } = await api.put<unknown>(`${endpoint}/draft`, { config: rules }, config(origin))
    return checked(validRuleSet(data), data as RuleSetView)
  },
  async discard(origin: FinanceOrigin, id: string): Promise<RuleSetView> {
    const { data } = await api.post<unknown>(ruleSetUrl(id, 'discard'), {}, config(origin))
    return checked(validRuleSet(data), data as RuleSetView)
  },
  /** Sends the draft: every socio gets an email with their own link. */
  async submit(origin: FinanceOrigin, id: string): Promise<SubmitResult> {
    const { data } = await api.post<unknown>(ruleSetUrl(id, 'submit'), {}, config(origin))
    checked(validSubmit(data), data)
    const { emails, ...rules } = data as RuleSetView & { emails: SubmitResult['emails'] }
    return { rules: rules as RuleSetView, emails }
  },
  /** Copies an open proposal into a draft the caller owns. */
  async modify(origin: FinanceOrigin, id: string): Promise<RuleSetView> {
    const { data } = await api.post<unknown>(ruleSetUrl(id, 'modify'), {}, config(origin))
    return checked(validRuleSet(data), data as RuleSetView)
  },
  async resend(origin: FinanceOrigin, id: string): Promise<ResendResult> {
    const { data } = await api.post<unknown>(ruleSetUrl(id, 'resend'), {}, config(origin))
    return checked(validResend(data), data as ResendResult)
  },
  /** Starts the confirmation of the caller's own address: the link goes to that address. */
  async requestCorreo(origin: FinanceOrigin, correo: string): Promise<CorreoRequestResult> {
    const { data } = await api.put<unknown>('/members/me/email', { correo }, config(origin))
    const r = asObject(data)
    return checked(!!r && r.ok === true && text(r.correo) && isInstant(r.expiresAt), {
      correo: r?.correo as string,
      expiresAt: r?.expiresAt as string,
    })
  },
}
