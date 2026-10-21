import { defaultRulesConfig } from '@/utils/finance-rules'
import type {
  RuleApproval,
  RuleObjection,
  RuleSetStatus,
  RuleSetView,
  RulesOverview,
  RulesPartner,
  RulesPartnerStatus,
} from '@/types/finance-rules.types'

export const rulesOrigin = {
  accountId: '0190aaaa-0000-7000-8000-000000000020',
  memberId: '0190aaaa-0000-7000-8000-000000000001',
  deviceId: '0190aaaa-0000-7000-8000-000000000030',
  apiBase: '/api/v1',
}
export const RULE_SET_ID = '0190aaaa-0000-7000-8000-0000000000a1'
export const ANA: RulesPartner = { memberId: rulesOrigin.memberId, name: 'Ana' }
export const BETO: RulesPartner = { memberId: '0190aaaa-0000-7000-8000-000000000002', name: 'Beto' }

export const ruleSet = (over: Partial<RuleSetView> = {}): RuleSetView => ({
  id: RULE_SET_ID,
  version: 1,
  status: 'borrador' as RuleSetStatus,
  config: defaultRulesConfig(),
  configHash: 'a'.repeat(64),
  warnings: [],
  proposedBy: ANA,
  createdAt: '2026-10-20T15:00:00.000Z',
  submittedAt: null,
  inReviewAt: null,
  activatedAt: null,
  supersededAt: null,
  discardedAt: null,
  withdrawnAt: null,
  closedNote: null,
  approvals: [] as RuleApproval[],
  objections: [] as RuleObjection[],
  changes: null,
  basedOn: null,
  missing: [],
  ...over,
})

/** The address as the server shows it: first letter, then masked. */
const masked = (who: RulesPartner) => `${(who.name[0] ?? 'x').toLowerCase()}***@e***.com`

/** A socio as the overview lists them: with an address, nothing answered, no link yet. */
export const partnerStatus = (who: RulesPartner, over: Partial<RulesPartnerStatus> = {}): RulesPartnerStatus => ({
  ...who,
  hasCorreo: true,
  correo: masked(who),
  response: null,
  link: null,
  ...over,
})

export const approval = (who: RulesPartner, over: Partial<RuleApproval> = {}): RuleApproval => ({
  ...who,
  approvedAt: '2026-10-20T16:05:00.000Z',
  correo: masked(who),
  via: 'correo',
  ...over,
})

export const objection = (who: RulesPartner, over: Partial<RuleObjection> = {}): RuleObjection => ({
  ...who,
  correo: masked(who),
  reason: 'Quiero más reservas',
  createdAt: '2026-10-20T17:00:00.000Z',
  ...over,
})

export const overviewFixture = (over: Partial<RulesOverview> = {}): RulesOverview => ({
  state: 'sin_aprobar',
  inForce: null,
  proposal: null,
  draft: null,
  history: [],
  partners: [partnerStatus(ANA), partnerStatus(BETO)],
  me: {
    memberId: ANA.memberId,
    correo: 'a***@e***.com',
    hasCorreo: true,
    pendingCorreo: null,
  },
  disclaimer: 'Esta herramienta ayuda a organizar el reparto. No es asesoría contable ni legal. Conviene validar las reglas con un contador.',
  ...over,
})
