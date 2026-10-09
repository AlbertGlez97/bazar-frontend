import { describe, expect, it } from 'vitest'
import { buildAgreementPdfDefinition, agreementPdfFileName } from '../agreement-pdf'
import { agreementFixture, reversalFixture } from './finance-agreements.fixture'
const text = (value: unknown) => JSON.stringify(value)
describe('snapshot agreement PDF', () => {
  it('preserves allocations, historical names, notice, context and signatures without changing its source', () => {
    const snapshot = agreementFixture(); const before = text(snapshot)
    const def = buildAgreementPdfDefinition(snapshot), content = text(def.content)
    for (const label of ['LA MARCHANTA', 'ACUERDO DE REPARTO', snapshot.folio, snapshot.contextId, snapshot.notice, 'Firma', 'Fecha']) expect(content).toContain(label)
    for (const person of snapshot.participants) expect(content).toContain(person.name)
    expect(def.pageSize).toBe('A4'); expect(text(snapshot)).toBe(before)
  })
  it('makes voided status, actual reason and immutable original explicit', () => {
    const snapshot = agreementFixture({ status: 'voided', reversal: reversalFixture() })
    const content = text(buildAgreementPdfDefinition(snapshot).content)
    expect(content).toContain('ANULADO'); expect(content).toContain('Correction')
    expect(content).toContain('No registra pagos, retiros ni transferencias')
  })
  it('uses human known minutes and warning text rather than untranslated server messages', () => {
    const snapshot = agreementFixture(); snapshot.rule.workBasis = 'KNOWN_MINUTES'
    snapshot.participants[0]!.knownMinutes = 125; snapshot.participants[0]!.workUnits = 125
    snapshot.warnings = [{ code: 'MISSING_SALE_COST', message: 'SERVER ENGLISH' }]
    const content = text(buildAgreementPdfDefinition(snapshot).content)
    expect(content).toContain('2 h 5 min'); expect(content).toContain('costos incompletos'); expect(content).not.toContain('SERVER ENGLISH')
  })
  it('sanitizes filenames and never uses title or path separators', () => {
    expect(agreementPdfFileName('AC-2026-00001')).toBe('acuerdo-ac-2026-00001.pdf')
    expect(agreementPdfFileName('../../X\\Y')).not.toMatch(/[\/\\]/)
  })
})

it.each(['active', 'voided'] as const)('prints the full stored integrity identifier for %s without recomputing it', status => {
  const digest = '0123456789abcdef'.repeat(4);
  const snapshot = agreementFixture({ snapshotFingerprint: digest, status, ...(status === 'voided' ? { reversal: reversalFixture() } : {}) });
  const content = text(buildAgreementPdfDefinition(snapshot).content);
  expect(content).toContain('Código de verificación');
  expect(content).toContain('Identificador de integridad del registro');
  expect(content).toContain(digest);
  expect(content).toContain('No es una firma digital');
  expect(snapshot.snapshotFingerprint).toBe(digest);
});
