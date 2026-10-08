import { addDaysToKey, endOfMonthKey, presetRange, type RangePreset } from '@/utils/business-time'
import { formatRegisteredMinutes } from '@/utils/work-shift-duration'
import { formatMinorMoney, parseMoneyText } from '@/utils/money'
import { VOICE } from '@/config/voice'
import { MISSING_ROUTE_COPY, isMissingRoute, overviewErrorMessage } from '@/utils/finance-overview'
import type {
  DistributionMember,
  DistributionSimulation,
  DistributionSimulationRequest,
  DistributionWarning,
  DistributionWorkBasis,
} from '@/types/finance-distribution.types'

/** Inclusive day keys, exactly as the range picker shows them. */
export interface SimulatorPeriod {
  from: string
  to: string
}

/** The server answered 2xx but the body is not the contract this screen understands. */
export class FinanceDistributionContractError extends Error {
  constructor() {
    super('Invalid finance distribution response')
    this.name = 'FinanceDistributionContractError'
  }
}
export const isDistributionContractError = (error: unknown): boolean =>
  error instanceof FinanceDistributionContractError

export const BPS_TOTAL = 10000
export const BPS_PER_PERCENT = 100

// ── Period ────────────────────────────────────────────────────────────────

/** The picker emits INCLUSIVE end days; the API reads `[from,to)`, so send the next day. */
export const simulationExclusiveTo = (pickerTo: string): string => addDaysToKey(pickerTo, 1)

/**
 * Presets as the Reservas screen uses them: "Este mes" covers the whole civil
 * month, because reserves only count for an exact period.
 */
export function simulatorPreset(preset: RangePreset, now: Date = new Date()): SimulatorPeriod {
  const value = presetRange(preset, now)
  return preset === 'mes' ? { from: value.from, to: endOfMonthKey(value.to) } : value
}

// ── Rule (integer percentages <-> basis points) ──────────────────────────

export const percentToBps = (percent: number): number => percent * BPS_PER_PERCENT

/** `5000 -> "50"`, `2550 -> "25.5"`, `2505 -> "25.05"` (integer math, display only). */
export function bpsToPercentText(bps: number): string {
  const whole = Math.floor(bps / BPS_PER_PERCENT)
  const rest = bps % BPS_PER_PERCENT
  if (!rest) return String(whole)
  return `${whole}.${String(rest).padStart(2, '0').replace(/0$/, '')}`
}

export interface RulePreset {
  partner: number
  work: number
}
export const RULE_PRESETS: readonly RulePreset[] = [
  { partner: 50, work: 50 },
  { partner: 60, work: 40 },
  { partner: 70, work: 30 },
  { partner: 100, work: 0 },
  { partner: 0, work: 100 },
]

/** Whole number 0..100 typed as digits only; anything else is not a percentage. */
export function parsePercent(text: string): number | null {
  const value = text.trim()
  if (!/^\d{1,3}$/.test(value)) return null
  const n = Number(value)
  return n <= 100 ? n : null
}

export interface RuleState {
  partner: number | null
  work: number | null
  /** Sum of the valid parts (an empty part counts as 0), shown live. */
  total: number
  /** True only when both parts are valid integers and add up to 100. */
  valid: boolean
  error: string
}

export const RULE_SUM_ERROR = 'Los porcentajes deben sumar 100%.'
export const RULE_FORMAT_ERROR = 'Escribe porcentajes enteros de 0 a 100, sin decimales ni signos.'

export function ruleState(partnerText: string, workText: string): RuleState {
  const partner = parsePercent(partnerText)
  const work = parsePercent(workText)
  const total = (partner ?? 0) + (work ?? 0)
  const typedInvalid = (text: string, value: number | null) => text.trim() !== '' && value === null
  if (typedInvalid(partnerText, partner) || typedInvalid(workText, work))
    return { partner, work, total, valid: false, error: RULE_FORMAT_ERROR }
  if (partner === null || work === null) return { partner, work, total, valid: false, error: '' }
  if (total !== 100) return { partner, work, total, valid: false, error: RULE_SUM_ERROR }
  return { partner, work, total, valid: true, error: '' }
}

export const WORK_BASIS_LABEL: Record<DistributionWorkBasis, string> = {
  WORK_SHIFTS: 'Jornadas',
  KNOWN_MINUTES: 'Horas registradas',
}
export const WORK_BASIS_HINT: Record<DistributionWorkBasis, string> = {
  WORK_SHIFTS: 'Cada jornada registrada pesa igual.',
  KNOWN_MINUTES: 'Se usan únicamente los minutos registrados.',
}

// ── Amount ───────────────────────────────────────────────────────────────

/** Backend cap for an amount: 2147483647 cents. */
export const MAX_REQUEST_MINOR = 2147483647

