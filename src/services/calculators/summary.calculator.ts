import type { Income, Bill, Expense, Transaction, BudgetSummary } from '@/types/budget.types'
import { totalBudgetedIncome } from './income.calculator'
import { totalBudgetedBills, totalActualBills } from './bill.calculator'
import { totalBudgetedExpenses, totalSpent } from './expense.calculator'

/**
 * Calcula el resumen financiero completo del presupuesto.
 * Aplica la regla 50/30/20 sobre el ingreso presupuestado.
 */
export function calculateSummary(
  incomes: Income[],
  bills: Bill[],
  expenses: Expense[],
  transactions: Transaction[],
  budgetRule?: { necesidades: number; deseos: number; ahorro: number },
): BudgetSummary {
  const rule = budgetRule ?? { necesidades: 50, deseos: 30, ahorro: 20 }

  const totalIngresos = totalBudgetedIncome(incomes)
  const totalFacturas = totalActualBills(bills)
  const totalGastosFijos = totalBudgetedBills(bills)
  const totalGastosVariables = totalBudgetedExpenses(expenses)
  const totalGastado = totalFacturas + totalSpent(transactions)
  const disponible = totalIngresos - totalGastado

  return {
    totalIngresos,
    totalFacturas,
    totalGastosFijos,
    totalGastosVariables,
    totalGastado,
    disponible,
    regla: {
      necesidades: {
        limite: totalIngresos * (rule.necesidades / 100),
        actual: totalFacturas + totalSpent(transactions),
        porcentaje: rule.necesidades,
      },
      deseos: {
        limite: totalIngresos * (rule.deseos / 100),
        actual: 0, // Se refinara cuando se trackeen tipos de gasto
        porcentaje: rule.deseos,
      },
      ahorro: {
        limite: totalIngresos * (rule.ahorro / 100),
        actual: disponible > 0 ? disponible : 0,
        porcentaje: rule.ahorro,
      },
    },
  }
}
