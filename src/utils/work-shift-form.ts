import { isValidDateKey } from '@/utils/business-time'
import {
  WorkShiftFormError,
  minutesFromDuration,
} from '@/utils/work-shift-duration'
import type { WorkShiftFields } from '@/types/work-shift.types'

export const WORK_SHIFT_NOTE_MAX = 1000

/** Raw form state: texts as typed. */
export interface WorkShiftFormState {
  memberId: string
  /** Calendar date `YYYY-MM-DD` (no time zone). */
  workDate: string
  hours: string
  minutes: string
  note: string
}

export function emptyWorkShiftForm(day: string): WorkShiftFormState {
  return { memberId: '', workDate: day, hours: '', minutes: '', note: '' }
}

/**
 * Validates the form and converts it to the API fields: calendar date as
 * typed, integer minutes (`null` when unknown) and a trimmed note (`null`
 * when empty).
 */
export function workShiftFieldsFromForm(
  form: WorkShiftFormState,
  workers: readonly { id: string }[],
): WorkShiftFields {
  if (!workers.some((m) => m.id === form.memberId))
    throw new WorkShiftFormError('Elige quién trabajó.')
  if (!isValidDateKey(form.workDate))
    throw new WorkShiftFormError('Elige una fecha válida.')
  const minutes = minutesFromDuration(form.hours, form.minutes)
  const note = form.note.trim()
  if (note.length > WORK_SHIFT_NOTE_MAX)
    throw new WorkShiftFormError(
      `La nota admite hasta ${WORK_SHIFT_NOTE_MAX} caracteres.`,
    )
  return {
    memberId: form.memberId,
    workDate: form.workDate,
    minutes,
    note: note || null,
  }
}
