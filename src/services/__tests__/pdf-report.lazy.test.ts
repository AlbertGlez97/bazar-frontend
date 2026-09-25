import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPdfDefinition, downloadPdf, renderPdfBlob } from '../pdf-report'
import { saveBlob } from '@/utils/report-files'
import { buildSalesReport } from '@/utils/sales-report'

vi.mock('@/utils/report-files', () => ({ saveBlob: vi.fn() }))

// pdfmake pesa más de 1 MB: solo debe cargarse cuando se pide un PDF, no al
// importar el módulo del reporte (ni, por tanto, al arrancar la app).
const mocks = vi.hoisted(() => ({
  pdfmakeLoads: 0,
  vfsLoads: 0,
  createPdf: vi.fn(),
  addVirtualFileSystem: vi.fn(),
  vfs: { 'Roboto-Regular.ttf': 'base64' },
}))

vi.mock('pdfmake/build/pdfmake', () => {
  mocks.pdfmakeLoads += 1
  return { default: { createPdf: mocks.createPdf, addVirtualFileSystem: mocks.addVirtualFileSystem } }
})
vi.mock('pdfmake/build/vfs_fonts', () => {
  mocks.vfsLoads += 1
  return { default: mocks.vfs }
})

const report = buildSalesReport({
  period: { from: '2026-09-24T06:00:00.000Z', to: '2026-09-25T05:59:59.999Z', totalSoldMinor: 0, saleCount: 0 },
  byMember: { from: '', to: '', items: [] },
  sales: [],
  businessName: 'La Marchanta',
  generatedAt: '2026-09-25T04:00:00.000Z',
})

describe('renderPdfBlob loads pdfmake lazily', () => {
  const blob = new Blob(['%PDF-'], { type: 'application/pdf' })
  beforeEach(() => {
    mocks.createPdf.mockReset().mockReturnValue({ getBlob: () => Promise.resolve(blob) })
  })

  it('does not load pdfmake or the fonts until a PDF is requested', () => {
    expect(mocks.pdfmakeLoads).toBe(0)
    expect(mocks.vfsLoads).toBe(0)
    buildPdfDefinition(report) // armar la definición no necesita pdfmake
    expect(mocks.pdfmakeLoads).toBe(0)
  })

  it('loads both on the first render, registers the font files once and returns the blob', async () => {
    expect(await renderPdfBlob(report)).toBe(blob)
    expect(mocks.pdfmakeLoads).toBe(1)
    expect(mocks.vfsLoads).toBe(1)
    expect(mocks.addVirtualFileSystem).toHaveBeenCalledWith(mocks.vfs)
    expect(mocks.createPdf).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 'A4' }))

    await renderPdfBlob(report)
    expect(mocks.addVirtualFileSystem).toHaveBeenCalledTimes(1)
    expect(mocks.createPdf).toHaveBeenCalledTimes(2)
  })

  it('downloadPdf renders the PDF and saves it under the given file name', async () => {
    await downloadPdf(report, 'ventas-la-marchanta-2026-09-24.pdf')
    expect(saveBlob).toHaveBeenCalledWith(blob, 'ventas-la-marchanta-2026-09-24.pdf')
  })

  it('downloadPdf saves nothing when the PDF cannot be generated', async () => {
    vi.mocked(saveBlob).mockClear()
    mocks.createPdf.mockReturnValue({ getBlob: () => Promise.reject(new Error('boom')) })
    await expect(downloadPdf(report, 'x.pdf')).rejects.toThrow('boom')
    expect(saveBlob).not.toHaveBeenCalled()
  })
})
