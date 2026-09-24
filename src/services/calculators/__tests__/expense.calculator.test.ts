import { describe, it, expect } from 'vitest'
import {
  totalBudgetedExpenses,
  actualForExpense,
  expenseActuals,
  totalSpent,
} from '@/services/calculators/expense.calculator'
import type { Expense, Transaction } from '@/types/budget.types'

const mkExpense = (overrides: Partial<Expense> = {}): Expense => ({
  id: 'e-1', category: 'mercado', budgeted: 3000, actual: 0,
  paymentType: null, budgetId: 'budget-1', createdAt: '2026-01-01',
  ...overrides,
})

const mkTx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1', amount: 500, category: 'mercado', paymentType: null,
  note: null, date: '2026-07-10', budgetId: 'budget-1', createdAt: '2026-07-10',
  ...overrides,
})

describe('expense.calculator', () => {
  describe('totalBudgetedExpenses()', () => {
    it('suma todos los presupuestados de gastos variables', () => {
      const expenses = [mkExpense({ budgeted: 3000 }), mkExpense({ budgeted: 2000 })]
      expect(totalBudgetedExpenses(expenses)).toBe(5000)
    })

    it('retorna 0 con array vacío', () => {
      expect(totalBudgetedExpenses([])).toBe(0)
    })
  })

  describe('actualForExpense()', () => {
    it('suma solo las transacciones de la categoría dada', () => {
      const txs = [
        mkTx({ category: 'mercado', amount: 300 }),
        mkTx({ category: 'mercado', amount: 200 }),
        mkTx({ category: 'restaurante', amount: 500 }),
      ]
      expect(actualForExpense(txs, 'mercado')).toBe(500)
    })

    it('retorna 0 cuando no hay transacciones para esa categoría', () => {
      const txs = [mkTx({ category: 'restaurante', amount: 500 })]
      expect(actualForExpense(txs, 'mercado')).toBe(0)
    })

    it('retorna 0 con array de transacciones vacío', () => {
      expect(actualForExpense([], 'mercado')).toBe(0)
    })
  })

  describe('expenseActuals()', () => {
    it('devuelve un Map con el total actual por categoría', () => {
      const expenses = [
        mkExpense({ category: 'mercado' }),
        mkExpense({ id: 'e-2', category: 'restaurante' }),
      ]
      const txs = [
        mkTx({ category: 'mercado',     amount: 400 }),
        mkTx({ category: 'mercado',     amount: 100 }),
        mkTx({ category: 'restaurante', amount: 250 }),
      ]
      const result = expenseActuals(expenses, txs)
      expect(result.get('mercado')).toBe(500)
      expect(result.get('restaurante')).toBe(250)
    })

    it('mapea 0 para categorías sin transacciones', () => {
      const expenses = [mkExpense({ category: 'vacaciones' })]
      const result   = expenseActuals(expenses, [])
      expect(result.get('vacaciones')).toBe(0)
    })

    it('retorna Map vacío si no hay gastos', () => {
      expect(expenseActuals([], []).size).toBe(0)
    })
  })

  describe('totalSpent()', () => {
    it('suma el amount de todas las transacciones', () => {
      const txs = [mkTx({ amount: 300 }), mkTx({ amount: 200 }), mkTx({ amount: 100 })]
      expect(totalSpent(txs)).toBe(600)
    })

    it('retorna 0 con array vacío', () => {
      expect(totalSpent([])).toBe(0)
    })
  })
})
