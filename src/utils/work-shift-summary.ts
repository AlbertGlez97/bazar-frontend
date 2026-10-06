import { formatRegisteredMinutes } from '@/utils/work-shift-duration'
import type {
  WorkShiftMemberSummary,
  WorkShiftSummary,
  WorkShiftTotals,
} from '@/types/work-shift.types'

export interface WorkShiftSummaryRow {
  memberId: string
  /** Calendar date `YYYY-MM-DD`; compared as text, never converted to an instant. */
  workDate: string
  minutes: number | null
  /** Confirmed annulment/correction: excluded, like the server does. */
  reversed: boolean
  /** Sync trouble: the figure for this row cannot be trusted. */
  uncertain: boolean
}

/**
 * Figures from this device's records for the calendar dates in
 * `[from, toExclusive)`. Counts records (not distinct days), adds only the
 * durations that exist and counts the rest separately: a missing duration is
 * never assumed. Returns `null` when any record in the period is uncertain
 * (needs review or paused): showing figures that might be wrong would be
 * worse than showing none.
 */
export function localWorkShiftSummary(
  rows: readonly WorkShiftSummaryRow[],
  from: string,
  toExclusive: string,
  memberId?: string,
): WorkShiftSummary | null {
  const inPeriod = rows.filter(
    (r) =>
      r.workDate >= from &&
      r.workDate < toExclusive &&
      (!memberId || r.memberId === memberId),
  )
  if (inPeriod.some((r) => r.uncertain)) return null
  const byMember = new Map<string, WorkShiftMemberSummary>()
  for (const r of inPeriod) {
    if (r.reversed) continue
    const entry = byMember.get(r.memberId) ?? {
      memberId: r.memberId,
      shiftCount: 0,
      knownMinutes: 0,
      unknownDurationCount: 0,
    }
    entry.shiftCount++
    if (r.minutes === null) entry.unknownDurationCount++
    else entry.knownMinutes += r.minutes
    byMember.set(r.memberId, entry)
  }
  const members = [...byMember.values()].sort((a, b) =>
    a.memberId.localeCompare(b.memberId),
  )
  const totals = members.reduce<WorkShiftTotals>(
    (sum, m) => ({
      shiftCount: sum.shiftCount + m.shiftCount,
      knownMinutes: sum.knownMinutes + m.knownMinutes,
      unknownDurationCount: sum.unknownDurationCount + m.unknownDurationCount,
    }),
    { shiftCount: 0, knownMinutes: 0, unknownDurationCount: 0 },
  )
  return { totals, members }
}

/** `3 jornadas · 8 h 30 min registradas · 1 sin duración`. */
export function describeWorkShiftTotals(t: WorkShiftTotals): string {
  const shifts = `${t.shiftCount} ${t.shiftCount === 1 ? 'jornada' : 'jornadas'}`
  return `${shifts} · ${formatRegisteredMinutes(t.knownMinutes)} registradas · ${t.unknownDurationCount} sin duración`
}
