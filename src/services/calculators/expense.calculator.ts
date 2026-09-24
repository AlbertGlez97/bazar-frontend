import type { Expense, Transaction } from '@/types/budget.types'

/** Suma el presupuestado de todos los gastos */
export function totalBudgetedExpenses(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.budgeted, 0)
}

/** Calcula el actual de un expense sumando sus transacciones */
export function actualForExpense(transactions: Transaction[], category: string): number {
  return transactions
    .filter(tx => tx.category === category)
    .reduce((sum, tx) => sum + tx.amount, 0)
}

/** Agrupa transacciones por categoria y calcula totales */
export function expenseActuals(expenses: Expense[], transactions: Transaction[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const exp of expenses) {
    map.set(exp.category, actualForExpense(transactions, exp.category))
  }
  return map
}

/** Total gastado = suma de todas las transacciones */
export function totalSpent(transactions: Transaction[]): number {
  return transactions.reduce((sum, tx) => sum + tx.amount, 0)
}