export interface AmountState {
  /** Positive integer cents, or null while the text is empty/invalid/out of range. */
  minor: number | null
  error: string
}

/** Validates the typed amount; `maxMinor` (when known) is a UI convenience, the server decides. */
export function amountState(text: string, maxMinor: number | null): AmountState {
  const parsed = parseMoneyText(text)
  if (parsed === null) return { minor: null, error: 'Escribe un monto válido, por ejemplo 1,250.50.' }
  if (text.trim() === '') return { minor: null, error: '' }
  if (parsed < 1) return { minor: null, error: 'El monto debe ser mayor que cero.' }
  if (parsed > MAX_REQUEST_MINOR) return { minor: null, error: 'El monto es demasiado grande.' }
  if (maxMinor !== null && parsed > maxMinor)
    return {
      minor: null,
      error: `El monto supera lo potencialmente disponible. Máximo: ${formatMinorMoney(maxMinor)}.`,
    }
  return { minor: parsed, error: '' }
}

// ── Request ──────────────────────────────────────────────────────────────

export interface SimulatorInputs {
  period: SimulatorPeriod
  amountMinor: number
  partnerPercent: number
  workPercent: number
  workBasis: DistributionWorkBasis
}

/** The only body ever sent: six fields, integer bps, EXCLUSIVE `to`. */
export function buildSimulationRequest(input: SimulatorInputs): DistributionSimulationRequest {
  return {
    from: input.period.from,
    to: simulationExclusiveTo(input.period.to),
    requestedAmountMinor: input.amountMinor,
    partnerShareBps: percentToBps(input.partnerPercent),
    workShareBps: percentToBps(input.workPercent),
    workBasis: input.workBasis,
  }
}

export const sameRequest = (
  a: DistributionSimulationRequest | null,
  b: DistributionSimulationRequest | null,
): boolean =>
  !!a &&
  !!b &&
  a.from === b.from &&
  a.to === b.to &&
  a.requestedAmountMinor === b.requestedAmountMinor &&
  a.partnerShareBps === b.partnerShareBps &&
  a.workShareBps === b.workShareBps &&
  a.workBasis === b.workBasis

// ── Result display (never recomputes money) ──────────────────────────────

/** Integer percentage, rounded half up. Display only; 0 when there is no total. */
export function sharePercent(part: number, total: number): number {
  if (total <= 0 || part <= 0) return 0
  return Math.floor((part * 200 + total) / (total * 2))
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Auditable line: how much of the work this member weighs in the chosen basis. */
export function workBreakdownText(
  member: DistributionMember,
  basis: DistributionWorkBasis,
  members: readonly DistributionMember[],
): string {
  if (basis === 'WORK_SHIFTS') {
    const total = members.reduce((sum, m) => sum + m.shiftCount, 0)
    return `${member.shiftCount} de ${plural(total, 'jornada', 'jornadas')} · ${sharePercent(member.shiftCount, total)}%`
  }
  const total = members.reduce((sum, m) => sum + m.knownMinutes, 0)
  return `${formatRegisteredMinutes(member.knownMinutes)} de ${formatRegisteredMinutes(total)} · ${sharePercent(member.knownMinutes, total)}%`
}

export const unknownDurationText = (count: number): string =>
  count > 0 ? plural(count, 'jornada sin duración registrada', 'jornadas sin duración registrada') : ''

export const ruleSummary = (rule: DistributionSimulation['rule']): string =>
  `${bpsToPercentText(rule.partnerShareBps)}% por ser socio · ${bpsToPercentText(rule.workShareBps)}% por trabajo · Base: ${WORK_BASIS_LABEL[rule.workBasis]}`

export const isPartialResult = (s: DistributionSimulation): boolean =>
  s.financialBase.status === 'partial' || s.warnings.some((w) => w.code === 'OPERATING_RESULT_PARTIAL')

export const PARTIAL_RESULT_COPY =
  'Hay ventas con costos incompletos. Esta simulación parte de un resultado financiero parcial.'
export const SIMULATION_DISCLAIMER =
  'Esta es una simulación. No registra pagos, retiros ni movimientos de dinero.'

/** Codes already explained by the disclaimer and the partial alert. */
const COVERED_BY_VIEW = new Set([
  'SIMULATION_ONLY',
  'NOT_A_PAYMENT_OR_OBLIGATION',
  'OPERATING_RESULT_PARTIAL',
  'MISSING_SALE_COST',
])
export const GENERIC_WARNING = 'La simulación incluye un aviso que no reconocemos. Tómalo con cuidado.'

const WARNING_COPY: Record<string, (s: DistributionSimulation) => string> = {
  SIMULATION_ONLY: () => SIMULATION_DISCLAIMER,
  NOT_A_PAYMENT_OR_OBLIGATION: () => 'Los montos simulados no son pagos, retiros, deudas ni obligaciones.',
  OPERATING_RESULT_PARTIAL: () => PARTIAL_RESULT_COPY,
  MISSING_SALE_COST: () => 'Hay ventas sin costo registrado, por eso el resultado financiero es parcial.',
  PARTNER_ELIGIBILITY_IS_CURRENT_STATE: () =>
    'La parte por ser socio usa a los socios activos de hoy; no hay historial de quién era socio en el período.',
  WORK_SHIFTS_WITHOUT_DURATION: (s) => {
    const n = s.members.reduce((sum, m) => sum + m.unknownDurationCount, 0)
    return n > 0
      ? `Hay ${plural(n, 'jornada sin duración registrada', 'jornadas sin duración registrada')}; al usar horas registradas no pesan.`
      : 'Hay jornadas sin duración registrada; al usar horas registradas no pesan.'
  },
  INACTIVE_MEMBER_RECEIVES_WORK_AMOUNT: () =>
    'Una persona inactiva tiene trabajo registrado en el período y aparece con un monto simulado por trabajo.',
}

/** Friendly Spanish for one backend warning code; unknown codes get neutral text (never the raw English). */
export const warningText = (warning: DistributionWarning, s: DistributionSimulation): string =>
  WARNING_COPY[warning.code]?.(s) ?? GENERIC_WARNING

/** Warnings the view does not already cover, deduplicated by code. */
export function visibleWarnings(s: DistributionSimulation): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const w of s.warnings) {
    if (COVERED_BY_VIEW.has(w.code) || seen.has(w.code)) continue
    seen.add(w.code)
    out.push(warningText(w, s))
  }
  return out
}

