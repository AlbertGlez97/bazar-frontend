import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DB_VERSION } from '../local-db'
import { buildAgreementPdfDefinition } from '../agreement-pdf'
import { agreementFixture } from './finance-agreements.fixture'
import { partialSummaryFixture } from './finance-payments.fixture'

describe('Phase 6 isolation guarantees', () => {
  it('keeps the IndexedDB schema at version 4 because payments are never stored offline', () => {
    expect(DB_VERSION).toBe(4)
  })
  it('leaves the agreement PDF identical whether or not payments exist', () => {
    const plain = buildAgreementPdfDefinition(agreementFixture())
    const withPayments = buildAgreementPdfDefinition(agreementFixture({ paymentSummary: partialSummaryFixture() }))
    expect(JSON.stringify(withPayments)).toBe(JSON.stringify(plain))
    expect(JSON.stringify(plain)).not.toMatch(/Pago parcial|Pagado|Sin pagar|Pendiente|ANULADO/)
  })
  it('does not import any payment module from the PDF source', () => {
    const source = readFileSync('src/services/agreement-pdf.ts', 'utf8')
    expect(source).not.toMatch(/finance-payment|paymentSummary/i)
  })
  it('never persists payments: the payment modules do not touch local storage or IndexedDB', () => {
    for (const file of ['src/stores/finance-payments.store.ts', 'src/services/finance-payments.service.ts', 'src/utils/finance-payments.ts',
      'src/utils/finance-payment-guards.ts', 'src/views/finance/components/AgreementPayments.vue',
      'src/views/finance/components/AgreementPaymentForm.vue', 'src/views/finance/components/AgreementPaymentReverseForm.vue']) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/localStorage|sessionStorage|indexedDB|local-db|openDB|queue-db|outbox/i)
    }
  })
})
