import api from './api'
import { validExpensePage, validExpenseSummary } from './expense-sync'
import type { ExpenseFilter, ExpenseSummary } from '@/types/expense.types'
import type { FinanceOrigin } from './contributions-records'
import type { PendingExpense } from './expense-records'

const headers = (origin: FinanceOrigin) => ({
  'x-device-id': origin.deviceId,
})

export const ExpensesService = {
  async send(record: PendingExpense): Promise<unknown> {
    const path =
      record.kind === 'create'
        ? '/finance/expenses'
        : `/finance/expenses/${record.expenseId}/reversals`
    return (
      await api.post(path, record.payload, {
        headers: headers(record.origin),
        financialOrigin: record.origin,
        skipAuthRedirect: true,
      } as Parameters<typeof api.post>[2])
    ).data
  },
  async list(origin: FinanceOrigin, filter: ExpenseFilter = {}) {
    const { data } = await api.get('/finance/expenses', {
      params: filter,
      headers: headers(origin),
      financialOrigin: origin,
    } as Parameters<typeof api.get>[1])
    if (!validExpensePage(data, origin))
      throw new Error('Invalid expense list response')
    return data
  },
  async summary(
    origin: FinanceOrigin,
    range: Pick<ExpenseFilter, 'from' | 'to'>,
  ): Promise<ExpenseSummary> {
    const { data } = await api.get('/finance/expenses/summary', {
      params: range,
      headers: headers(origin),
      financialOrigin: origin,
    } as Parameters<typeof api.get>[1])
    if (!validExpenseSummary(data))
      throw new Error('Invalid expense summary response')
    return data
  },
}
