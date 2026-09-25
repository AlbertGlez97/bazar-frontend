import { describe, expect, it, vi } from 'vitest'
import { buildExcelData, buildWorkbook } from '../excel-report'
import { buildSalesReport } from '@/utils/sales-report'

// exceljs pesa cerca de 1 MB: solo debe cargarse al pedir un Excel, no al
// importar el módulo ni al dar forma a los datos.
const mocks = vi.hoisted(() => ({ loads: 0 }))

vi.mock('exceljs', () => {
  mocks.loads += 1
  class Workbook {
    worksheets: unknown[] = []
    addWorksheet() {
      const ws = { columns: [], views: [], addRow: () => ({ font: {}, getCell: () => ({}), eachCell: () => undefined }), getRow: () => ({ eachCell: () => undefined, getCell: () => ({}) }), getColumn: () => ({}), getCell: () => ({}) }
      this.worksheets.push(ws)
      return ws
    }
  }
  return { default: { Workbook }, Workbook }
})

const report = buildSalesReport({
  period: { from: '2026-09-24T06:00:00.000Z', to: '2026-09-25T05:59:59.999Z', totalSoldMinor: 0, saleCount: 0 },
  byMember: { from: '', to: '', items: [] }, sales: [], businessName: 'La Marchanta', generatedAt: '2026-09-25T04:00:00.000Z',
})

describe('exceljs is loaded lazily', () => {
  it('does not load exceljs on import nor when shaping the data', () => {
    buildExcelData(report)
    expect(mocks.loads).toBe(0)
  })

  it('loads exceljs only when the workbook is built', async () => {
    await buildWorkbook(report).catch(() => undefined) // el mock es mínimo; solo importa que se pidió el módulo
    expect(mocks.loads).toBe(1)
  })
})
