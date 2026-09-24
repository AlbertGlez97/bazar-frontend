import type { Income } from '@/types/budget.types'

/** Suma todos los ingresos presupuestados */
export function totalBudgetedIncome(incomes: Income[]): number {
  return incomes.reduce((sum, i) => sum + i.budgeted, 0)
}

/** Suma todos los ingresos reales */
export function totalActualIncome(incomes: Income[]): number {
  return incomes.reduce((sum, i) => sum + i.actual, 0)
}
