export type BusinessPhase = 'arranque' | 'operacion' | 'cierre'
export type RecoveryMode = 'ninguna' | 'por_diferencia' | 'total' | 'proporcional'
export type RecoveryTiming = 'durante' | 'al_cierre'
export type WorkOrder = 'antes' | 'despues'
export type PartnerExpenseMode = 'no_reembolsar' | 'reembolsar' | 'contar_como_aportacion'
export type RuleSetStatus = 'borrador' | 'pendiente' | 'vigente' | 'reemplazada' | 'retirada'
export type RulesState = 'sin_aprobar' | 'pendiente' | 'vigente'

export interface ProfitBase { partnerPct: number; capitalPct: number; workPct: number }

export interface FinanceRulesConfig {
  schemaVersion: 1
  profitBase: ProfitBase
  reinvestment: {
    currentPhase: BusinessPhase
    arranquePct: number
    operacionPct: number
    cierrePct: number
    untilAmountMinor: number | null
  }
  capitalRecovery: { mode: RecoveryMode; timing: RecoveryTiming }
  work: {
    payHours: boolean
    order: WorkOrder
    pay: { kind: 'por_hora'; rateMinorPerHour: number } | { kind: 'porcentaje'; pct: number }
  }
  partnerExpenses: PartnerExpenseMode
  reserves: { kind: 'porcentaje'; pct: number } | { kind: 'monto'; amountMinor: number }
  partnerLoans: { repayBeforeCapital: boolean }
}

export interface RulesWarning { code: string; message: string }
export interface RulesPartner { memberId: string; name: string }
export interface RuleApproval { memberId: string; name: string; approvedAt: string }

export interface RuleSetView {
  id: string
  version: number
  status: RuleSetStatus
  config: FinanceRulesConfig
  configHash: string
  warnings: RulesWarning[]
  proposedBy: RulesPartner
  createdAt: string
  submittedAt: string | null
  activatedAt: string | null
  supersededAt: string | null
  withdrawnAt: string | null
  approvals: RuleApproval[]
  missing: RulesPartner[]
}

export interface RulesOverview {
  state: RulesState
  inForce: RuleSetView | null
  pending: RuleSetView | null
  draft: RuleSetView | null
  history: RuleSetView[]
  partners: RulesPartner[]
  me: {
    memberId: string
    canApprove: boolean
    cannotApproveReason: string | null
    hasApproved: boolean
    isProposer: boolean
    reminderReceivedAt: string | null
  }
  disclaimer: string
}

export interface RemindResult {
  reminded: { memberId: string; name: string; emailSent: boolean }[]
  skipped: { memberId: string; name: string; nextAt: string }[]
}
