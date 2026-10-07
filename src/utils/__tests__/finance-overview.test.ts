import { describe, expect, it } from 'vitest'
import {
  coverageText,
  extraWarnings,
  hasRecordedActivity,
  knownCostPercent,
  missingCoverageText,
  missingCostPercent,
  moneyForScreenReader,
  overviewErrorMessage,
  FinanceOverviewContractError,
  isContractError,
  overviewExclusiveTo,
  partialSuffix,
} from '../finance-overview'
import { overviewFixture } from '@/services/__tests__/finance-overview.fixture'

const cov = (over: Partial<ReturnType<typeof overviewFixture>['costCoverage']>) => ({
  ...overviewFixture().costCoverage,
  ...over,
})

describe('finance overview utils', () => {
  it('sends the day after the picker end as the exclusive end', () => {
    expect(overviewExclusiveTo('2026-10-07')).toBe('2026-10-08')
    expect(overviewExclusiveTo('2026-10-31')).toBe('2026-11-01')
    expect(overviewExclusiveTo('2026-12-31')).toBe('2027-01-01')
  })

  it('formats coverage and its complement', () => {
    const partial = cov({
      status: 'partial',
      totalLineCount: 25,
      knownCostLineCount: 23,
      missingCostLineCount: 2,
      knownCostLinePercentage: 92,
    })
    expect(coverageText(partial)).toBe('Cobertura de costos: 92%')
    expect(missingCoverageText(partial)).toBe('8% de las líneas no tienen costo conocido.')
  })

  it('has a label for no sale lines and says nothing is missing when complete', () => {
    const none = cov({ totalLineCount: 0, knownCostLineCount: 0, knownCostLinePercentage: null })
    expect(coverageText(none)).toBe('Cobertura de costos: Sin líneas de venta')
    expect(missingCoverageText(none)).toBe('')
    expect(missingCoverageText(cov({}))).toBe('')
  })

  it('never shows a partial coverage as 100% nor a missing share as 0%', () => {
    const almost = cov({
      status: 'partial',
      totalLineCount: 1000,
      knownCostLineCount: 999,
      missingCostLineCount: 1,
      knownCostLinePercentage: 99.9,
    })
    expect(knownCostPercent(almost)).toBe(99)
    expect(missingCostPercent(almost)).toBe(1)
    expect(knownCostPercent(cov({ knownCostLinePercentage: 100 }))).toBe(100)
  })

  it('labels partial figures', () => {
    expect(partialSuffix('partial')).toBe(' (parcial)')
    expect(partialSuffix('complete')).toBe('')
  })

  it('reads negative money with words', () => {
    expect(moneyForScreenReader(-12550)).toBe('menos $125.50')
    expect(moneyForScreenReader(12550)).toBe('$125.50')
  })

  it('detects an empty period', () => {
    const empty = overviewFixture({
      sales: { saleCount: 0, salesMinor: 0, recordedCostMinor: 0, recordedGrossMarginMinor: 0 },
      expenses: { operatingMinor: 0, inventoryPurchasesMinor: 0 },
      contributions: { amountMinor: 0, count: 0 },
      workShifts: { shiftCount: 0, knownMinutes: 0, unknownDurationCount: 0 },
    })
    expect(hasRecordedActivity(empty)).toBe(false)
    expect(hasRecordedActivity(overviewFixture())).toBe(true)
    expect(
      hasRecordedActivity({ ...empty, reserves: { activeCount: 1, plannedMinor: 5000, matching: 'EXACT_PERIOD' } }),
    ).toBe(true)
  })

  it('drops warnings the view already explains, maps known ones and falls back to the message', () => {
    const out = extraWarnings([
      { code: 'MISSING_SALE_COST', message: 'a' },
      { code: 'NOT_CASH_OR_WITHDRAWABLE_PROFIT', message: 'b' },
      { code: 'RESERVES_PENDING', message: 'c' },
      { code: 'SYNC_TIME_COST_NO_LOT_VALUATION', message: 'd' },
      { code: 'SYNC_TIME_COST_NO_LOT_VALUATION', message: 'd' },
      { code: 'SOMETHING_NEW', message: 'Texto del servidor' },
    ])
    expect(out).toHaveLength(2)
    expect(out[0]).toContain('valuación por lote')
    expect(out[1]).toBe('Texto del servidor')
  })

  it('maps overview errors to Spanish', () => {
    expect(overviewErrorMessage({ response: { data: { code: 'FINANCE_OVERVIEW_OVERFLOW' } } })).toContain('periodo más corto')
    expect(overviewErrorMessage({ response: { status: 500, data: {} } })).toMatch(/Algo salió mal/)
    expect(overviewErrorMessage(new Error('Network Error'))).toMatch(/No pudimos conectarnos/)
    expect(overviewErrorMessage({ response: { status: 422, data: { code: 'FINANCE_OVERVIEW_INVALID_EXPENSE_NATURE' } } })).toContain('gasto')
  })

  it('maps a contract mismatch to its own non-network message', () => {
    const message = overviewErrorMessage(new FinanceOverviewContractError())
    expect(message).toContain('formato inesperado')
    expect(message).not.toMatch(/conectarnos|internet/)
    expect(isContractError(new FinanceOverviewContractError())).toBe(true)
    expect(isContractError(new Error('Network Error'))).toBe(false)
    expect(isContractError({ response: { status: 500 } })).toBe(false)
  })
})
