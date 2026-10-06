import { describe, expect, it } from 'vitest'
import {
  WORK_SHIFT_NOTE_MAX,
  emptyWorkShiftForm,
  workShiftFieldsFromForm,
  type WorkShiftFormState,
} from '../work-shift-form'
import { WorkShiftFormError } from '../work-shift-duration'

const workers = [{ id: 'ana' }, { id: 'beto' }]
const valid = (over: Partial<WorkShiftFormState> = {}): WorkShiftFormState => ({
  ...emptyWorkShiftForm('2026-10-03'),
  memberId: 'ana',
  ...over,
})

describe('workShiftFieldsFromForm', () => {
  it('starts empty with the given day and no duration', () => {
    expect(emptyWorkShiftForm('2026-10-03')).toEqual({
      memberId: '',
      workDate: '2026-10-03',
      hours: '',
      minutes: '',
      note: '',
    })
  })

  it('accepts a shift with no duration and no note: both null, never 0 or an empty string', () => {
    expect(workShiftFieldsFromForm(valid(), workers)).toEqual({
      memberId: 'ana',
      workDate: '2026-10-03',
      minutes: null,
      note: null,
    })
  })

  it('converts hours and minutes and trims the note', () => {
    expect(
      workShiftFieldsFromForm(valid({ hours: '8', minutes: '30', note: '  Turno completo  ' }), workers),
    ).toEqual({ memberId: 'ana', workDate: '2026-10-03', minutes: 510, note: 'Turno completo' })
  })

  it('treats a blank note as no note', () => {
    expect(workShiftFieldsFromForm(valid({ note: '   ' }), workers).note).toBeNull()
  })

  it('keeps the calendar date exactly as typed (no time zone conversion)', () => {
    for (const day of ['2026-01-01', '2026-12-31', '2028-02-29'])
      expect(workShiftFieldsFromForm(valid({ workDate: day }), workers).workDate).toBe(day)
  })

  it.each([
    ['no worker', { memberId: '' }, 'quién trabajó'],
    ['a worker that is not selectable', { memberId: 'old' }, 'quién trabajó'],
    ['an empty date', { workDate: '' }, 'fecha'],
    ['an impossible date', { workDate: '2026-02-30' }, 'fecha'],
    ['a timestamp instead of a date', { workDate: '2026-10-03T00:00:00Z' }, 'fecha'],
    ['decimal hours', { hours: '1.5' }, 'entero'],
    ['negative minutes', { minutes: '-5' }, 'entero'],
    ['minutes above 59', { minutes: '75' }, '0 a 59'],
    ['zero duration', { hours: '0', minutes: '0' }, 'al menos 1 minuto'],
    ['a note over the limit', { note: 'x'.repeat(WORK_SHIFT_NOTE_MAX + 1) }, 'nota'],
  ])('rejects %s with a readable message', (_name, change, text) => {
    expect(() => workShiftFieldsFromForm(valid(change), workers)).toThrow(WorkShiftFormError)
    expect(() => workShiftFieldsFromForm(valid(change), workers)).toThrow(text)
  })

  it('accepts a note of exactly the limit', () => {
    const note = 'x'.repeat(WORK_SHIFT_NOTE_MAX)
    expect(workShiftFieldsFromForm(valid({ note }), workers).note).toBe(note)
  })
})
