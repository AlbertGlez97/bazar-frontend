import { isValidDateKey } from './business-time'
import { simulationErrorMessage } from './finance-distribution'
import type { AgreementFields } from '@/types/finance-agreement.types'

export const isAgreementId = (value: unknown): value is string => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
export const isSimulationFingerprint = (value: unknown): value is string =>
  typeof value === 'string' && /^sim1:[0-9a-f]{64}$/.test(value)
export class FinanceAgreementContractError extends Error {
  constructor() { super('Invalid finance agreement response'); this.name = 'FinanceAgreementContractError' }
}
export class AgreementFormError extends Error {
  constructor(message: string) { super(message); this.name = 'AgreementFormError' }
}

/** Rebuild the strict body fields: never copy pools, participants, totals or tenant identifiers. */
export function normalizeAgreementFields(fields: AgreementFields): AgreementFields {
  const title = fields.title.trim()
  if (!title || title.length > 120) throw new AgreementFormError('Escribe un t?tulo de 1 a 120 caracteres.')
  const note = fields.note == null ? fields.note : fields.note.trim()
  if (note != null && note.length > 1000) throw new AgreementFormError('La nota admite hasta 1000 caracteres.')
  if (!isValidDateKey(fields.from) || !isValidDateKey(fields.to) || fields.from >= fields.to)
    throw new AgreementFormError('El per?odo de la simulaci?n no es v?lido.')
  if (!Number.isInteger(fields.requestedAmountMinor) || fields.requestedAmountMinor < 1 || fields.requestedAmountMinor > 2147483647)
    throw new AgreementFormError('El monto de la simulaci?n no es v?lido.')
  if (![fields.partnerShareBps, fields.workShareBps].every((v) => Number.isInteger(v) && v >= 0 && v <= 10000) ||
      fields.partnerShareBps + fields.workShareBps !== 10000 ||
      !['WORK_SHIFTS', 'KNOWN_MINUTES'].includes(fields.workBasis))
    throw new AgreementFormError('La regla de la simulaci?n no es v?lida.')
  if (!isSimulationFingerprint(fields.simulationFingerprint))
    throw new AgreementFormError('Calcula una nueva simulaci?n antes de guardar el acuerdo.')
  if (fields.replacesAgreementId != null && !isAgreementId(fields.replacesAgreementId))
    throw new AgreementFormError('El acuerdo que se reemplaza no es v?lido.')
  return {
    from: fields.from, to: fields.to, requestedAmountMinor: fields.requestedAmountMinor,
    partnerShareBps: fields.partnerShareBps, workShareBps: fields.workShareBps, workBasis: fields.workBasis,
    title, simulationFingerprint: fields.simulationFingerprint,
    ...(note !== undefined ? { note } : {}),
    ...(fields.replacesAgreementId !== undefined ? { replacesAgreementId: fields.replacesAgreementId } : {}),
  }
}
export function agreementReason(text: string): string {
  const reason = text.trim()
  if (!reason || reason.length > 1000) throw new AgreementFormError('Escribe un motivo de 1 a 1000 caracteres.')
  return reason
}
export const agreementErrorStatus = (error: unknown): number | null => {
  const status = (error as { response?: { status?: unknown } } | null)?.response?.status
  return typeof status === 'number' ? status : null
}
export const agreementErrorCode = (error: unknown): string => {
  const code = (error as { response?: { data?: { code?: unknown } } } | null)?.response?.data?.code
  return typeof code === 'string' ? code : ''
}
export const isSimulationChanged = (error: unknown): boolean => agreementErrorStatus(error) === 409 &&
  agreementErrorCode(error) === 'FINANCE_AGREEMENT_SIMULATION_CHANGED'
export function isUncertainAgreementFailure(error: unknown): boolean {
  const status = agreementErrorStatus(error)
  return error instanceof FinanceAgreementContractError || status === null || status >= 500 || status === 408 || status === 429
}

/** Messages never imply a write was confirmed when its response was lost. */
export function agreementErrorMessage(error: unknown, basis: AgreementFields['workBasis'] = 'WORK_SHIFTS'): string {
  if (error instanceof AgreementFormError) return error.message
  if (error instanceof FinanceAgreementContractError)
    return 'La respuesta del acuerdo tiene un formato inesperado. No pudimos confirmar el resultado; reintenta el mismo intento.'
  if (isSimulationChanged(error)) return 'Los datos cambiaron. Calcula una nueva simulaci?n y confirma sus resultados antes de crear el acuerdo.'
  const code = agreementErrorCode(error)
  if (code === 'FINANCE_AGREEMENT_ID_CONFLICT') return 'Ese identificador corresponde a otro intento. Revisa el historial antes de continuar.'
  if (code === 'FINANCE_AGREEMENT_ALREADY_VOIDED') return 'El acuerdo ya fue anulado. Actualiza su detalle.'
  if (code === 'FINANCE_AGREEMENT_REPLACEMENT_INVALID') return 'Solo puedes reemplazar un acuerdo anulado que no tenga reemplazo.'
  if (code === 'FINANCE_AGREEMENT_BUSY') return 'El servidor est? ocupado. Reintenta el mismo intento; no se duplicar?.'
  if (code.startsWith('FINANCE_DISTRIBUTION_') || code.startsWith('FINANCE_OVERVIEW_'))
    return simulationErrorMessage(error, basis)
  switch (agreementErrorStatus(error)) {
    case 400: return 'Revisa los datos o los filtros del acuerdo.'
    case 401: return 'La sesi?n venci?. Inicia sesi?n de nuevo.'
    case 403: return 'Solo las personas socias autorizadas pueden administrar acuerdos desde este dispositivo.'
    case 404: return 'No se encontr? el acuerdo o esta funci?n no est? disponible en el servidor.'
    case 409: return 'El acuerdo cambi? mientras tanto. Revisa su detalle antes de continuar.'
    case 422: return 'El servidor no acept? este acuerdo. Revisa la simulaci?n y el reemplazo.'
    case 503: return 'El servidor est? ocupado. Reintenta el mismo intento; no se duplicar?.'
    default: return 'No pudimos confirmar el resultado. Revisa tu conexi?n y reintenta el mismo intento.'
  }
}