// ── Errors ───────────────────────────────────────────────────────────────

export const ACCESS_COPY = 'Solo socios pueden usar el simulador de reparto en Gestión.'
export const SIMULATION_EXCEEDS_COPY = 'El monto supera lo potencialmente disponible del período.'
export const NO_PARTNERS_COPY = 'No hay socios activos para repartir el componente de socios.'

const BAD_REQUEST_HINTS: Array<[RegExp, string]> = [
  [/requestedAmountMinor/i, 'Revisa el monto: debe ser mayor que cero.'],
  [/partnerShareBps|workShareBps|add up/i, RULE_SUM_ERROR],
  [/workBasis/i, 'Elige la base del trabajo.'],
  [/period|\bfrom\b|\bto\b|YYYY-MM-DD/i, 'Revisa las fechas del período.'],
]

interface ErrorLike {
  response?: { status?: unknown; data?: { code?: unknown; message?: unknown } }
}

function badRequestMessage(error: ErrorLike): string {
  const raw = error.response?.data?.message
  const list = (Array.isArray(raw) ? raw : [raw]).filter((m): m is string => typeof m === 'string')
  const hints = new Set<string>()
  for (const message of list) {
    const hint = BAD_REQUEST_HINTS.find(([pattern]) => pattern.test(message))
    if (hint) hints.add(hint[1])
  }
  return ['Revisa los datos de la simulación.', ...hints].join(' ')
}

/** Spanish message for a failed simulation. Text only; nothing implies something was saved. */
export function simulationErrorMessage(error: unknown, basis: DistributionWorkBasis): string {
  if (isDistributionContractError(error))
    return 'La simulación llegó en un formato inesperado. Avisa al equipo e intenta de nuevo más tarde.'
  if (isMissingRoute(error)) return MISSING_ROUTE_COPY
  const e = error as ErrorLike
  const status = e?.response?.status
  const data = e?.response?.data
  if (status === 401 || status === 403) return ACCESS_COPY
  if (status === 400) return badRequestMessage(e)
  if (status === 422) {
    const code = typeof data?.code === 'string' ? data.code : ''
    if (code === 'FINANCE_DISTRIBUTION_EXCEEDS_AVAILABLE') return SIMULATION_EXCEEDS_COPY
    if (code === 'FINANCE_DISTRIBUTION_NO_PARTNERS') return NO_PARTNERS_COPY
    if (code === 'FINANCE_DISTRIBUTION_NO_WORK') {
      const message = typeof data?.message === 'string' ? data.message : ''
      return basis === 'KNOWN_MINUTES' && /lack a known duration/i.test(message)
        ? 'Hay jornadas, pero ninguna tiene duración registrada. Prueba con la base por jornadas.'
        : 'No hay trabajo registrado en este período para repartir el componente de trabajo. Cambia la regla o el período.'
    }
    return overviewErrorMessage(error)
  }
  if (!e?.response) return `${VOICE.networkError} No se guardó nada.`
  return 'No pudimos calcular la simulación por un problema del servidor. Intenta de nuevo en un momento. No se guardó nada.'
}
