// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { inflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { renderAgreementPdfBlob } from '../agreement-pdf'
import { agreementFixture, reversalFixture } from './finance-agreements.fixture'
import type { DistributionAgreement } from '@/types/finance-agreement.types'
const long = agreementFixture()
long.participants = Array.from({ length: 60 }, (_, i) => ({ ...long.participants[0]!, memberId: 'person-' + i, name: 'Persona participante con nombre extenso número ' + i }))
const partial = agreementFixture(); partial.financialBase.status = 'partial'; partial.rule.workBasis = 'KNOWN_MINUTES'; partial.participants[0]!.workUnits = 125
partial.warnings = [{ code: 'MISSING_SALE_COST', message: 'Missing cost' }]
const samples: [string, DistributionAgreement][] = [['active', agreementFixture()], ['voided', agreementFixture({ status: 'voided', reversal: reversalFixture() })], ['partial', partial], ['long', long]]
for (const [, snapshot] of samples) snapshot.snapshotFingerprint = '0123456789abcdef'.repeat(4)

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
    if (['1', 'close'].includes(process.env.AGREEMENT_PDF_SAMPLES ?? '')) {
      mkdirSync('tmp/pdfs/agreements', { recursive: true })
      writeFileSync('tmp/pdfs/agreements/' + (process.env.AGREEMENT_PDF_SAMPLES === 'close' ? 'close-' : '') + name + '.pdf', bytes)
    }
    expect(decodedPdfText(raw)).toContain(snapshot.snapshotFingerprint)
  }, 30000)
})

/** Decode pdfmake's actual selectable text using its embedded ToUnicode maps. */
function decodedPdfText(raw: string): string {
  const streams = [...raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map(match => {
    try { return inflateSync(Buffer.from(match[1]!, 'latin1')).toString('latin1') }
    catch { return match[1]! }
  });
  const maps = streams.filter(s => s.includes('beginbfrange')).map(s => {
    const map = new Map<number, string>();
    for (const range of s.matchAll(/<([0-9a-f]+)>\s*<[0-9a-f]+>\s*\[([^\]]+)\]/gi)) {
      let code = parseInt(range[1]!, 16);
      for (const char of range[2]!.matchAll(/<([0-9a-f\s]+)>/gi)) {
        // One subset glyph can map to several Unicode units, such as an fi ligature.
        const units = char[1]!.match(/[0-9a-f]{4}/gi) ?? []
        map.set(code++, units.map(unit => String.fromCharCode(parseInt(unit, 16))).join(''))
      }
    }
    return map;
  });
  const glyphRuns = streams.flatMap(stream => [...stream.matchAll(/\[([^\]]*)\]\s*TJ/g)])
    .map(run => [...run[1]!.matchAll(/<([0-9a-f]+)>/gi)].map(hex => hex[1]!).join(''))
  return maps.map(map => glyphRuns.map(run =>
    (run.match(/.{4}/g) ?? []).map(code => map.get(parseInt(code, 16)) ?? '').join(''),
  ).join('')).join('\n')
}
