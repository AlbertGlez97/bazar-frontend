import { financeScope } from './contributions-records'
import {
  asObject,
  classifyFinanceFailure,
  isInstant,
  isUuid,
  MAX_MONEY_MINOR,
  sameInstant,
} from './finance-shared'
import {
  confirmExpense,
  expenseSnapshot,
  updateExpenseAttempt,
} from './expense-db'
import {
  categoryMatchesNature,
  isCategory,
  isFundsSource,
  isNature,
} from '@/utils/expense-catalog'
import type { FinanceSyncOptions } from './contributions-sync'
import type { FinanceOrigin } from './contributions-records'
import type { PendingExpense } from './expense-records'
import type {
  Expense,
  ExpensePage,
  ExpensePayload,
  ExpenseReversal,
  ExpenseReversalReceipt,
  ExpenseSummary,
} from '@/types/expense.types'

export function isExpenseReversal(v: unknown): v is ExpenseReversal {
  const r = asObject(v)
  return (
    !!r &&
    isUuid(r.id) &&
    isUuid(r.expenseId) &&
    (r.replacementExpenseId === null || isUuid(r.replacementExpenseId)) &&
    isUuid(r.createdByMemberId) &&
    isUuid(r.deviceId) &&
    typeof r.reason === 'string' &&
    !!r.reason.trim() &&
    isInstant(r.occurredAt) &&
    isInstant(r.receivedAt)
  )
}

function validPaidBy(r: Record<string, unknown>): boolean {
  if (r.paidBy === undefined || r.paidBy === null) return true
  const p = asObject(r.paidBy)
  return (
    !!p &&
    p.id === r.paidByMemberId &&
    typeof p.name === 'string' &&
    typeof p.active === 'boolean'
  )
}

export function isExpense(v: unknown): v is Expense {
  const r = asObject(v)
  return (
    !!r &&
    isUuid(r.id) &&
    isUuid(r.paidByMemberId) &&
    isUuid(r.createdByMemberId) &&
    isUuid(r.deviceId) &&
    typeof r.amountMinor === 'number' &&
    Number.isInteger(r.amountMinor) &&
    r.amountMinor > 0 &&
    r.amountMinor <= MAX_MONEY_MINOR &&
    r.currency === 'MXN' &&
    typeof r.contextId === 'string' &&
    !!r.contextId &&
    typeof r.createdByAccountId === 'string' &&
    !!r.createdByAccountId &&
    isNature(r.nature) &&
    isCategory(r.category) &&
    categoryMatchesNature(r.nature, r.category) &&
    isFundsSource(r.fundsSource) &&
    typeof r.description === 'string' &&
    isInstant(r.occurredAt) &&
    isInstant(r.receivedAt) &&
    validPaidBy(r) &&
    (r.reversal === undefined ||
      r.reversal === null ||
      (isExpenseReversal(r.reversal) && r.reversal.expenseId === r.id))
  )
}

export function validExpensePage(
  v: unknown,
  origin: FinanceOrigin,
): v is ExpensePage {
  const page = asObject(v)
  return (
    !!page &&
    Array.isArray(page.items) &&
    page.items.every(
      (r) =>
        isExpense(r) && (!origin.contextId || r.contextId === origin.contextId),
    ) &&
    (page.nextCursor === null || typeof page.nextCursor === 'string')
  )
}

export function validExpenseSummary(v: unknown): v is ExpenseSummary {
  const s = asObject(v)
  return (
    !!s &&
    (
      ['operatingMinor', 'inventoryMinor', 'personalMinor', 'businessMinor'] as const
    ).every((k) => Number.isSafeInteger(s[k]) && (s[k] as number) >= 0)
  )
}

function sameExpense(
  receipt: unknown,
  payload: ExpensePayload,
  origin: FinanceOrigin,
): receipt is Expense {
  return (
    isExpense(receipt) &&
    receipt.id === payload.id &&
    receipt.paidByMemberId === payload.paidByMemberId &&
    receipt.createdByMemberId === payload.createdByMemberId &&
    receipt.deviceId === payload.deviceId &&
    receipt.amountMinor === payload.amountMinor &&
    receipt.nature === payload.nature &&
    receipt.category === payload.category &&
    receipt.fundsSource === payload.fundsSource &&
    receipt.description === payload.description &&
    sameInstant(receipt.occurredAt, payload.occurredAt) &&
    receipt.createdByAccountId === origin.accountId &&
    (!origin.contextId || receipt.contextId === origin.contextId)
  )
}

