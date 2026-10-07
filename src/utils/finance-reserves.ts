import { addDaysToKey, formatDateKey, isValidDateKey, isValidRange } from '@/utils/business-time'
import { parseMoneyText, sumMinor } from '@/utils/money'
import { VOICE } from '@/config/voice'
import { MISSING_ROUTE_COPY, isMissingRoute } from '@/utils/finance-overview'
import type {
  ReserveFields,
  ReserveListItem,
} from '@/types/finance-reserve.types'

export const RESERVE_NAME_MAX = 120
export const RESERVE_NOTE_MAX = 1000
export const RESERVE_REASON_MAX = 1000
/** Backend cap for an amount: 2147483647 cents. */
export const RESERVE_MAX_MINOR = 2147483647

/** Inclusive day keys, exactly as the range picker shows them. */
export interface ReservePeriod {
  from: string
  to: string
}

/** The server answered 2xx but the body is not the contract this screen understands. */
export class FinanceReserveContractError extends Error {
  constructor() {
    super('Invalid finance reserve response')
    this.name = 'FinanceReserveContractError'
  }
}

export class ReserveFormError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReserveFormError'
  }
}

/** The picker emits INCLUSIVE end days; the API stores `periodTo` EXCLUSIVE. */
export const reserveExclusiveTo = (pickerTo: string): string => addDaysToKey(pickerTo, 1)

/** Stored period -> picker days (inclusive end). */
export const reservePickerPeriod = (periodFrom: string, periodTo: string): ReservePeriod => ({
  from: periodFrom,
  to: addDaysToKey(periodTo, -1),
})

/** `01/10/2026 al 31/10/2026`, or a single date when it covers one day. The stored exclusive end is shown inclusive. */
export function formatReservePeriod(periodFrom: string, periodTo: string): string {
  const { from, to } = reservePickerPeriod(periodFrom, periodTo)
  return from === to ? formatDateKey(from) : `${formatDateKey(from)} al ${formatDateKey(to)}`
}

/** Same text for the picked (inclusive) range. */
export const formatPickedPeriod = (range: ReservePeriod): string =>
  formatReservePeriod(range.from, reserveExclusiveTo(range.to))

/** Raw form state: texts as typed. */
export interface ReserveFormState {
  name: string
  amount: string
  note: string
}
export const emptyReserveForm = (): ReserveFormState => ({ name: '', amount: '', note: '' })

/**
 * Validates the form (mirrors the backend) and returns the API fields. The
 * period is the picked range, converted to the stored `[from,to)` form.
 */
export function reserveFieldsFromForm(form: ReserveFormState, range: ReservePeriod): ReserveFields {
  const name = form.name.trim()
  if (!name) throw new ReserveFormError('Escribe un nombre para la reserva.')
  if (name.length > RESERVE_NAME_MAX)
    throw new ReserveFormError(`El nombre admite hasta ${RESERVE_NAME_MAX} caracteres.`)
  const amountMinor = parseMoneyText(form.amount)
  if (amountMinor === null) throw new ReserveFormError('El importe no es válido. Escribe un monto como 1,500.00.')
  if (amountMinor < 1) throw new ReserveFormError('Escribe un importe mayor que cero.')
  if (amountMinor > RESERVE_MAX_MINOR)
    throw new ReserveFormError('El importe es demasiado grande (máximo 21,474,836.47).')
  if (!isValidRange(range.from, range.to))
    throw new ReserveFormError('Elige un periodo válido arriba: la fecha inicial no puede ser posterior a la final.')
  const note = form.note.trim()
  if (note.length > RESERVE_NOTE_MAX)
    throw new ReserveFormError(`La nota admite hasta ${RESERVE_NOTE_MAX} caracteres.`)
  return {
    name,
    amountMinor,
    periodFrom: range.from,
    periodTo: reserveExclusiveTo(range.to),
    note: note || null,
  }
}

/** Trimmed reason, or an error when empty / too long. */
export function cancelReasonFromText(text: string): string {
  const reason = text.trim()
  if (!reason) throw new ReserveFormError('Escribe el motivo de la anulación.')
  if (reason.length > RESERVE_REASON_MAX)
    throw new ReserveFormError(`El motivo admite hasta ${RESERVE_REASON_MAX} caracteres.`)
  return reason
}

/** Only a reserve whose period EXACTLY equals the picked range counts in the overview. */
export function matchesRange(item: Pick<ReserveListItem, 'periodFrom' | 'periodTo'>, range: ReservePeriod): boolean {
  return isValidDateKey(range.to) && item.periodFrom === range.from && item.periodTo === reserveExclusiveTo(range.to)
}

/** Splits shown reserves into those of the picked period and those of other periods. */
export function splitByPeriod(items: readonly ReserveListItem[], range: ReservePeriod) {
  const matching: ReserveListItem[] = []
  const other: ReserveListItem[] = []
  for (const item of items) (matchesRange(item, range) ? matching : other).push(item)
  return { matching, other }
}

/** Total of the ACTIVE reserves of the exact picked period; reserves of other periods never add in. */
export function plannedTotalForRange(items: readonly ReserveListItem[], range: ReservePeriod): number {
  return sumMinor(items.filter((i) => i.status === 'active' && matchesRange(i, range)).map((i) => i.amountMinor))
}

export type ReserveAction = 'create' | 'cancel' | 'list'

const statusOf = (error: unknown): number | null => {
  const status = (error as { response?: { status?: unknown } })?.response?.status
  return typeof status === 'number' ? status : null
}
const hasResponse = (error: unknown): boolean => !!(error as { response?: unknown })?.response

/** An attempt may have reached the server (network, timeout, 5xx or unreadable answer): the retry MUST reuse the same id. */
export function isUncertainFailure(error: unknown): boolean {
  if (error instanceof FinanceReserveContractError) return true
  const status = statusOf(error)
  return !hasResponse(error) || (status !== null && (status >= 500 || status === 408 || status === 429))
}

export { isMissingRoute }

export const isConflict = (error: unknown): boolean => statusOf(error) === 409

/** Calm Spanish message for a failed reserve request; never claims something was saved. */
export function reserveErrorMessage(error: unknown, action: ReserveAction): string {
  if (error instanceof FinanceReserveContractError)
    return action === 'list'
      ? 'Las reservas llegaron en un formato inesperado. Avisa al equipo e intenta más tarde.'
      : 'No pudimos confirmar la respuesta del servidor. Actualiza la lista para ver si quedó registrado antes de reintentar.'
  const status = statusOf(error)
  if (!hasResponse(error)) {
    if (action === 'create') return 'No pudimos guardar la reserva. Revisa tu conexión; si reintentas no se duplicará.'
    if (action === 'cancel') return 'No pudimos anular la reserva. Revisa tu conexión; si reintentas no se anulará dos veces.'
    return VOICE.networkError
  }
  if (status === 409)
    return action === 'cancel'
      ? 'Esta reserva ya estaba anulada o cambió mientras tanto. Actualizamos la lista.'
      : 'Ya hay una reserva guardada con ese identificador y datos distintos, quizá de un intento anterior. Revisa la lista antes de volver a guardar.'
  if (status === 400) return 'El servidor no aceptó los datos. Revísalos e intenta de nuevo.'
  if (status === 401) return VOICE.apiErrors.session
  if (status === 403) return 'Solo las personas socias pueden administrar reservas desde este dispositivo.'
  if (status === 404) return action === 'cancel' ? 'Esa reserva ya no existe. Actualiza la lista.' : MISSING_ROUTE_COPY
  return VOICE.genericError
}
