import { financeScope } from './contributions-records'
import {
  asObject,
  classifyFinanceFailure,
  isInstant,
  isUuid,
} from './finance-shared'
import {
  confirmWorkShift,
  updateWorkShiftAttempt,
  workShiftSnapshot,
} from './work-shift-db'
import { isValidDateKey } from '@/utils/business-time'
import { MAX_WORK_SHIFT_MINUTES } from '@/utils/work-shift-duration'
import { WORK_SHIFT_NOTE_MAX } from '@/utils/work-shift-form'
import type { FinanceSyncOptions } from './contributions-sync'
import type { FinanceOrigin } from './contributions-records'
import type { PendingWorkShift } from './work-shift-records'
import type {
  WorkShift,
  WorkShiftPage,
  WorkShiftPayload,
  WorkShiftReceipt,
  WorkShiftSummary,
} from '@/types/work-shift.types'


const isCount = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0

function validWarnings(v: unknown): boolean {
  return (
    Array.isArray(v) &&
    v.every((w) => {
      const x = asObject(w)
      return (
        !!x &&
        x.code === 'MULTIPLE_SHIFTS_SAME_DAY' &&
        typeof x.existingActiveShiftCount === 'number' &&
        Number.isInteger(x.existingActiveShiftCount) &&
        x.existingActiveShiftCount > 0
      )
    })
  )
}

function validMember(r: Record<string, unknown>): boolean {
  if (r.member === undefined || r.member === null) return true
  const m = asObject(r.member)
  return (
    !!m &&
    m.id === r.memberId &&
    typeof m.name === 'string' &&
    typeof m.active === 'boolean' &&
    (m.role === 'socio' || m.role === 'colaborador')
  )
}

function validReversal(r: Record<string, unknown>): boolean {
  if (r.reversal === undefined || r.reversal === null) return true
  const v = asObject(r.reversal)
  return (
    !!v &&
    isUuid(v.id) &&
    (v.replacementWorkShiftId === null ||
      v.replacementWorkShiftId === undefined ||
      isUuid(v.replacementWorkShiftId))
  )
}

/** Strict shape of a receipt or list item. `warnings` only exist on receipts. */
export function isWorkShift(v: unknown): v is WorkShift {
  const r = asObject(v)
  return (
    !!r &&
    isUuid(r.id) &&
    isUuid(r.memberId) &&
    isUuid(r.createdByMemberId) &&
    isUuid(r.deviceId) &&
    typeof r.workDate === 'string' &&
    isValidDateKey(r.workDate) &&
    (r.minutes === null ||
      (typeof r.minutes === 'number' &&
        Number.isInteger(r.minutes) &&
        r.minutes >= 1 &&
        r.minutes <= MAX_WORK_SHIFT_MINUTES)) &&
    (r.note === null ||
      (typeof r.note === 'string' && r.note.length <= WORK_SHIFT_NOTE_MAX)) &&
    typeof r.contextId === 'string' &&
    !!r.contextId &&
    typeof r.createdByAccountId === 'string' &&
    !!r.createdByAccountId &&
    isInstant(r.receivedAt) &&
    (r.warnings === undefined || validWarnings(r.warnings)) &&
    validMember(r) &&
    validReversal(r)
  )
}

export function validWorkShiftPage(
  v: unknown,
  origin: FinanceOrigin,
): v is WorkShiftPage {
  const page = asObject(v)
  return (
    !!page &&
    Array.isArray(page.items) &&
    page.items.every(
      (r) =>
        isWorkShift(r) && (!origin.contextId || r.contextId === origin.contextId),
    ) &&
    (page.nextCursor === null || typeof page.nextCursor === 'string')
  )
}

function validTotals(v: unknown): boolean {
  const t = asObject(v)
  return (
    !!t &&
    isCount(t.shiftCount) &&
    isCount(t.knownMinutes) &&
    isCount(t.unknownDurationCount) &&
    (t.unknownDurationCount as number) <= (t.shiftCount as number)
  )
}

export function validWorkShiftSummary(v: unknown): v is WorkShiftSummary {
  const s = asObject(v)
  return (
    !!s &&
    validTotals(s.totals) &&
    Array.isArray(s.members) &&
    s.members.every((m) => {
      const x = asObject(m)
      return !!x && typeof x.memberId === 'string' && !!x.memberId && validTotals(x)
    })
  )
}

function sameShift(
  receipt: unknown,
  payload: WorkShiftPayload,
  origin: FinanceOrigin,
): receipt is WorkShiftReceipt {
  return (
    isWorkShift(receipt) &&
    validWarnings(receipt.warnings) &&
    Array.isArray(receipt.warnings) &&
    receipt.id === payload.id &&
    receipt.memberId === payload.memberId &&
    receipt.workDate === payload.workDate &&
    receipt.minutes === payload.minutes &&
    receipt.note === payload.note &&
    receipt.createdByMemberId === payload.createdByMemberId &&
    receipt.deviceId === payload.deviceId &&
    receipt.createdByAccountId === origin.accountId &&
    (!origin.contextId || receipt.contextId === origin.contextId)
  )
}

const running = new Set<string>()

/** Sends pending work shifts, each under its own UUID. */
export async function syncWorkShifts(
  origin: FinanceOrigin,
  send: (record: PendingWorkShift) => Promise<unknown>,
  options: FinanceSyncOptions = {},
): Promise<number> {
  const scope = financeScope(origin)
  if (running.has(scope)) return 0
  running.add(scope)
  const run = async () => {
    let synced = 0
    const snapshot = await workShiftSnapshot(origin)
    for (const record of snapshot.pending) {
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
      try {
        const receipt = await send(record)
        if (!sameShift(receipt, record.payload, record.origin))
          throw new Error('Uncertain financial acknowledgement')
        await confirmWorkShift(record, receipt)
        synced++
      } catch (error) {
        const { state, message } = classifyFinanceFailure(error)
        await updateWorkShiftAttempt(
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
        'marchanta-work-shifts:' + scope,
        { ifAvailable: true },
        async (lock) => (lock ? run() : 0),
      )
    return await run()
  } finally {
    running.delete(scope)
  }
}
