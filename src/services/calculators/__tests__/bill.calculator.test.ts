import { describe, it, expect } from 'vitest'
import {
  totalBudgetedBills,
  totalActualBills,
} from '@/services/calculators/bill.calculator'
import type { Bill } from '@/types/budget.types'

const mkBill = (overrides: Partial<Bill> = {}): Bill => ({
  id: 'b-1', name: 'Renta', budgeted: 5000, actual: 4800,
  isPaid: false, paymentType: null, dueDate: null,
  budgetId: 'budget-1', createdAt: '2026-01-01',
  ...overrides,
})

describe('bill.calculator', () => {
  describe('totalBudgetedBills()', () => {
    it('suma los presupuestados de todas las facturas', () => {
      const bills = [mkBill({ budgeted: 5000 }), mkBill({ budgeted: 3000 })]
      expect(totalBudgetedBills(bills)).toBe(8000)
    })

    it('retorna 0 con array vacío', () => {
      expect(totalBudgetedBills([])).toBe(0)
    })

    it('funciona con una sola factura', () => {
      expect(totalBudgetedBills([mkBill({ budgeted: 1200 })])).toBe(1200)
    })
  })

  describe('totalActualBills()', () => {
    it('suma los actuales de todas las facturas', () => {
      const bills = [mkBill({ actual: 4800 }), mkBill({ actual: 2900 })]
      expect(totalActualBills(bills)).toBe(7700)
    })

    it('retorna 0 con array vacío', () => {
      expect(totalActualBills([])).toBe(0)
    })

    it('retorna 0 si todas las facturas tienen actual en 0', () => {
      const bills = [mkBill({ actual: 0 }), mkBill({ actual: 0 })]
      expect(totalActualBills(bills)).toBe(0)
    })
  })
})
