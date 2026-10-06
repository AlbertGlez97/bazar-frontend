import { describe, expect, it } from 'vitest'
import {
  describeWorkShiftTotals,
  localWorkShiftSummary,
  type WorkShiftSummaryRow,
} from '../work-shift-summary'

const row = (over: Partial<WorkShiftSummaryRow> = {}): WorkShiftSummaryRow => ({
  memberId: 'ana',
  workDate: '2026-10-03',
  minutes: 60,
  reversed: false,
  uncertain: false,
  ...over,
})

describe('localWorkShiftSummary', () => {
  it('counts records, adds only known minutes and counts unknown durations separately', () => {
    const s = localWorkShiftSummary(
      [row({ minutes: 480 }), row({ minutes: 30 }), row({ minutes: null }), row({ memberId: 'beto', minutes: null })],
      '2026-10-01',
      '2026-10-08',
    )
    expect(s?.totals).toEqual({ shiftCount: 4, knownMinutes: 510, unknownDurationCount: 2 })
    expect(s?.members).toEqual([
      { memberId: 'ana', shiftCount: 3, knownMinutes: 510, unknownDurationCount: 1 },
      { memberId: 'beto', shiftCount: 1, knownMinutes: 0, unknownDurationCount: 1 },
    ])
  })

  it('counts two shifts of the same member on the same day as two records', () => {
    const s = localWorkShiftSummary([row(), row()], '2026-10-03', '2026-10-04')
    expect(s?.totals.shiftCount).toBe(2)
  })

  it('uses an inclusive start and an exclusive end on calendar dates', () => {
    const rows = [
      row({ workDate: '2026-09-30' }),
      row({ workDate: '2026-10-01' }),
      row({ workDate: '2026-10-07' }),
      row({ workDate: '2026-10-08' }),
    ]
    expect(localWorkShiftSummary(rows, '2026-10-01', '2026-10-08')?.totals.shiftCount).toBe(2)
    expect(localWorkShiftSummary(rows, '2026-10-07', '2026-10-08')?.totals.shiftCount).toBe(1)
  })

  it('filters by member', () => {
    const rows = [row(), row({ memberId: 'beto' }), row({ memberId: 'beto' })]
    const s = localWorkShiftSummary(rows, '2026-10-01', '2026-10-08', 'beto')
    expect(s?.totals.shiftCount).toBe(2)
    expect(s?.members.map((m) => m.memberId)).toEqual(['beto'])
  })

  it('excludes annulled or corrected shifts like the server does', () => {
    const s = localWorkShiftSummary(
      [row({ minutes: 60 }), row({ minutes: 600, reversed: true })],
      '2026-10-01',
      '2026-10-08',
    )
    expect(s?.totals).toEqual({ shiftCount: 1, knownMinutes: 60, unknownDurationCount: 0 })
  })

  it('returns an empty summary for a period without shifts', () => {
    expect(localWorkShiftSummary([], '2026-10-01', '2026-10-08')).toEqual({
      totals: { shiftCount: 0, knownMinutes: 0, unknownDurationCount: 0 },
      members: [],
    })
  })

  it('returns null when a record in the period is uncertain, but ignores one outside it', () => {
    const rows = [row(), row({ uncertain: true })]
    expect(localWorkShiftSummary(rows, '2026-10-01', '2026-10-08')).toBeNull()
    expect(localWorkShiftSummary(rows, '2026-11-01', '2026-11-08')).not.toBeNull()
    expect(localWorkShiftSummary(rows, '2026-10-01', '2026-10-08', 'other')).not.toBeNull()
  })
})

describe('describeWorkShiftTotals', () => {
  it('reads N jornadas · X registradas · Z sin duración', () => {
    expect(describeWorkShiftTotals({ shiftCount: 3, knownMinutes: 510, unknownDurationCount: 1 })).toBe(
      '3 jornadas · 8 h 30 min registradas · 1 sin duración',
    )
  })
  it('uses the singular and shows 0 h when no duration is known', () => {
    expect(describeWorkShiftTotals({ shiftCount: 1, knownMinutes: 0, unknownDurationCount: 1 })).toBe(
      '1 jornada · 0 h registradas · 1 sin duración',
    )
  })
})
