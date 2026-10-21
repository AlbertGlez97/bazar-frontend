import { defaultRulesConfig } from '@/utils/finance-rules'
import type { RuleApproval, RuleSetStatus, RuleSetView, RulesOverview, RulesPartner } from '@/types/finance-rules.types'

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
  activatedAt: null,
  supersededAt: null,
  withdrawnAt: null,
  approvals: [] as RuleApproval[],
  recentInvitedApprovers: [],
  missing: [],
  ...over,
})

export const overviewFixture = (over: Partial<RulesOverview> = {}): RulesOverview => ({
  state: 'sin_aprobar',
  inForce: null,
  pending: null,
  draft: null,
  history: [],
  partners: [ANA, BETO],
  me: {
    memberId: ANA.memberId,
    canApprove: true,
    cannotApproveReason: null,
    hasApproved: false,
    isProposer: false,
    reminderReceivedAt: null,
  },
  disclaimer: 'Esta herramienta ayuda a organizar el reparto. No es asesoría contable ni legal. Conviene validar las reglas con un contador.',
  ...over,
})
