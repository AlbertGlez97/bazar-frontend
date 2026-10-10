import { agreementErrorCode, agreementErrorStatus, isAgreementId } from './finance-agreements'
import { businessDayOf, formatBusinessDateTime } from './business-time'
import { formatMinorMoney } from './money'
import type { PaymentFields, PaymentProgress } from '@/types/finance-payment.types'

export const MAX_PAYMENT_MINOR = 2147483647
export const OFFLINE_REGISTER_MESSAGE = 'Necesitas conexión para registrar un pago.'
export const OFFLINE_REVERSE_MESSAGE = 'Necesitas conexión para anular un pago.'
export const OFFLINE_READ_MESSAGE = 'Necesitas conexión para consultar los pagos. No se guardó ni se envió nada.'
export const PAYMENT_ACCESS_MESSAGE = 'Confirma la sesión, la persona socia y el dispositivo antes de continuar.'
export const PAYMENT_ONLY_RECORDS_COPY = 'La Marchanta no mueve dinero: solo registra que este pago ya se hizo fuera del sistema.'
export const VOIDED_AGREEMENT_PAYMENTS_COPY = 'Este acuerdo está anulado. Los pagos registrados previamente se conservan como historial.'

export class FinancePaymentContractError extends Error {
  constructor() { super('Invalid finance payment response'); this.name = 'FinancePaymentContractError' }
}
export class PaymentFormError extends Error {
  constructor(message: string) { super(message); this.name = 'PaymentFormError' }
}
export const isPaymentId = isAgreementId
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ZONED_ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/i

/** Strict body fields: never agreed, pending, names, currency or context. A blank note is omitted. */
export function normalizePaymentFields(fields: PaymentFields): PaymentFields {
  if (!Number.isInteger(fields.amountMinor) || fields.amountMinor < 1 || fields.amountMinor > MAX_PAYMENT_MINOR)
    throw new PaymentFormError('Escribe un monto mayor a cero y menor a $21,474,836.47.')
  if (typeof fields.occurredAt !== 'string' || !ZONED_ISO_RE.test(fields.occurredAt) || !Number.isFinite(Date.parse(fields.occurredAt)))
    throw new PaymentFormError('Escribe una fecha y hora válidas para el pago.')
  if (typeof fields.participantMemberId !== 'string' || !UUID_RE.test(fields.participantMemberId))
    throw new PaymentFormError('La persona participante no es válida.')
  const note = fields.note == null ? '' : fields.note.trim()
  if (note.length > 1000) throw new PaymentFormError('La nota admite hasta 1000 caracteres.')
  return {
    participantMemberId: fields.participantMemberId, amountMinor: fields.amountMinor, occurredAt: fields.occurredAt,
    ...(note ? { note } : {}),
  }
}
export function paymentReasonText(text: string): string {
  const reason = text.trim()
  if (!reason || reason.length > 1000) throw new PaymentFormError('Escribe un motivo de 1 a 1000 caracteres.')
  return reason
}

export const isUncertainPaymentFailure = (error: unknown): boolean => {
  const status = agreementErrorStatus(error)
  return error instanceof FinancePaymentContractError || status === null || status >= 500 || status === 408 || status === 429
}
export function exceedsPendingNumbers(error: unknown): { agreedMinor: number; paidMinor: number; pendingMinor: number } | null {
  if (agreementErrorCode(error) !== 'FINANCE_PAYMENT_EXCEEDS_PENDING') return null
  const data = (error as { response?: { data?: Record<string, unknown> } }).response?.data ?? {}
  const { agreedMinor, paidMinor, pendingMinor } = data
  return [agreedMinor, paidMinor, pendingMinor].every((v) => Number.isSafeInteger(v) && (v as number) >= 0)
    ? { agreedMinor: agreedMinor as number, paidMinor: paidMinor as number, pendingMinor: pendingMinor as number } : null
}

