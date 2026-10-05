import type {
  Expense,
  ExpensePayload,
  ExpenseReversalPayload,
} from '@/types/expense.types'
import type { FinanceOrigin } from './contributions-records'

export type ExpenseOperation =
  | { kind: 'create'; payload: ExpensePayload }
  | { kind: 'reverse'; expenseId: string; payload: ExpenseReversalPayload }

export type PendingExpense = ExpenseOperation & {
  key: string
  scope: string
  id: string
  origin: FinanceOrigin
  createdAt: string
  state: 'pending' | 'needs_review' | 'paused'
  attempts: number
  nextAttemptAt: number
  lastError?: string
}

export interface ExpenseHistory {
  key: string
  scope: string
  expense: Expense
}
