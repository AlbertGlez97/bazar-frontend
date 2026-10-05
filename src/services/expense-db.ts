import { openLocalDb } from './local-db'
import { financeScope } from './contributions-records'
import { nextAttemptAt, plain, scopedKey as key } from './finance-shared'
import type { FinanceOrigin } from './contributions-records'
import type {
  ExpenseHistory,
  ExpenseOperation,
  PendingExpense,
} from './expense-records'
import type { Expense, ExpenseReversalReceipt } from '@/types/expense.types'

/** Corrupt rows are skipped (never deleted or sent) so one bad record cannot hide the rest. */
function wellFormedPending(r: PendingExpense): boolean {
  const x = r as Partial<PendingExpense> | null
  return (
    !!x &&
    typeof x.scope === 'string' &&
    typeof x.id === 'string' &&
    typeof x.createdAt === 'string' &&
    (x.kind === 'create' || x.kind === 'reverse') &&
    !!x.payload &&
    typeof x.payload === 'object' &&
    !!x.origin &&
    typeof x.origin === 'object'
  )
}
function wellFormedHistory(r: ExpenseHistory): boolean {
  const x = r as Partial<ExpenseHistory> | null
  return (
    !!x &&
    typeof x.scope === 'string' &&
    !!x.expense &&
    typeof x.expense === 'object' &&
    typeof x.expense.id === 'string'
  )
}

export async function expenseSnapshot(origin: FinanceOrigin) {
  const scope = financeScope(origin),
    db = await openLocalDb()
  const tx = db.transaction(
    ['pending-expenses', 'expense-history', 'finance-references'],
    'readonly',
  )
  const [pending, history, references] = await Promise.all([
    tx.objectStore('pending-expenses').getAll(),
    tx.objectStore('expense-history').getAll(),
    tx.objectStore('finance-references').get(scope),
  ])
  await tx.done
  return {
    pending: pending
      .filter((r) => wellFormedPending(r) && r.scope === scope)
      .sort(
        (a, b) =>
          a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      ),
    history: history
      .filter((r) => wellFormedHistory(r) && r.scope === scope)
      .map((r) => r.expense),
    references,
  }
}

export async function enqueueExpense(
  origin: FinanceOrigin,
  operation: ExpenseOperation,
) {
  const scope = financeScope(origin),
    db = await openLocalDb()
  if (
    operation.payload.createdByMemberId !== origin.memberId ||
    operation.payload.deviceId !== origin.deviceId
  )
    throw new Error('Financial operation origin mismatch')
  const tx = db.transaction(['pending-expenses', 'expense-history'], 'readwrite')
  const pendingStore = tx.objectStore('pending-expenses')
  const historyStore = tx.objectStore('expense-history')
  const existing = await pendingStore.get(key(scope, operation.payload.id))
  if (existing) {
    await tx.done
    if (
      existing.kind !== operation.kind ||
      existing.origin.memberId !== origin.memberId ||
      existing.origin.deviceId !== origin.deviceId ||
      (existing.kind === 'reverse' &&
        operation.kind === 'reverse' &&
        existing.expenseId !== operation.expenseId) ||
      JSON.stringify(existing.payload) !==
        JSON.stringify(plain(operation.payload))
    )
      throw new Error('Operation identity already exists')
    return existing
  }
  if (operation.kind === 'reverse') {
    const pending = (await pendingStore.getAll()).filter(
      (r) => r.scope === scope,
    )
    const original = await historyStore.get(key(scope, operation.expenseId))
    if (
      original?.expense.reversal ||
      pending.some(
        (r) => r.kind === 'reverse' && r.expenseId === operation.expenseId,
      )
    ) {
      await tx.done
      throw new Error('Expense already has a correction')
    }
    if (
      !original &&
      !pending.some((r) => r.kind === 'create' && r.id === operation.expenseId)
    ) {
      await tx.done
      throw new Error('Expense must be available locally before correction')
    }
  } else if (await historyStore.get(key(scope, operation.payload.id))) {
    await tx.done
    throw new Error('Expense identity already confirmed')
  }
  const record: PendingExpense = plain({
    ...operation,
    origin,
    scope,
    id: operation.payload.id,
    key: key(scope, operation.payload.id),
    createdAt: new Date().toISOString(),
    state: 'pending',
    attempts: 0,
    nextAttemptAt: 0,
  })
  await pendingStore.add(record)
  await tx.done
  return record
}

export async function updateExpenseAttempt(
  record: PendingExpense,
  state: PendingExpense['state'],
  lastError: string,
  now = Date.now(),
) {
  const db = await openLocalDb(),
    tx = db.transaction('pending-expenses', 'readwrite')
  const current = await tx.store.get(record.key)
  if (current)
    await tx.store.put({
      ...current,
      state,
      lastError,
      attempts: current.attempts + 1,
      nextAttemptAt: nextAttemptAt(current.attempts, now),
    })
  await tx.done
}

export async function retryExpense(record: PendingExpense) {
  const db = await openLocalDb(),
    tx = db.transaction('pending-expenses', 'readwrite')
  const current = await tx.store.get(record.key)
  if (current)
    await tx.store.put({
      ...current,
      state: 'pending',
      nextAttemptAt: 0,
      lastError: undefined,
    })
  await tx.done
}

/** History insertion and pending deletion share one IndexedDB transaction. */
export async function confirmExpense(
  record: PendingExpense,
  receipt: Expense | ExpenseReversalReceipt,
) {
  const db = await openLocalDb(),
    tx = db.transaction(['pending-expenses', 'expense-history'], 'readwrite')
  const store = tx.objectStore('expense-history')
  const put = async (expense: Expense) => {
    const id = key(record.scope, expense.id),
      previous = await store.get(id)
    const existing = previous?.expense
    await store.put(
      plain({
        key: id,
        scope: record.scope,
        expense: {
          ...existing,
          ...expense,
          paidBy: expense.paidBy ?? existing?.paidBy,
          reversal: expense.reversal ?? existing?.reversal ?? null,
        },
      }),
    )
  }
  if (record.kind === 'create') await put(receipt as Expense)
  else {
    const reversal = receipt as ExpenseReversalReceipt
    const { original, replacement, ...metadata } = reversal
    await put({ ...original, reversal: metadata })
    if (replacement) await put(replacement)
  }
  await tx.objectStore('pending-expenses').delete(record.key)
  await tx.done
}

export async function mergeExpenseHistory(
  origin: FinanceOrigin,
  expenses: Expense[],
) {
  const db = await openLocalDb(),
    scope = financeScope(origin),
    tx = db.transaction('expense-history', 'readwrite')
  for (const expense of expenses) {
    const id = key(scope, expense.id),
      previous = await tx.store.get(id)
    await tx.store.put(
      plain({
        key: id,
        scope,
        expense: {
          ...previous?.expense,
          ...expense,
          reversal: expense.reversal ?? previous?.expense.reversal ?? null,
        },
      }),
    )
  }
  await tx.done
}