/** Messages never imply a write was confirmed when its response was lost. */
export function paymentErrorMessage(error: unknown): string {
  if (error instanceof PaymentFormError) return error.message
  if (error instanceof FinancePaymentContractError)
    return 'La respuesta del pago tiene un formato inesperado. No pudimos confirmar el resultado; reintenta el mismo intento.'
  const numbers = exceedsPendingNumbers(error)
  if (numbers) return `El monto supera lo que falta por pagar. Acordado: ${formatMinorMoney(numbers.agreedMinor)}. ` +
    `Ya pagado: ${formatMinorMoney(numbers.paidMinor)}. Pendiente: ${formatMinorMoney(numbers.pendingMinor)}.`
  switch (agreementErrorCode(error)) {
    case 'FINANCE_PAYMENT_EXCEEDS_PENDING': return 'El monto supera lo que falta por pagar. Actualiza los totales y revisa el pendiente.'
    case 'FINANCE_PAYMENT_NOTHING_AGREED': return 'Esta persona no tiene un monto acordado, así que no se puede registrar un pago.'
    case 'FINANCE_PAYMENT_AGREEMENT_VOIDED': return 'Este acuerdo está anulado; ya no se pueden registrar pagos nuevos.'
    case 'FINANCE_PAYMENT_ALREADY_VOIDED': return 'Ese pago ya estaba anulado. Actualiza el historial.'
    case 'FINANCE_PAYMENT_ID_CONFLICT': return 'Ese identificador corresponde a otro intento. Actualiza el historial antes de continuar.'
    case 'FINANCE_PAYMENT_TIME_INVALID':
      return 'La fecha del pago no es válida: no puede ser anterior al acuerdo ni posterior a la hora del servidor. Si el reloj de tu dispositivo va adelantado, elige una hora anterior.'
    case 'FINANCE_PAYMENT_REVERSAL_TIME_INVALID':
      return 'La fecha de la anulación no puede ser anterior al pago ni posterior a la hora del servidor. Revisa la fecha y hora de tu dispositivo.'
  }
  switch (agreementErrorStatus(error)) {
    case 400: return 'Revisa los datos del pago.'
    case 401: return 'La sesión venció. Inicia sesión de nuevo.'
    case 403: return 'Solo las personas socias autorizadas pueden registrar pagos desde este dispositivo.'
    case 404: return 'No se encontró el acuerdo, el pago o la persona participante.'
    case 409: return 'El pago cambió mientras tanto. Actualiza el historial antes de continuar.'
    case 422: return 'El servidor no aceptó este pago. Revisa los datos.'
    case 503: return 'El servidor está ocupado. Reintenta el mismo intento; no se duplicará.'
    default: return 'No pudimos confirmar el resultado. Revisa tu conexión y reintenta el mismo intento; no se duplicará.'
  }
}

export const paymentProgressLabel = (status: PaymentProgress): string => ({
  UNPAID: 'Sin pagar', PARTIALLY_PAID: 'Pago parcial', PAID: 'Pagado', NOT_DUE: 'Sin monto acordado',
}[status])
export const paymentProgressColor = (status: PaymentProgress): 'gray' | 'amber' | 'green' | 'blue' => ({
  UNPAID: 'gray', PARTIALLY_PAID: 'amber', PAID: 'green', NOT_DUE: 'blue',
} as const)[status]

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
/** `9 oct 2026` in business time (UTC-6), never the device zone. */
export function formatPaymentDate(instant: string): string {
  if (Number.isNaN(new Date(instant).getTime())) return '—'
  const [year, month, day] = businessDayOf(instant).split('-')
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`
}
export const formatPaymentDateTime = (instant: string): string => formatBusinessDateTime(instant)

const BUSINESS_OFFSET_MS = 6 * 60 * 60 * 1000
const LOCAL_INPUT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
/** Value for a datetime-local input showing business wall-clock time (floored to the minute). */
export function businessDateTimeInput(now: Date = new Date()): string {
  return new Date(now.getTime() - BUSINESS_OFFSET_MS).toISOString().slice(0, 16)
}
/** Business wall-clock text -> real UTC instant, or null when it is not a real date and time. */
export function instantFromBusinessInput(text: string): string | null {
  if (!LOCAL_INPUT_RE.test(text)) return null
  const wall = Date.parse(text + ':00.000Z')
  if (!Number.isFinite(wall) || new Date(wall).toISOString().slice(0, 16) !== text) return null
  return new Date(wall + BUSINESS_OFFSET_MS).toISOString()
}
