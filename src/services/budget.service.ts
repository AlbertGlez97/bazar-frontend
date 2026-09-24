// Servicio de presupuesto — consume /api/v1/budgets
import api from './api'
import type {
  Budget, BudgetFullEncrypted, BudgetListItem,
  IncomeEncrypted, BillEncrypted, ExpenseEncrypted, TransactionEncrypted,
  EncryptedField, PaymentType, ExpenseCategory,
} from '@/types/budget.types'

const BudgetService = {

  // ── Presupuesto ──────────────────────────────────────────────────────────
  // Lista los presupuestos del usuario. Cada item incluye los `incomes`
  // cifrados embebidos para que el cliente pueda sintetizar el totalIncome
  // bajo E2EE (el backend no puede sumar montos cifrados).
  async getAll(): Promise<BudgetListItem[]> {
    const { data } = await api.get<BudgetListItem[]>('/budgets')
    return data
  },

  // Obtiene un presupuesto con todas sus relaciones (cifradas) del servidor
  async getOne(id: string): Promise<BudgetFullEncrypted> {
    const { data } = await api.get<BudgetFullEncrypted>(`/budgets/${id}`)
    return data
  },

  // Crea un presupuesto para el mes y año indicados
  async create(year: number, month: number): Promise<Budget> {
    const { data } = await api.post<Budget>('/budgets', { year, month })
    return data
  },

  // ── Ingresos ─────────────────────────────────────────────────────────────
  async addIncome(
    budgetId: string,
    payload: { name: string; budgeted: EncryptedField; actual: EncryptedField | null },
  ): Promise<IncomeEncrypted> {
    const { data } = await api.post<IncomeEncrypted>(`/budgets/${budgetId}/incomes`, payload)
    return data
  },

  // Edita un ingreso. Acepta los mismos campos que addIncome (todos opcionales).
  // Los montos viajan ya cifrados desde el caller — el backend solo persiste.
  async updateIncome(
    budgetId: string,
    incomeId: string,
    payload: { name?: string; budgeted?: EncryptedField; actual?: EncryptedField | null },
  ): Promise<IncomeEncrypted> {
    const { data } = await api.patch<IncomeEncrypted>(
      `/budgets/${budgetId}/incomes/${incomeId}`,
      payload,
    )
    return data
  },

  async deleteIncome(budgetId: string, incomeId: string): Promise<void> {
    await api.delete(`/budgets/${budgetId}/incomes/${incomeId}`)
  },

  // ── Facturas ─────────────────────────────────────────────────────────────
  async addBill(
    budgetId: string,
    payload: {
      name: string
      budgeted: EncryptedField
      actual: EncryptedField | null
      dueDate: string | null
      paymentType: PaymentType | null
    },
  ): Promise<BillEncrypted> {
    const { data } = await api.post<BillEncrypted>(`/budgets/${budgetId}/bills`, payload)
    return data
  },

  // Marca una factura como pagada o pendiente
  async markBillPaid(budgetId: string, billId: string, isPaid: boolean): Promise<BillEncrypted> {
    const { data } = await api.patch<BillEncrypted>(`/budgets/${budgetId}/bills/${billId}/paid`, { isPaid })
    return data
  },

  // Edita una factura. Acepta los mismos campos que addBill (todos opcionales).
  // Los montos viajan ya cifrados desde el caller; los demás campos en plain.
  async updateBill(
    budgetId: string,
    billId: string,
    payload: {
      name?:        string
      budgeted?:    EncryptedField
      actual?:      EncryptedField | null
      dueDate?:     string | null
      paymentType?: PaymentType | null
    },
  ): Promise<BillEncrypted> {
    const { data } = await api.patch<BillEncrypted>(
      `/budgets/${budgetId}/bills/${billId}`,
      payload,
    )
    return data
  },

  async deleteBill(budgetId: string, billId: string): Promise<void> {
    await api.delete(`/budgets/${budgetId}/bills/${billId}`)
  },

  // ── Gastos variables ─────────────────────────────────────────────────────
  // Crea o actualiza el presupuesto de una categoria
  async addExpense(
    budgetId: string,
    payload: { category: ExpenseCategory; budgeted: EncryptedField },
  ): Promise<ExpenseEncrypted> {
    const { data } = await api.post<ExpenseEncrypted>(`/budgets/${budgetId}/expenses`, payload)
    return data
  },

  async deleteExpense(budgetId: string, expenseId: string): Promise<void> {
    await api.delete(`/budgets/${budgetId}/expenses/${expenseId}`)
  },

  // ── Transacciones ────────────────────────────────────────────────────────
  async addTransaction(
    budgetId: string,
    payload: {
      amount: EncryptedField
      category: ExpenseCategory
      paymentType: PaymentType | null
      note: string | null
      date: string
    },
  ): Promise<TransactionEncrypted> {
    const { data } = await api.post<TransactionEncrypted>(`/budgets/${budgetId}/transactions`, payload)
    return data
  },

  async deleteTransaction(budgetId: string, txId: string): Promise<void> {
    await api.delete(`/budgets/${budgetId}/transactions/${txId}`)
  },
}

export default BudgetService