function validReceipt(
  v: unknown,
  record: PendingExpense,
  original?: Expense,
): v is Expense | ExpenseReversalReceipt {
  if (record.kind === 'create')
    return sameExpense(v, record.payload, record.origin)
  const r = asObject(v)
  if (
    !r ||
    !isExpenseReversal(r) ||
    r.id !== record.id ||
    r.expenseId !== record.expenseId ||
    r.reason !== record.payload.reason ||
    r.createdByMemberId !== record.origin.memberId ||
    r.deviceId !== record.origin.deviceId ||
    !sameInstant(r.occurredAt, record.payload.occurredAt) ||
    r.createdByAccountId !== record.origin.accountId ||
    typeof r.contextId !== 'string' ||
    !r.contextId ||
    (record.origin.contextId && r.contextId !== record.origin.contextId)
  )
    return false
  if (
    !isExpense(r.original) ||
    r.original.id !== record.expenseId ||
    r.original.contextId !== r.contextId
  )
    return false
  if (
    original &&
    (r.original.amountMinor !== original.amountMinor ||
      r.original.paidByMemberId !== original.paidByMemberId ||
      r.original.deviceId !== original.deviceId ||
      r.original.nature !== original.nature ||
      r.original.category !== original.category ||
      r.original.fundsSource !== original.fundsSource ||
      r.original.description !== original.description ||
      !sameInstant(r.original.occurredAt, original.occurredAt))
  )
    return false
  return record.payload.replacement
    ? r.replacementExpenseId === record.payload.replacement.id &&
        sameExpense(r.replacement, record.payload.replacement, record.origin) &&
        r.replacement.contextId === r.contextId
    : r.replacementExpenseId === null && r.replacement === null
}

const running = new Set<string>()

/** Sends pending expenses: creates before reversals, each under its own UUID. */
export async function syncExpenses(
  origin: FinanceOrigin,
  send: (record: PendingExpense) => Promise<unknown>,
  options: FinanceSyncOptions = {},
): Promise<number> {
  const scope = financeScope(origin)
  if (running.has(scope)) return 0
  running.add(scope)
  const run = async () => {
    let synced = 0
    const snapshot = await expenseSnapshot(origin)
    const ordered = [...snapshot.pending].sort(
      (a, b) =>
        (a.kind === 'create' ? 0 : 1) - (b.kind === 'create' ? 0 : 1) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    )
    for (const record of ordered) {
      if (
        record.state !== 'pending' ||
        record.nextAttemptAt > (options.now?.() ?? Date.now())
      )
        continue
      if (
        record.origin.accountId !== origin.accountId ||
        record.origin.apiBase !== origin.apiBase ||
        record.origin.deviceId !== origin.deviceId ||
        (origin.contextId &&
          record.origin.contextId &&
          origin.contextId !== record.origin.contextId)
      )
        continue
      if (options.online && !options.online()) break
      if (options.canSend && !options.canSend(record.origin)) break
      let original: Expense | undefined
      if (record.kind === 'reverse') {
        const current = await expenseSnapshot(origin)
        original = current.history.find((r) => r.id === record.expenseId)
        if (!original) {
          const dependency = current.pending.find(
            (r) => r.kind === 'create' && r.id === record.expenseId,
          )
          if (!dependency || dependency.state !== 'pending')
            await updateExpenseAttempt(
              record,
              'needs_review',
              'El gasto original requiere revisión antes de corregirse.',
            )
          continue
        }
      }
      try {
        const receipt = await send(record)
        if (!validReceipt(receipt, record, original))
          throw new Error('Uncertain financial acknowledgement')
        await confirmExpense(record, receipt)
        synced++
      } catch (error) {
        const { state, message } = classifyFinanceFailure(error)
        await updateExpenseAttempt(
          record,
          state,
          message,
          options.now?.() ?? Date.now(),
        )
        if (state !== 'needs_review') break
      }
    }
    return synced
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.locks?.request)
      return await navigator.locks.request(
        'marchanta-expenses:' + scope,
        { ifAvailable: true },
        async (lock) => (lock ? run() : 0),
      )
    return await run()
  } finally {
    running.delete(scope)
  }
}
