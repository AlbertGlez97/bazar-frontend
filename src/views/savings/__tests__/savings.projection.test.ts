import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { computeGoalProjection } from '@/views/savings/savings.projection'
import type { SavingFrequency } from '@/types/savings.types'

// ── Tipo auxiliar ──────────────────────────────────────────────────────────
type ProjectableGoal = {
  frequency:                  SavingFrequency
  minimumMonthlyContribution: number
  currentAmount:              number
  targetAmount:               number
}

const mkGoal = (overrides: Partial<ProjectableGoal> = {}): ProjectableGoal => ({
  frequency:                  'mensual',
  minimumMonthlyContribution: 1000,
  currentAmount:              0,
  targetAmount:               12000,
  ...overrides,
})

// Fijar fecha para que fechaEstimada sea determinista
const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z')
let _originalDate: typeof Date

beforeAll(() => {
  _originalDate = globalThis.Date as typeof Date
  // @ts-expect-error — override parcial para test
  globalThis.Date = class extends _originalDate {
    constructor(...args: ConstructorParameters<typeof _originalDate>) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (args.length === 0) { super(FIXED_DATE.toISOString()); return }
      // @ts-expect-error
      super(...args)
    }
  }
})

afterAll(() => {
  globalThis.Date = _originalDate
})

describe('computeGoalProjection()', () => {
  it('meta cumplida cuando currentAmount >= targetAmount', () => {
    const p = computeGoalProjection(mkGoal({ currentAmount: 12000, targetAmount: 12000 }))
    expect(p.cumplida).toBe(true)
    expect(p.mesesRestantes).toBe(0)
    expect(p.aporteMensualEfectivo).toBe(0)
    expect(p.fechaEstimada).toBeNull()
  })

  it('meta cumplida cuando currentAmount > targetAmount', () => {
    const p = computeGoalProjection(mkGoal({ currentAmount: 15000, targetAmount: 12000 }))
    expect(p.cumplida).toBe(true)
  })

  it('frecuencia mensual — calcula meses correctamente', () => {
    // 12000 - 0 = 12000 faltante / 1000 mensual = 12 meses
    const p = computeGoalProjection(mkGoal({ frequency: 'mensual', minimumMonthlyContribution: 1000 }))
    expect(p.cumplida).toBe(false)
    expect(p.mesesRestantes).toBe(12)
    expect(p.aporteMensualEfectivo).toBe(1000)
    expect(p.esAporteUnico).toBe(false)
    expect(p.fechaEstimada).toBeTruthy()
  })

  it('frecuencia quincenal — multiplica aporte × 2', () => {
    const p = computeGoalProjection(mkGoal({ frequency: 'quincenal', minimumMonthlyContribution: 500 }))
    expect(p.aporteMensualEfectivo).toBe(1000) // 500 × 2
    expect(p.mesesRestantes).toBe(12)
  })

  it('frecuencia semanal — multiplica aporte × 13/3', () => {
    const p = computeGoalProjection(mkGoal({
      frequency: 'semanal',
      minimumMonthlyContribution: 300,
      targetAmount: 1300,
      currentAmount: 0,
    }))
    // 300 × 13/3 = 1300 → pero fijamos con .toFixed(2)
    expect(p.aporteMensualEfectivo).toBeCloseTo(1300, 0)
    expect(p.mesesRestantes).toBe(1)
  })

  it('frecuencia unico — no proyecta meses ni fecha', () => {
    const p = computeGoalProjection(mkGoal({ frequency: 'unico' }))
    expect(p.esAporteUnico).toBe(true)
    expect(p.mesesRestantes).toBeNull()
    expect(p.fechaEstimada).toBeNull()
    expect(p.cumplida).toBe(false)
  })

  it('aporte 0 en frecuencia no-unico — tampoco proyecta', () => {
    const p = computeGoalProjection(mkGoal({ frequency: 'mensual', minimumMonthlyContribution: 0 }))
    expect(p.mesesRestantes).toBeNull()
    expect(p.fechaEstimada).toBeNull()
    expect(p.esAporteUnico).toBe(false)
  })

  it('usa Math.ceil para redondear meses hacia arriba', () => {
    // 10000 faltante / 3000 mensual = 3.33 → ceil = 4
    const p = computeGoalProjection(mkGoal({
      targetAmount: 10000,
      currentAmount: 0,
      minimumMonthlyContribution: 3000,
    }))
    expect(p.mesesRestantes).toBe(4)
  })

  it('la fechaEstimada tiene formato YYYY-MM-DD', () => {
    const p = computeGoalProjection(mkGoal())
    expect(p.fechaEstimada).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
