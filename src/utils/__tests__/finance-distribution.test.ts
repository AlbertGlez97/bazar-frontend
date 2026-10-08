import { describe, expect, it } from 'vitest'
import {
  ACCESS_COPY,
  FinanceDistributionContractError,
  GENERIC_WARNING,
  NO_PARTNERS_COPY,
  RULE_FORMAT_ERROR,
  RULE_PRESETS,
  RULE_SUM_ERROR,
  SIMULATION_EXCEEDS_COPY,
  amountState,
  bpsToPercentText,
  buildSimulationRequest,
  isPartialResult,
  parsePercent,
  percentToBps,
  ruleState,
  ruleSummary,
  sameRequest,
  sharePercent,
  simulationErrorMessage,
  simulationExclusiveTo,
  simulatorPreset,
  unknownDurationText,
  visibleWarnings,
  warningText,
  workBreakdownText,
} from '../finance-distribution'
import { MISSING_ROUTE_COPY } from '../finance-overview'
import { memberFixture, simulationFixture } from '@/services/__tests__/finance-distribution.fixture'

const http = (status: number, data: unknown = {}) => ({ response: { status, data } })

describe('period', () => {
  it('turns the inclusive picker end into the exclusive day, across month and year boundaries', () => {
    expect(simulationExclusiveTo('2026-10-31')).toBe('2026-11-01')
    expect(simulationExclusiveTo('2026-12-31')).toBe('2027-01-01')
    expect(simulationExclusiveTo('2028-02-28')).toBe('2028-02-29')
    expect(simulationExclusiveTo('2026-02-28')).toBe('2026-03-01')
  })
  it('makes "mes" the whole civil month and leaves other presets alone', () => {
    const now = new Date('2026-10-07T18:00:00Z')
    expect(simulatorPreset('mes', now)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(simulatorPreset('hoy', now)).toEqual({ from: '2026-10-07', to: '2026-10-07' })
  })
})

describe('rule', () => {
  it('converts integer percentages to basis points exactly', () => {
    expect(percentToBps(50)).toBe(5000)
    expect(percentToBps(33)).toBe(3300)
    expect(percentToBps(0)).toBe(0)
    expect(percentToBps(100)).toBe(10000)
  })
  it('shows basis points back as a percentage without floats', () => {
    expect(bpsToPercentText(5000)).toBe('50')
    expect(bpsToPercentText(2550)).toBe('25.5')
    expect(bpsToPercentText(2505)).toBe('25.05')
    expect(bpsToPercentText(0)).toBe('0')
  })
  it.each([
    ['0', 0],
    ['50', 50],
    [' 100 ', 100],
    ['101', null],
    ['-1', null],
    ['12.5', null],
    ['1e1', null],
    ['', null],
    ['abc', null],
  ])('parses percent %j as %j', (text, expected) => {
    expect(parsePercent(text)).toBe(expected)
  })
  it('accepts every preset and they all add up to 100', () => {
    for (const p of RULE_PRESETS) {
      const state = ruleState(String(p.partner), String(p.work))
      expect(state).toMatchObject({ valid: true, total: 100, error: '' })
    }
    expect(RULE_PRESETS.map((p) => `${p.partner}/${p.work}`)).toEqual(['50/50', '60/40', '70/30', '100/0', '0/100'])
  })
  it('blocks a total that is not 100 with the inline error and shows the live total', () => {
    expect(ruleState('60', '50')).toMatchObject({ valid: false, total: 110, error: RULE_SUM_ERROR })
    expect(ruleState('30', '30')).toMatchObject({ valid: false, total: 60, error: RULE_SUM_ERROR })
  })
  it('flags non-integer text and stays quiet (but invalid) while a part is empty', () => {
    expect(ruleState('50.5', '49.5')).toMatchObject({ valid: false, error: RULE_FORMAT_ERROR })
    expect(ruleState('abc', '50')).toMatchObject({ valid: false, error: RULE_FORMAT_ERROR })
    expect(ruleState('', '')).toMatchObject({ valid: false, total: 0, error: '' })
    expect(ruleState('50', '')).toMatchObject({ valid: false, total: 50, error: '' })
  })
})

describe('amount', () => {
  it('reads es-MX money into positive cents', () => {
    expect(amountState('6,000', null)).toEqual({ minor: 600000, error: '' })
    expect(amountState('0.01', null).minor).toBe(1)
  })
  it('keeps empty quiet, rejects zero, ambiguous text and too-large amounts', () => {
    expect(amountState('', null)).toEqual({ minor: null, error: '' })
    expect(amountState('0', null).error).toMatch(/mayor que cero/)
    expect(amountState('100,50', null).error).toMatch(/monto válido/)
    expect(amountState('21474837', null).error).toMatch(/demasiado grande/)
  })
  it('caps at the known available amount and says the maximum', () => {
    expect(amountState('8,000.00', 800000)).toEqual({ minor: 800000, error: '' })
    const over = amountState('8,000.01', 800000)
    expect(over.minor).toBeNull()
    expect(over.error).toContain('Máximo: $8,000.00')
  })
})

describe('request', () => {
  const inputs = {
    period: { from: '2026-10-01', to: '2026-10-31' },
    amountMinor: 600000,
    partnerPercent: 50,
    workPercent: 50,
    workBasis: 'WORK_SHIFTS' as const,
  }
  it('sends an exclusive end, integer bps and exactly the six fields', () => {
    const request = buildSimulationRequest(inputs)
    expect(request).toEqual({
      from: '2026-10-01',
      to: '2026-11-01',
      requestedAmountMinor: 600000,
      partnerShareBps: 5000,
      workShareBps: 5000,
      workBasis: 'WORK_SHIFTS',
    })
    expect(Object.keys(request)).toHaveLength(6)
  })
  it('maps the hours basis and a year-end period', () => {
    const request = buildSimulationRequest({
      ...inputs,
      period: { from: '2026-12-01', to: '2026-12-31' },
      workBasis: 'KNOWN_MINUTES',
      partnerPercent: 70,
      workPercent: 30,
    })
    expect(request).toMatchObject({ to: '2027-01-01', workBasis: 'KNOWN_MINUTES', partnerShareBps: 7000, workShareBps: 3000 })
  })
  it('compares requests field by field', () => {
    const a = buildSimulationRequest(inputs)
    expect(sameRequest(a, { ...a })).toBe(true)
    expect(sameRequest(a, { ...a, workBasis: 'KNOWN_MINUTES' })).toBe(false)
    expect(sameRequest(a, { ...a, requestedAmountMinor: 1 })).toBe(false)
    expect(sameRequest(a, null)).toBe(false)
    expect(sameRequest(null, null)).toBe(false)
  })
})

describe('result display', () => {
  const s = simulationFixture()
  it('shows integer share percentages (display only)', () => {
    expect(sharePercent(2, 5)).toBe(40)
    expect(sharePercent(3, 5)).toBe(60)
    expect(sharePercent(1, 3)).toBe(33)
    expect(sharePercent(2, 3)).toBe(67)
    expect(sharePercent(0, 5)).toBe(0)
    expect(sharePercent(1, 0)).toBe(0)
  })
  it('explains the work weight by shifts', () => {
    expect(workBreakdownText(s.members[0]!, 'WORK_SHIFTS', s.members)).toBe('2 de 5 jornadas · 40%')
    expect(workBreakdownText(s.members[1]!, 'WORK_SHIFTS', s.members)).toBe('3 de 5 jornadas · 60%')
    const solo = [memberFixture({ shiftCount: 1 })]
    expect(workBreakdownText(solo[0]!, 'WORK_SHIFTS', solo)).toBe('1 de 1 jornada · 100%')
  })
  it('explains the work weight by known hours and handles a member with none', () => {
    const members = [
      memberFixture({ knownMinutes: 90 }),
      memberFixture({ memberId: 'b', knownMinutes: 150 }),
      memberFixture({ memberId: 'c', knownMinutes: 0 }),
    ]
    expect(workBreakdownText(members[0]!, 'KNOWN_MINUTES', members)).toBe('1 h 30 min de 4 h · 38%')
    expect(workBreakdownText(members[2]!, 'KNOWN_MINUTES', members)).toBe('0 h de 4 h · 0%')
  })
  it('counts jornadas sin duración', () => {
    expect(unknownDurationText(0)).toBe('')
    expect(unknownDurationText(1)).toBe('1 jornada sin duración registrada')
    expect(unknownDurationText(2)).toBe('2 jornadas sin duración registrada')
  })
  it('summarises the rule from the response', () => {
    expect(ruleSummary(s.rule)).toBe('50% por ser socio · 50% por trabajo · Base: Jornadas')
  })
  it('detects a partial base by status or by warning', () => {
    expect(isPartialResult(s)).toBe(false)
    expect(isPartialResult(simulationFixture({ financialBase: { ...s.financialBase, status: 'partial' } }))).toBe(true)
    expect(isPartialResult(simulationFixture({ warnings: [{ code: 'OPERATING_RESULT_PARTIAL', message: 'x' }] }))).toBe(true)
  })
})

describe('warnings', () => {
  const codes = [
    'SIMULATION_ONLY',
    'NOT_A_PAYMENT_OR_OBLIGATION',
    'OPERATING_RESULT_PARTIAL',
    'MISSING_SALE_COST',
    'PARTNER_ELIGIBILITY_IS_CURRENT_STATE',
    'WORK_SHIFTS_WITHOUT_DURATION',
    'INACTIVE_MEMBER_RECEIVES_WORK_AMOUNT',
  ]
  const s = simulationFixture({
    members: [memberFixture({ unknownDurationCount: 2 })],
    warnings: codes.map((code) => ({ code, message: `English ${code}` })),
  })
  it('maps all seven codes to Spanish and never leaks the English message', () => {
    for (const w of s.warnings) {
      const text = warningText(w, s)
      expect(text).not.toBe(GENERIC_WARNING)
      expect(text).not.toContain('English')
    }
    expect(warningText({ code: 'WORK_SHIFTS_WITHOUT_DURATION', message: '' }, s)).toContain('2 jornadas sin duración registrada')
  })
  it('uses neutral text for an unknown code', () => {
    expect(warningText({ code: 'NEW_THING', message: '<b>x</b>' }, s)).toBe(GENERIC_WARNING)
  })
  it('hides the codes the disclaimer and the partial alert already cover, deduplicated', () => {
    const texts = visibleWarnings({ ...s, warnings: [...s.warnings, ...s.warnings] })
    expect(texts).toHaveLength(3)
    expect(texts.join(' ')).toMatch(/socios activos de hoy/)
    expect(texts.join(' ')).toMatch(/persona inactiva/)
  })
})

describe('simulationErrorMessage', () => {
  it('maps access errors to the calm access message', () => {
    expect(simulationErrorMessage(http(401), 'WORK_SHIFTS')).toBe(ACCESS_COPY)
    expect(simulationErrorMessage(http(403), 'WORK_SHIFTS')).toBe(ACCESS_COPY)
  })
  it('maps 400 with array or string messages to field hints', () => {
    const list = simulationErrorMessage(
      http(400, { message: ['requestedAmountMinor must not be less than 1', 'partnerShareBps and workShareBps must add up to 10000'] }),
      'WORK_SHIFTS',
    )
    expect(list).toContain('Revisa los datos de la simulación.')
    expect(list).toContain('Revisa el monto')
    expect(list).toContain(RULE_SUM_ERROR)
    expect(simulationErrorMessage(http(400, { message: 'Both period dates must be valid YYYY-MM-DD values' }), 'WORK_SHIFTS')).toContain('fechas')
    expect(simulationErrorMessage(http(400, { message: 'weird' }), 'WORK_SHIFTS')).toBe('Revisa los datos de la simulación.')
    expect(simulationErrorMessage(http(400), 'WORK_SHIFTS')).toBe('Revisa los datos de la simulación.')
  })
  it('maps the 422 distribution codes', () => {
    expect(simulationErrorMessage(http(422, { code: 'FINANCE_DISTRIBUTION_EXCEEDS_AVAILABLE' }), 'WORK_SHIFTS')).toBe(SIMULATION_EXCEEDS_COPY)
    expect(simulationErrorMessage(http(422, { code: 'FINANCE_DISTRIBUTION_NO_PARTNERS' }), 'WORK_SHIFTS')).toBe(NO_PARTNERS_COPY)
    expect(
      simulationErrorMessage(http(422, { code: 'FINANCE_DISTRIBUTION_NO_WORK', message: 'No active work shifts are registered in the period' }), 'WORK_SHIFTS'),
    ).toMatch(/^No hay trabajo registrado en este período/)
  })
  it('explains hours with no duration only for the hours basis', () => {
    const data = {
      code: 'FINANCE_DISTRIBUTION_NO_WORK',
      message: 'All shifts of the period lack a known duration, so KNOWN_MINUTES has no work to weigh',
    }
    expect(simulationErrorMessage(http(422, data), 'KNOWN_MINUTES')).toBe(
      'Hay jornadas, pero ninguna tiene duración registrada. Prueba con la base por jornadas.',
    )
    expect(simulationErrorMessage(http(422, data), 'WORK_SHIFTS')).toMatch(/^No hay trabajo registrado/)
  })
  it('reuses the overview copy for overview 422 codes', () => {
    expect(simulationErrorMessage(http(422, { code: 'FINANCE_OVERVIEW_OVERFLOW' }), 'WORK_SHIFTS')).toMatch(/periodo más corto/)
    expect(simulationErrorMessage(http(422, { code: 'FINANCE_OVERVIEW_INVALID_EXPENSE_NATURE' }), 'WORK_SHIFTS')).toMatch(/tipo no reconocido/)
  })
  it('keeps contract, missing-route, network and server failures calm and never implies saving', () => {
    expect(simulationErrorMessage(new FinanceDistributionContractError(), 'WORK_SHIFTS')).toMatch(/formato inesperado/)
    expect(simulationErrorMessage(http(404), 'WORK_SHIFTS')).toBe(MISSING_ROUTE_COPY)
    expect(simulationErrorMessage(new Error('Network Error'), 'WORK_SHIFTS')).toMatch(/No se guardó nada/)
    expect(simulationErrorMessage(http(500), 'WORK_SHIFTS')).toMatch(/No se guardó nada/)
  })
})
