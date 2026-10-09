import { describe, expect, it } from 'vitest'
import { normalizeAgreementFields, agreementErrorMessage, AGREEMENT_NOTICE, agreementWarningText, formatAgreementInstant } from '../finance-agreements'
const fields = { from: '2026-10-01', to: '2026-11-01', requestedAmountMinor: 600000, partnerShareBps: 5000,
  workShareBps: 5000, workBasis: 'WORK_SHIFTS' as const, title: '  October  ', simulationFingerprint: 'sim1:' + 'a'.repeat(64) }
describe('agreement form contract', () => {
  it('trims required title and retains blank optional notes rather than silently making them null', () => {
    expect(normalizeAgreementFields({ ...fields, note: '  ' })).toEqual({ ...fields, title: 'October', note: '' })
  })
  it.each([{ title: ' ' }, { title: 'x'.repeat(121) }, { note: 'x'.repeat(1001) },
    { from: '2026-02-30' }, { to: '2026-10-01' }, { requestedAmountMinor: 0 },
    { requestedAmountMinor: 2147483648 }, { partnerShareBps: 5001 },
    { simulationFingerprint: 'sim1:ABC' }, { replacesAgreementId: 'bad' }])('rejects invalid fields %j', (over) => {
    expect(() => normalizeAgreementFields({ ...fields, ...over })).toThrow()
  })
  it.each([400, 401, 403, 404, 409, 422, 503])('maps HTTP %i without rendering server English', (status) => {
    expect(agreementErrorMessage({ response: { status, data: { message: 'INTERNAL ENGLISH' } } })).not.toBe('')
    expect(agreementErrorMessage({ response: { status } })).not.toContain('INTERNAL')
  })
})


describe('agreement domain error mapping', () => {
  it.each([
    [409, 'FINANCE_AGREEMENT_SIMULATION_CHANGED', 'Los datos cambiaron'],
    [409, 'FINANCE_AGREEMENT_ID_CONFLICT', 'identificador'],
    [409, 'FINANCE_AGREEMENT_ALREADY_VOIDED', 'ya fue anulado'],
    [422, 'FINANCE_AGREEMENT_REPLACEMENT_INVALID', 'reemplazar'],
    [503, 'FINANCE_AGREEMENT_BUSY', 'ocupado'],
    [422, 'FINANCE_DISTRIBUTION_EXCEEDS_AVAILABLE', 'supera'],
  ])('maps %i %s by domain code', (status, code, expected) => {
    expect(agreementErrorMessage({ response: { status, data: { code } } })).toContain(expected)
  })
})


describe('historical agreement copy and dates', () => {
  it('preserves the exact UTF-8 notice and uses historical rather than live eligibility language', () => {
    expect(AGREEMENT_NOTICE).toBe('Documento generado a partir de una simulación aceptada por los participantes. No es un contrato legal ni registra pagos.')
    expect(agreementWarningText('PARTNER_ELIGIBILITY_IS_CURRENT_STATE')).toContain('al crear el acuerdo')
    expect(agreementWarningText('PARTNER_ELIGIBILITY_IS_CURRENT_STATE')).not.toContain('hoy')
    expect(agreementWarningText('UNKNOWN')).toContain('no reconocido')
  })
  it('formats server instants in the fixed UTC−6 business timezone', () => {
    expect(formatAgreementInstant('2026-01-01T04:00:00.000Z')).toContain('2025')
  })
})

it('explains reversal chronology and backend time in Spanish without implying uncertain creation', () => {
  const message = agreementErrorMessage({ response: { status: 422, data: { code: 'FINANCE_AGREEMENT_REVERSAL_TIME_INVALID' } } });
  expect(message).toBe('La fecha de anulación debe ser igual o posterior a la del acuerdo y no puede estar en el futuro según el servidor. Revisa la fecha y hora del dispositivo.');
});
