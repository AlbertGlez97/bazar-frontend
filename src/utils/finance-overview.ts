import { addDaysToKey } from '@/utils/business-time'
import { formatMinorMoney } from '@/utils/money'
import { VOICE } from '@/config/voice'
import type { FinanceOverview, FinanceOverviewWarning } from '@/types/finance-overview.types'

/** The picker emits INCLUSIVE end days; the API reads `[from,to)`, so send the next day. */
export const overviewExclusiveTo = (pickerTo: string): string => addDaysToKey(pickerTo, 1)

type Coverage = FinanceOverview['costCoverage']

/** Whole-number percentage of lines with a known cost; never rounds a partial coverage up to 100. */
export function knownCostPercent(c: Coverage): number | null {
  if (c.knownCostLinePercentage === null) return null
  const rounded = Math.round(c.knownCostLinePercentage)
  return c.missingCostLineCount > 0 ? Math.min(rounded, 99) : rounded
}

/** Whole-number percentage of lines without a known cost; at least 1 when any is missing. */
export function missingCostPercent(c: Coverage): number {
  if (c.missingCostLineCount <= 0 || c.totalLineCount <= 0) return 0
  return Math.min(100, Math.max(1, Math.round((c.missingCostLineCount / c.totalLineCount) * 100)))
}

/** `Cobertura de costos: 92%` or `Cobertura de costos: Sin líneas de venta`. */
export function coverageText(c: Coverage): string {
  const pct = knownCostPercent(c)
  return `Cobertura de costos: ${pct === null ? 'Sin líneas de venta' : `${pct}%`}`
}

/** `8% de las líneas no tienen costo conocido.` (empty when nothing is missing). */
export function missingCoverageText(c: Coverage): string {
  const pct = missingCostPercent(c)
  return pct ? `${pct}% de las líneas no tienen costo conocido.` : ''
}

/** Label for figures that depend on sold-item cost. */
export const partialSuffix = (status: 'complete' | 'partial'): string =>
  status === 'partial' ? ' (parcial)' : ''

/** Negative amounts read aloud with words, not just a minus sign. */
export function moneyForScreenReader(minor: number): string {
  return minor < 0 ? `menos ${formatMinorMoney(-minor)}` : formatMinorMoney(minor)
}

export const hasRecordedActivity = (o: FinanceOverview): boolean =>
  o.sales.saleCount > 0 ||
  o.expenses.operatingMinor !== 0 ||
  o.expenses.inventoryPurchasesMinor !== 0 ||
  o.contributions.count > 0 ||
  o.workShifts.shiftCount > 0

/** Codes the view already explains with its own copy: showing them again would duplicate. */
const COVERED_BY_VIEW = new Set([
  'MISSING_SALE_COST',
  'NOT_CASH_OR_WITHDRAWABLE_PROFIT',
  'RESERVES_PENDING',
])
const FRIENDLY: Record<string, string> = {
  SYNC_TIME_COST_NO_LOT_VALUATION:
    'El costo vendido es el que se registró cuando el servidor procesó cada venta; no es una valuación por lote al momento de la venta.',
}

/** Backend warnings the view does not already cover, in friendly Spanish (message as fallback). */
export function extraWarnings(warnings: readonly FinanceOverviewWarning[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const w of warnings) {
    if (COVERED_BY_VIEW.has(w.code) || seen.has(w.code)) continue
    seen.add(w.code)
    out.push(FRIENDLY[w.code] ?? w.message)
  }
  return out
}

const ERROR_COPY: Record<string, string> = {
  FINANCE_OVERVIEW_OVERFLOW:
    'Los montos de este periodo son demasiado grandes para calcularse con exactitud. Elige un periodo más corto.',
  FINANCE_OVERVIEW_INVALID_RECORDED_SALE:
    'Hay una venta con datos incompletos y no se puede calcular el resumen. Avisa a soporte.',
  FINANCE_OVERVIEW_INVALID_EXPENSE_NATURE:
    'Hay un gasto con un tipo no reconocido y no se puede calcular el resumen. Avisa a soporte.',
}

/** The server answered 2xx but the body is not the contract this screen understands. */
export class FinanceOverviewContractError extends Error {
  constructor() {
    super('Invalid finance overview response')
    this.name = 'FinanceOverviewContractError'
  }
}
export const isContractError = (error: unknown): boolean => error instanceof FinanceOverviewContractError

const CONTRACT_ERROR_COPY =
  'El resumen llegó en un formato inesperado. Avisa al equipo e intenta de nuevo más tarde.'

/** Spanish message for a failed overview request. */
export function overviewErrorMessage(error: unknown): string {
  if (isContractError(error)) return CONTRACT_ERROR_COPY
  const data = (error as { response?: { data?: { code?: unknown; message?: unknown } } })?.response?.data
  const code = typeof data?.code === 'string' ? data.code : typeof data?.message === 'string' ? data.message : ''
  if (ERROR_COPY[code]) return ERROR_COPY[code]
  const hasResponse = !!(error as { response?: unknown })?.response
  return hasResponse ? VOICE.genericError : VOICE.networkError
}
