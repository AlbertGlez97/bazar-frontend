/**
 * Work shifts ("jornadas"): a record of real work done by a member on a
 * calendar day. It is never pay, commission or a distribution, so no money
 * appears anywhere in these types.
 */
export type WorkShiftWarningCode = 'MULTIPLE_SHIFTS_SAME_DAY'

/** Frozen in the creation receipt; never recomputed on replay. */
export interface WorkShiftWarning {
  code: WorkShiftWarningCode
  existingActiveShiftCount: number
}

/** Exact body of POST /finance/work-shifts. `workDate` is a calendar date (YYYY-MM-DD), not an instant. */
export interface WorkShiftPayload {
  id: string
  memberId: string
  workDate: string
  /** Positive integer minutes, or `null` when the duration is unknown. Never 0. */
  minutes: number | null
  note: string | null
  createdByMemberId: string
  deviceId: string
}

/** User-entered fields; id and origin are added by the store. */
export type WorkShiftFields = Omit<
  WorkShiftPayload,
  'id' | 'createdByMemberId' | 'deviceId'
>

/** Worker as embedded in a list item. */
export interface WorkShiftMember {
  id: string
  name: string
  active: boolean
  role: 'socio' | 'colaborador'
}

/**
 * Read-only marker present on a list item once the shift was annulled or
 * corrected on the server. This app does not create corrections yet; the
 * state is only displayed.
 */
export interface WorkShiftListReversal {
  id: string
  replacementWorkShiftId: string | null
}

/**
 * A confirmed work shift as stored locally. It merges the creation receipt
 * (`warnings`) with the list item (`member`, `reversal`).
 */
export interface WorkShift extends WorkShiftPayload {
  contextId: string
  createdByAccountId: string
  receivedAt: string
  warnings?: WorkShiftWarning[]
  member?: WorkShiftMember
  reversal?: WorkShiftListReversal | null
}

/** Body of a 201/200 response to POST /finance/work-shifts. */
export interface WorkShiftReceipt extends WorkShift {
  warnings: WorkShiftWarning[]
}

export interface WorkShiftPage {
  items: WorkShift[]
  nextCursor: string | null
}

export interface WorkShiftFilter {
  /** Inclusive calendar date. */
  from?: string
  /** Exclusive calendar date. */
  to?: string
  memberId?: string
  cursor?: string
  limit?: number
}

export interface WorkShiftTotals {
  shiftCount: number
  knownMinutes: number
  unknownDurationCount: number
}

export interface WorkShiftMemberSummary extends WorkShiftTotals {
  memberId: string
  member?: { id: string; name: string; role: string; active: boolean }
}

/** GET /finance/work-shifts/summary (reversed shifts are excluded; counts records, not days). */
export interface WorkShiftSummary {
  totals: WorkShiftTotals
  members: WorkShiftMemberSummary[]
}
