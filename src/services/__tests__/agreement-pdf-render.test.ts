// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { renderAgreementPdfBlob } from '../agreement-pdf'
import { agreementFixture, reversalFixture } from './finance-agreements.fixture'
import type { DistributionAgreement } from '@/types/finance-agreement.types'
const long = agreementFixture()
long.participants = Array.from({ length: 60 }, (_, i) => ({ ...long.participants[0]!, memberId: 'person-' + i, name: 'Persona participante con nombre extenso número ' + i }))
const partial = agreementFixture(); partial.financialBase.status = 'partial'; partial.rule.workBasis = 'KNOWN_MINUTES'; partial.participants[0]!.workUnits = 125
partial.warnings = [{ code: 'MISSING_SALE_COST', message: 'Missing cost' }]
const samples: [string, DistributionAgreement][] = [['active', agreementFixture()], ['voided', agreementFixture({ status: 'voided', reversal: reversalFixture() })], ['partial', partial], ['long', long]]
describe('real lazy pdfmake output', () => {
  it.each(samples)('generates an actual A4 PDF Blob for %s', async (name, snapshot) => {
    const blob = await renderAgreementPdfBlob(snapshot)
    expect(blob.type).toBe('application/pdf')
    const bytes = Buffer.from(await blob.arrayBuffer())
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
    const raw = bytes.toString('latin1')
    const pages = raw.match(/\/Type \/Page\b/g)?.length ?? 0
    expect(pages).toBeGreaterThan(0)
    expect(raw).toContain('/MediaBox [0 0 595.28 841.89]')
    if (name === 'long') expect(pages).toBeGreaterThan(10)
    if (process.env.AGREEMENT_PDF_SAMPLES === '1') {
      mkdirSync('tmp/pdfs/agreements', { recursive: true })
      writeFileSync('tmp/pdfs/agreements/' + name + '.pdf', bytes)
    }
  }, 30000)
})
