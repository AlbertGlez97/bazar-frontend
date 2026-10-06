import { openLocalDb } from './local-db'
import { financeScope } from './contributions-records'
import { nextAttemptAt, plain, scopedKey as key } from './finance-shared'
import type { FinanceOrigin } from './contributions-records'
import type {
  PendingWorkShift,
  WorkShiftHistory,
  WorkShiftOperation,
} from './work-shift-records'
import type { WorkShift } from '@/types/work-shift.types'

/** Corrupt rows are skipped (never deleted or sent) so one bad record cannot hide the rest. */
function wellFormedPending(r: PendingWorkShift): boolean {
  const x = r as Partial<PendingWorkShift> | null
  return (
    !!x &&
    typeof x.scope === 'string' &&
    typeof x.id === 'string' &&
    typeof x.createdAt === 'string' &&
    x.kind === 'create' &&
    !!x.payload &&
    typeof x.payload === 'object' &&
    !!x.origin &&
    typeof x.origin === 'object'
  )
}
function wellFormedHistory(r: WorkShiftHistory): boolean {
  const x = r as Partial<WorkShiftHistory> | null
  return (
    !!x &&
    typeof x.scope === 'string' &&
    !!x.workShift &&
    typeof x.workShift === 'object' &&
    typeof x.workShift.id === 'string'
  )
}

export async function workShiftSnapshot(origin: FinanceOrigin) {
  const scope = financeScope(origin),
    db = await openLocalDb()
  const tx = db.transaction(
    ['pending-work-shifts', 'work-shift-history', 'finance-references'],
    'readonly',
  )
  const [pending, history, references] = await Promise.all([
    tx.objectStore('pending-work-shifts').getAll(),
    tx.objectStore('work-shift-history').getAll(),
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
      .map((r) => r.workShift),
    references,
  }
}

export async function enqueueWorkShift(
  origin: FinanceOrigin,
  operation: WorkShiftOperation,
) {
  const scope = financeScope(origin),
    db = await openLocalDb()
  if (
    operation.payload.createdByMemberId !== origin.memberId ||
    operation.payload.deviceId !== origin.deviceId
  )
    throw new Error('Financial operation origin mismatch')
  const tx = db.transaction(
    ['pending-work-shifts', 'work-shift-history'],
    'readwrite',
  )
  const pendingStore = tx.objectStore('pending-work-shifts')
  const historyStore = tx.objectStore('work-shift-history')
  const existing = await pendingStore.get(key(scope, operation.payload.id))
  if (existing) {
    await tx.done
    if (
      existing.kind !== operation.kind ||
      existing.origin.memberId !== origin.memberId ||
      existing.origin.deviceId !== origin.deviceId ||
      JSON.stringify(existing.payload) !==
        JSON.stringify(plain(operation.payload))
    )
      throw new Error('Operation identity already exists')
    return existing
  }
  if (await historyStore.get(key(scope, operation.payload.id))) {
    await tx.done
    throw new Error('Work shift identity already confirmed')
  }
  const record: PendingWorkShift = plain({
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

export async function updateWorkShiftAttempt(
  record: PendingWorkShift,
  state: PendingWorkShift['state'],
  lastError: string,
  now = Date.now(),
) {
  const db = await openLocalDb(),
    tx = db.transaction('pending-work-shifts', 'readwrite')
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

export async function retryWorkShift(record: PendingWorkShift) {
  const db = await openLocalDb(),
    tx = db.transaction('pending-work-shifts', 'readwrite')
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
export async function confirmWorkShift(
  record: PendingWorkShift,
  receipt: WorkShift,
) {
  const db = await openLocalDb(),
    tx = db.transaction(
      ['pending-work-shifts', 'work-shift-history'],
      'readwrite',
    )
  const store = tx.objectStore('work-shift-history')
  const id = key(record.scope, receipt.id),
    existing = (await store.get(id))?.workShift
  await store.put(
    plain({
      key: id,
      scope: record.scope,
      workShift: {
        ...existing,
        ...receipt,
        // The receipt freezes the warning; a later list never carries it.
        warnings: receipt.warnings ?? existing?.warnings,
        member: receipt.member ?? existing?.member,
        reversal: receipt.reversal ?? existing?.reversal ?? null,
      },
    }),
  )
  await tx.objectStore('pending-work-shifts').delete(record.key)
  await tx.done
}

export async function mergeWorkShiftHistory(
  origin: FinanceOrigin,
  workShifts: WorkShift[],
) {
  const db = await openLocalDb(),
    scope = financeScope(origin),
    tx = db.transaction('work-shift-history', 'readwrite')
  for (const item of workShifts) {
    const id = key(scope, item.id),
      previous = await tx.store.get(id)
    await tx.store.put(
      plain({
        key: id,
        scope,
        workShift: {
          ...previous?.workShift,
          ...item,
          // List items never carry the creation warning: keep the stored one.
          warnings: item.warnings ?? previous?.workShift.warnings,
          reversal: item.reversal ?? previous?.workShift.reversal ?? null,
        },
      }),
    )
  }
  await tx.done
}
