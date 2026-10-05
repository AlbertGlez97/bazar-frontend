export type ExpenseNature = 'OPERATING_EXPENSE' | 'INVENTORY_PURCHASE'
export type FundsSource = 'BUSINESS' | 'PERSONAL'
export type OperatingCategory =
  | 'transport'
  | 'fuel'
  | 'food'
  | 'bazaar_rent'
  | 'storage'
  | 'advertising'
  | 'utilities'
  | 'packaging'
  | 'maintenance'
  | 'operating_payment'
  | 'other'
export type ExpenseCategory = OperatingCategory | 'inventory'

/** Exact body of POST /finance/expenses (also used as a reversal replacement). */
export interface ExpensePayload {
  id: string
  amountMinor: number
  occurredAt: string
  nature: ExpenseNature
  category: ExpenseCategory
  description: string
  paidByMemberId: string
  fundsSource: FundsSource
  createdByMemberId: string
  deviceId: string
}

/** User-entered fields; ids and origin are added by the store. */
export type ExpenseFields = Omit<
  ExpensePayload,
  'id' | 'createdByMemberId' | 'deviceId'
>

export interface ExpenseReversalPayload {
  id: string
  occurredAt: string
  reason: string
  createdByMemberId: string
  deviceId: string
  replacement?: ExpensePayload
}

export interface ExpenseReversal extends Omit<
  ExpenseReversalPayload,
  'replacement'
> {
  expenseId: string
  replacementExpenseId: string | null
  receivedAt: string
}

export interface Expense extends ExpensePayload {
  contextId: string
  currency: 'MXN'
  createdByAccountId: string
  receivedAt: string
  paidBy?: { id: string; name: string; active: boolean }
  reversal?: ExpenseReversal | null
}

export interface ExpenseReversalReceipt extends ExpenseReversal {
  contextId: string
  createdByAccountId: string
  original: Expense
  replacement: Expense | null
}

export interface ExpensePage {
  items: Expense[]
  nextCursor: string | null
}

export interface ExpenseFilter {
  from?: string
  to?: string
  paidByMemberId?: string
  nature?: ExpenseNature
  category?: ExpenseCategory
  cursor?: string
  limit?: number
}

/** GET /finance/expenses/summary (reversed expenses are excluded). */
export interface ExpenseSummary {
  operatingMinor: number
  inventoryMinor: number
  personalMinor: number
  businessMinor: number
}
