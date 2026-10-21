export type BusinessPhase = 'arranque' | 'operacion' | 'cierre'
export type RecoveryMode = 'ninguna' | 'por_diferencia' | 'total' | 'proporcional'
export type RecoveryTiming = 'durante' | 'al_cierre'
export type WorkOrder = 'antes' | 'despues'
export type PartnerExpenseMode = 'no_reembolsar' | 'reembolsar' | 'contar_como_aportacion'
/** `retirada` only exists on old rows: "withdraw" is gone, discard and modify replace it. */
export type RuleSetStatus =
  | 'borrador' | 'pendiente' | 'en_revision' | 'vigente' | 'reemplazada' | 'descartada' | 'retirada'
export type RulesState = 'sin_aprobar' | 'pendiente' | 'en_revision' | 'vigente'

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

export interface RuleApproval {
  memberId: string
  name: string
  approvedAt: string
  /** Masked by the server (a***@e***.com); null for approvals given from a session, before email. */
  correo: string | null
  via: 'correo' | 'sesion'
}

export interface RuleObjection {
  memberId: string
  name: string
  /** Masked by the server. */
  correo: string
  reason: string
  createdAt: string
}

/** One topic that differs between two versions of the rules, in plain words. */
export interface RuleChange { topic: string; before: string; after: string }

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
  inReviewAt: string | null
  activatedAt: string | null
  supersededAt: string | null
  discardedAt: string | null
  withdrawnAt: string | null
  /** Why it was closed without being approved, when there is something to tell. */
  closedNote: string | null
  approvals: RuleApproval[]
  objections: RuleObjection[]
  changes: RuleChange[] | null
  /** For a draft made with "Modificar": the version it comes from and the objections it answers. */
  basedOn: { id: string; version: number; objections: RuleObjection[] } | null
  missing: RulesPartner[]
}

export interface RulesPartnerStatus extends RulesPartner {
  hasCorreo: boolean
  /** Masked. */
  correo: string | null
  response: 'aprobo' | 'objeto' | null
  /** The last link that really went out for the open proposal. */
  link: null | { sentAt: string; expiresAt: string; expired: boolean; canResendAt: string | null }
}

export interface RulesOverview {
  state: RulesState
  inForce: RuleSetView | null
  /** The open proposal: waiting for answers (`pendiente`) or in review (`en_revision`). */
  proposal: RuleSetView | null
  draft: RuleSetView | null
  history: RuleSetView[]
  partners: RulesPartnerStatus[]
  me: {
    memberId: string
    /** Masked; null while the socio has not written and confirmed one. */
    correo: string | null
    hasCorreo: boolean
    pendingCorreo: { correo: string; expiresAt: string } | null
  }
  disclaimer: string
}

/** What sending a draft answers: the proposal and who the emails reached. */
export interface SubmitResult {
  rules: RuleSetView
  emails: { sent: string[]; failed: string[] }
}

export interface ResendResult {
  activated: boolean
  resent: { memberId: string; name: string; emailSent: boolean }[]
  skipped: { memberId: string; name: string; nextAt: string }[]
  noEmail: RulesPartner[]
}

/** The public page of an emailed link (no session). */
export interface AgreementPage {
  state: 'pendiente' | 'en_revision'
  message: string | null
  business: string
  memberName: string
  proposerName: string
  version: number
  submittedAt: string | null
  expiresAt: string
  rules: string[]
  warnings: RulesWarning[]
  changes: RuleChange[] | null
  approvedBy: string[]
  waitingFor: string[]
}

export type AgreementOutcome = 'aprobada' | 'vigente' | 'objetada' | 'en_revision'

/** What the member's own address looks like after writing it. */
export interface CorreoRequestResult { correo: string; expiresAt: string }

/** The public page that confirms an address. */
export interface CorreoConfirmationPage { memberName: string; correo: string; expiresAt: string }
