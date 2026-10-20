import api from './api'
import { asObject, isInstant, isUuid } from './finance-shared'
import { currentQueueOrigin } from './queue-origin'
import type { FinanceOrigin } from './contributions-records'
import type {
  FinanceRulesConfig,
  RemindResult,
  RuleSetView,
  RulesOverview,
} from '@/types/finance-rules.types'

const endpoint = '/finance/rules'
const STATES = ['sin_aprobar', 'pendiente', 'vigente']
const STATUSES = ['borrador', 'pendiente', 'vigente', 'reemplazada', 'retirada']

export class FinanceRulesContractError extends Error {
  constructor() {
    super('Invalid finance rules response')
    this.name = 'FinanceRulesContractError'
  }
}

const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const optionalInstant = (v: unknown) => v === null || isInstant(v)
const partner = (v: unknown) => {
  const r = asObject(v)
  return !!r && isUuid(r.memberId) && text(r.name)
}
const partners = (v: unknown) => Array.isArray(v) && v.every(partner)

/** Shape only: the server owns every rule, the browser recomputes nothing. */
export function validRuleSet(value: unknown): value is RuleSetView {
  const r = asObject(value)
  if (!r || !isUuid(r.id) || !Number.isInteger(r.version) || (r.version as number) < 1) return false
  if (!STATUSES.includes(r.status as string) || !asObject(r.config) || !/^[0-9a-f]{64}$/.test(String(r.configHash))) return false
  if (!partner(r.proposedBy) || !isInstant(r.createdAt)) return false
  if (![r.submittedAt, r.activatedAt, r.supersededAt, r.withdrawnAt].every(optionalInstant)) return false
  if (!Array.isArray(r.warnings) || !r.warnings.every((w) => text(asObject(w)?.code) && text(asObject(w)?.message))) return false
  return Array.isArray(r.approvals) && r.approvals.every((a) => partner(a) && isInstant(asObject(a)?.approvedAt)) && partners(r.missing)
}

export function validOverview(value: unknown): value is RulesOverview {
  const r = asObject(value)
  const me = asObject(r?.me)
  if (!r || !me || !STATES.includes(r.state as string) || !text(r.disclaimer)) return false
  if (![r.inForce, r.pending, r.draft].every((v) => v === null || validRuleSet(v))) return false
  if (!Array.isArray(r.history) || !r.history.every(validRuleSet) || !partners(r.partners)) return false
  return isUuid(me.memberId) && typeof me.canApprove === 'boolean' && typeof me.hasApproved === 'boolean' &&
    typeof me.isProposer === 'boolean' && (me.cannotApproveReason === null || text(me.cannotApproveReason)) &&
    optionalInstant(me.reminderReceivedAt)
}

function validRemind(value: unknown): value is RemindResult {
  const r = asObject(value)
  return !!r && Array.isArray(r.reminded) && Array.isArray(r.skipped) &&
    r.reminded.every((v) => partner(v) && typeof asObject(v)?.emailSent === 'boolean') &&
    r.skipped.every((v) => partner(v) && isInstant(asObject(v)?.nextAt))
}

function assertOrigin(origin: FinanceOrigin) {
  if (!navigator.onLine) throw new Error('Rules requests require a connection')
  const current = currentQueueOrigin()
  if (!current || (['accountId', 'apiBase', 'memberId', 'deviceId'] as const).some((key) => current[key] !== origin[key]))
    throw new Error('Rules origin no longer matches the active selection')
}
function config(origin: FinanceOrigin) {
  assertOrigin(origin)
  return { headers: { 'x-member-id': origin.memberId, 'x-device-id': origin.deviceId }, financialOrigin: origin }
}
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
  async submit(origin: FinanceOrigin, id: string): Promise<RuleSetView> {
    const { data } = await api.post<unknown>(ruleSetUrl(id, 'submit'), {}, config(origin))
    return checked(validRuleSet(data), data as RuleSetView)
  },
  async withdraw(origin: FinanceOrigin, id: string): Promise<RuleSetView> {
    const { data } = await api.post<unknown>(ruleSetUrl(id, 'withdraw'), {}, config(origin))
    return checked(validRuleSet(data), data as RuleSetView)
  },
  async approve(origin: FinanceOrigin, id: string): Promise<RuleSetView> {
    const { data } = await api.post<unknown>(ruleSetUrl(id, 'approve'), {}, config(origin))
    return checked(validRuleSet(data), data as RuleSetView)
  },
  async remind(origin: FinanceOrigin, id: string): Promise<RemindResult> {
    const { data } = await api.post<unknown>(ruleSetUrl(id, 'remind'), {}, config(origin))
    return checked(validRemind(data), data as RemindResult)
  },
}
