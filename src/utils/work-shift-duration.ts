/**
 * Duration of a work shift. The form takes two whole numbers (hours and
 * minutes); both empty means "unknown", which is stored as `null` and never
 * as 0. Only integer arithmetic is used.
 */

/** PostgreSQL INTEGER bound accepted by the API for `minutes`. */
export const MAX_WORK_SHIFT_MINUTES = 2147483647

export const NO_DURATION_LABEL = 'Duración no registrada'

export class WorkShiftFormError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkShiftFormError'
  }
}

const DIGITS = /^\d+$/

function wholeNumber(text: string, label: string): number | null {
  const value = text.trim()
  if (!value) return null
  // Rejects decimals, signs, exponents, separators and any non-digit text.
  if (!DIGITS.test(value))
    throw new WorkShiftFormError(
      `${label} deben ser números enteros, sin decimales ni signos.`,
    )
  // Too many digits cannot fit the limit; avoids unsafe integers.
  if (value.length > 10)
    throw new WorkShiftFormError(`${label} es demasiado grande.`)
  return Number(value)
}

/**
 * Converts the two inputs to total minutes. `null` = unknown (both empty).
 * Throws `WorkShiftFormError` with a message for the user otherwise.
 */
export function minutesFromDuration(
  hoursText: string,
  minutesText: string,
): number | null {
  const hours = wholeNumber(hoursText, 'Las horas')
  const minutes = wholeNumber(minutesText, 'Los minutos')
  if (hours === null && minutes === null) return null
  if (minutes !== null && minutes > 59)
    throw new WorkShiftFormError(
      'Los minutos van de 0 a 59. Para una hora o más usa el campo de horas.',
    )
  const total = (hours ?? 0) * 60 + (minutes ?? 0)
  if (total < 1)
    throw new WorkShiftFormError(
      'La duración debe ser de al menos 1 minuto. Si no la sabes, deja horas y minutos vacíos.',
    )
  if (total > MAX_WORK_SHIFT_MINUTES)
    throw new WorkShiftFormError('La duración es demasiado grande.')
  return total
}

/** `8 h`, `8 h 30 min`, `45 min` or `Duración no registrada` (unknown is never shown as 0). */
export function formatDuration(minutes: number | null | undefined): string {
  if (
    minutes === null ||
    minutes === undefined ||
    !Number.isInteger(minutes) ||
    minutes < 1
  )
    return NO_DURATION_LABEL
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest} min`
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

/** Subtotal of the durations that WERE recorded; `0` is a real zero here (no known durations). */
export function formatRegisteredMinutes(minutes: number): string {
  return minutes === 0 ? '0 h' : formatDuration(minutes)
}
