import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/api', () => ({
  default: {
    get:    vi.fn(),
    post:   vi.fn(),
    patch:  vi.fn(),
    delete: vi.fn(),
  },
}))

import api from '@/services/api'
import BudgetService from '@/services/budget.service'

const mockGet    = vi.mocked(api.get)
const mockPost   = vi.mocked(api.post)
const mockPatch  = vi.mocked(api.patch)
const mockDelete = vi.mocked(api.delete)

const enc = (v = 'enc') => ({ iv: 'iv-' + v, ct: 'ct-' + v })

describe('BudgetService', () => {
  beforeEach(() => vi.clearAllMocks())

  // ── Presupuesto ─────────────────────────────────────────────────────────

  it('getAll() GET /budgets', async () => {
    mockGet.mockResolvedValue({ data: [] })
    const result = await BudgetService.getAll()
    expect(mockGet).toHaveBeenCalledWith('/budgets')
    expect(result).toEqual([])
  })

  it('getOne() GET /budgets/:id', async () => {
    mockGet.mockResolvedValue({ data: { id: 'b-1' } })
    const result = await BudgetService.getOne('b-1')
    expect(mockGet).toHaveBeenCalledWith('/budgets/b-1')
    expect(result).toEqual({ id: 'b-1' })
  })

  it('create() POST /budgets con year y month', async () => {
    const budget = { id: 'b-new', year: 2026, month: 7 }
    mockPost.mockResolvedValue({ data: budget })
    const result = await BudgetService.create(2026, 7)
    expect(mockPost).toHaveBeenCalledWith('/budgets', { year: 2026, month: 7 })
    expect(result).toEqual(budget)
  })

  // ── Ingresos ──────────────────────────────────────────────────────────

  it('addIncome() POST /budgets/:id/incomes', async () => {
    const payload = { name: 'Salario', budgeted: enc(), actual: null }
    const income  = { id: 'i-1', ...payload }
    mockPost.mockResolvedValue({ data: income })
    const result  = await BudgetService.addIncome('b-1', payload)
    expect(mockPost).toHaveBeenCalledWith('/budgets/b-1/incomes', payload)
    expect(result).toEqual(income)
  })

  it('updateIncome() PATCH /budgets/:id/incomes/:incomeId', async () => {
    const payload = { name: 'Bono' }
    const income  = { id: 'i-1', name: 'Bono' }
    mockPatch.mockResolvedValue({ data: income })
    const result  = await BudgetService.updateIncome('b-1', 'i-1', payload)
    expect(mockPatch).toHaveBeenCalledWith('/budgets/b-1/incomes/i-1', payload)
    expect(result).toEqual(income)
  })

  it('deleteIncome() DELETE /budgets/:id/incomes/:incomeId', async () => {
    mockDelete.mockResolvedValue({ data: undefined })
    await BudgetService.deleteIncome('b-1', 'i-1')
    expect(mockDelete).toHaveBeenCalledWith('/budgets/b-1/incomes/i-1')
  })

  // ── Facturas ──────────────────────────────────────────────────────────

  it('addBill() POST /budgets/:id/bills', async () => {
    const payload = { name: 'Renta', budgeted: enc(), actual: null, dueDate: null, paymentType: null }
    const bill    = { id: 'bill-1', ...payload }
    mockPost.mockResolvedValue({ data: bill })
    const result  = await BudgetService.addBill('b-1', payload)
    expect(mockPost).toHaveBeenCalledWith('/budgets/b-1/bills', payload)
    expect(result).toEqual(bill)
  })

  it('markBillPaid() PATCH /budgets/:id/bills/:billId/paid', async () => {
    mockPatch.mockResolvedValue({ data: { id: 'bill-1', isPaid: true } })
    const result = await BudgetService.markBillPaid('b-1', 'bill-1', true)
    expect(mockPatch).toHaveBeenCalledWith('/budgets/b-1/bills/bill-1/paid', { isPaid: true })
    expect(result.isPaid).toBe(true)
  })

  it('updateBill() PATCH /budgets/:id/bills/:billId', async () => {
    const payload = { name: 'Renta nueva' }
    mockPatch.mockResolvedValue({ data: { id: 'bill-1', ...payload } })
    await BudgetService.updateBill('b-1', 'bill-1', payload)
    expect(mockPatch).toHaveBeenCalledWith('/budgets/b-1/bills/bill-1', payload)
  })

  it('deleteBill() DELETE /budgets/:id/bills/:billId', async () => {
    mockDelete.mockResolvedValue({ data: undefined })
    await BudgetService.deleteBill('b-1', 'bill-1')
    expect(mockDelete).toHaveBeenCalledWith('/budgets/b-1/bills/bill-1')
  })

  // ── Gastos ────────────────────────────────────────────────────────────

  it('addExpense() POST /budgets/:id/expenses', async () => {
    const payload = { category: 'mercado', budgeted: enc() }
    const expense = { id: 'e-1', ...payload }
    mockPost.mockResolvedValue({ data: expense })
    const result  = await BudgetService.addExpense('b-1', payload)
    expect(mockPost).toHaveBeenCalledWith('/budgets/b-1/expenses', payload)
    expect(result).toEqual(expense)
  })

  it('deleteExpense() DELETE /budgets/:id/expenses/:expenseId', async () => {
    mockDelete.mockResolvedValue({ data: undefined })
    await BudgetService.deleteExpense('b-1', 'e-1')
    expect(mockDelete).toHaveBeenCalledWith('/budgets/b-1/expenses/e-1')
  })

  // ── Transacciones ─────────────────────────────────────────────────────

  it('addTransaction() POST /budgets/:id/transactions', async () => {
    const payload = { amount: enc(), category: 'mercado', paymentType: null, note: null, date: '2026-07-01' }
    const tx      = { id: 'tx-1', ...payload }
    mockPost.mockResolvedValue({ data: tx })
    const result  = await BudgetService.addTransaction('b-1', payload)
    expect(mockPost).toHaveBeenCalledWith('/budgets/b-1/transactions', payload)
    expect(result).toEqual(tx)
  })

  it('deleteTransaction() DELETE /budgets/:id/transactions/:txId', async () => {
    mockDelete.mockResolvedValue({ data: undefined })
    await BudgetService.deleteTransaction('b-1', 'tx-1')
    expect(mockDelete).toHaveBeenCalledWith('/budgets/b-1/transactions/tx-1')
  })
})
