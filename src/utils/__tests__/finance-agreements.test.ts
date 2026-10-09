import { describe, expect, it } from 'vitest'
import { normalizeAgreementFields, agreementErrorMessage } from '../finance-agreements'
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
