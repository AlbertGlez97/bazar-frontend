import { describe, expect, it } from 'vitest'
import { renderPdfBlob } from '../pdf-report'
import { buildSalesReport } from '@/utils/sales-report'

// Render REAL con pdfmake (sin mocks): comprueba que la definición es válida
// para pdfmake, que las fuentes empaquetadas cubren acentos y "$" y que sale un PDF de verdad.
const report = buildSalesReport({
  period: { from: '2026-09-24T06:00:00.000Z', to: '2026-09-25T05:59:59.999Z', totalSoldMinor: 125000, saleCount: 1 },
  byMember: { from: '', to: '', items: [{ memberId: 'm-1', memberName: 'María Núñez', role: 'socio', totalSoldMinor: 125000 }] },
  sales: [{
    id: 's-1', memberId: 'm-1', deviceId: 'd', occurredAt: '2026-09-24T20:05:00.000Z', receivedAt: '2026-09-24T20:05:00.000Z',
    currency: 'MXN', status: 'completada', totalMinor: 125000, cashReceivedMinor: 150000, changeMinor: 25000,
    conflictReason: null, conflictDetectedAt: null, items: [{ id: 'i', productId: 'p', quantity: 2, unitPriceMinor: 62500, subtotalMinor: 125000, createdAt: '' }],
  }],
  businessName: 'La Marchanta',
  generatedAt: '2026-09-25T04:00:00.000Z',
})

describe('renderPdfBlob (real pdfmake)', () => {
  it('produces a real PDF', async () => {
    const blob = await renderPdfBlob(report)
    expect(blob.type).toBe('application/pdf')
    // jsdom no implementa Blob.arrayBuffer(): se lee con FileReader.
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(blob)
    })
    const bytes = new Uint8Array(buffer)
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    expect(bytes.length).toBeGreaterThan(2000)
  }, 30_000)
})
