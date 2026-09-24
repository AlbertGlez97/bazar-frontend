import type { Bill } from '@/types/budget.types'

/** Suma el presupuestado de todas las facturas */
export function totalBudgetedBills(bills: Bill[]): number {
  return bills.reduce((sum, b) => sum + b.budgeted, 0)
}

/** Suma el actual de todas las facturas */
export function totalActualBills(bills: Bill[]): number {
  return bills.reduce((sum, b) => sum + b.actual, 0)
}
