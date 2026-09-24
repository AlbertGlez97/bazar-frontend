import { describe, it, expect } from 'vitest'
import {
  totalBudgetedIncome,
  totalActualIncome,
} from '@/services/calculators/income.calculator'
import type { Income } from '@/types/budget.types'

const mkIncome = (overrides: Partial<Income> = {}): Income => ({
  id: 'i-1', name: 'Salario', budgeted: 20000, actual: 20000,
  budgetId: 'budget-1', createdAt: '2026-01-01',
  ...overrides,
})

describe('income.calculator', () => {
  describe('totalBudgetedIncome()', () => {
    it('suma los presupuestados de todos los ingresos', () => {
      const incomes = [mkIncome({ budgeted: 20000 }), mkIncome({ budgeted: 5000 })]
      expect(totalBudgetedIncome(incomes)).toBe(25000)
    })

    it('retorna 0 con array vacío', () => {
      expect(totalBudgetedIncome([])).toBe(0)
    })

    it('funciona con un solo ingreso', () => {
      expect(totalBudgetedIncome([mkIncome({ budgeted: 18000 })])).toBe(18000)
    })
  })

  describe('totalActualIncome()', () => {
    it('suma los actuales de todos los ingresos', () => {
      const incomes = [mkIncome({ actual: 20000 }), mkIncome({ actual: 3000 })]
      expect(totalActualIncome(incomes)).toBe(23000)
    })

    it('retorna 0 con array vacío', () => {
      expect(totalActualIncome([])).toBe(0)
    })

    it('retorna 0 si todos los ingresos tienen actual en 0', () => {
      expect(totalActualIncome([mkIncome({ actual: 0 })])).toBe(0)
    })
  })
})
