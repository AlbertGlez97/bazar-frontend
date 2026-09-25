import { describe, expect, it, vi } from 'vitest'
import ExcelJS from 'exceljs'
import { buildExcelData, buildWorkbook, downloadExcel, renderExcelBlob, XLSX_MIME } from '../excel-report'
import { saveBlob } from '@/utils/report-files'
import { buildSalesReport } from '@/utils/sales-report'
import type { SalesReport } from '@/types/report.types'
import type { Sale } from '@/types/sale.types'

vi.mock('@/utils/report-files', () => ({ saveBlob: vi.fn() }))

const FROM = '2026-09-24T06:00:00.000Z'
const TO = '2026-09-25T05:59:59.999Z'
const MONEY_FORMAT = '"$"#,##0.00'

function sale(id: string, memberId: string, receivedAt: string, totalMinor: number, cashMinor: number, quantities: number[]): Sale {
  return {
    id, memberId, deviceId: 'd-1', occurredAt: receivedAt, receivedAt, currency: 'MXN', status: 'completada',
    totalMinor, cashReceivedMinor: cashMinor, changeMinor: cashMinor - totalMinor, conflictReason: null, conflictDetectedAt: null,
    items: quantities.map((quantity, i) => ({ id: `${id}-${i}`, productId: `p${i}`, quantity, unitPriceMinor: 1, subtotalMinor: quantity, createdAt: receivedAt })),
  }
}

const DEFAULT_SALES = [
  sale('s-2', 'm-carlos', '2026-09-24T20:05:00.000Z', 125000, 150000, [2, 1]),
  sale('s-1', 'm-ana', '2026-09-24T18:00:00.000Z', 5050, 10000, [1]),
]

function makeReport(
  sales: Sale[] = DEFAULT_SALES,
  names: Record<string, string> = { 'm-ana': 'Ana', 'm-carlos': 'Carlos Núñez' },
  extra: { forceMismatch?: boolean; truncated?: boolean } = {},
): SalesReport {
  const total = sales.reduce((sum, s) => sum + (s.totalMinor ?? 0), 0)
  return buildSalesReport({
    period: { from: FROM, to: TO, totalSoldMinor: extra.forceMismatch ? total + 1 : total, saleCount: sales.length },
    byMember: {
      from: FROM, to: TO,
      items: Object.entries(names).map(([memberId, memberName]) => ({
        memberId, memberName, role: memberId === 'm-ana' ? 'socio' as const : 'colaborador' as const, totalSoldMinor: 0,
      })),
    },
    sales,
    businessName: 'La Marchanta',
    generatedAt: '2026-09-25T04:00:00.000Z',
    truncated: extra.truncated,
  })
}

describe('buildExcelData (pure shaping, no exceljs)', () => {
  it('turns each sale into a row with a business wall-clock Date and amounts in pesos', () => {
    const data = buildExcelData(makeReport())
    expect(data.sales.rows).toHaveLength(2)
    const [first, second] = data.sales.rows
    expect(first.date.toISOString()).toBe('2026-09-24T12:00:00.000Z') // 18:00Z = 12:00 en el negocio
    expect(first).toMatchObject({ seller: 'Ana', articles: 1, total: 50.5, cash: 100, change: 49.5 })
    expect(second.date.toISOString()).toBe('2026-09-24T14:05:00.000Z')
    expect(second).toMatchObject({ seller: 'Carlos Núñez', articles: 3, total: 1250, cash: 1500, change: 250 })
  })

  it('sums in minor units and converts last (10 + 20 cents is exactly 0.30, not 0.30000000000000004)', () => {
    const data = buildExcelData(makeReport([
      sale('a', 'm-ana', '2026-09-24T18:00:00.000Z', 10, 10, [1]),
      sale('b', 'm-ana', '2026-09-24T19:00:00.000Z', 20, 20, [1]),
    ]))
    expect(data.sales.totals.total).toBe(0.3)
    expect(0.1 + 0.2).not.toBe(0.3) // la trampa que se evita
  })

  it('shapes the per-person sheet with role, count, total and share as a fraction', () => {
    const { people } = buildExcelData(makeReport())
    expect(people.rows).toEqual([
      { name: 'Carlos Núñez', role: 'Colaborador', count: 1, total: 1250, share: 0.961 },
      { name: 'Ana', role: 'Socio', count: 1, total: 50.5, share: 0.039 },
    ])
    expect(people.totals).toEqual({ count: 2, total: 1300.5 })
  })

  it('shapes a summary with business, range, generation time, counts and total', () => {
    const { summary } = buildExcelData(makeReport())
    expect(summary.title).toBe('La Marchanta')
    expect(summary.subtitle).toBe('Ventas del 24/09/2026')
    expect(summary.rows).toEqual([
      { label: 'Periodo', value: '24/09/2026' },
      { label: 'Generado el', value: '24/09/2026 22:00' },
      { label: 'Ventas', value: 2 },
      { label: 'Artículos', value: 4 },
      { label: 'Total vendido', value: 1300.5, money: true },
    ])
  })

  it('says "del ... al ..." for a multi-day range', () => {
    const report = buildSalesReport({
      period: { from: '2026-09-20T06:00:00.000Z', to: '2026-09-27T05:59:59.999Z', totalSoldMinor: 0, saleCount: 0 },
      byMember: { from: '', to: '', items: [] }, sales: [], businessName: 'La Marchanta', generatedAt: '2026-09-25T04:00:00.000Z',
    })
    const { summary } = buildExcelData(report)
    expect(summary.subtitle).toBe('Ventas del 20/09/2026 al 26/09/2026')
    expect(summary.rows[0]).toEqual({ label: 'Periodo', value: '20/09/2026 al 26/09/2026' })
  })

  it('adds warnings only when the detail is cut or does not match the report', () => {
    expect(buildExcelData(makeReport()).summary.notes).toEqual([])
    const notes = buildExcelData(makeReport(DEFAULT_SALES, undefined, { forceMismatch: true, truncated: true })).summary.notes
    expect(notes).toHaveLength(2)
    expect(notes.join(' ')).toContain('límite de ventas')
    expect(notes.join(' ')).toContain('no coincide con el reporte del periodo')
  })
})

describe('buildWorkbook (real exceljs)', () => {
  it('has the sheets Ventas, Por persona and Resumen', async () => {
    const wb = await buildWorkbook(makeReport())
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(['Ventas', 'Por persona', 'Resumen'])
  })

  it('writes the Ventas header styled, frozen and filtered', async () => {
    const ws = (await buildWorkbook(makeReport())).getWorksheet('Ventas')!
    expect(ws.getRow(1).values).toEqual([undefined, 'Fecha', 'Persona', 'Artículos', 'Total', 'Efectivo recibido', 'Cambio'])
    const head = ws.getCell('A1')
    expect(head.font?.bold).toBe(true)
    expect(head.fill).toMatchObject({ type: 'pattern', fgColor: { argb: 'FFB8501C' } })
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 })
    expect(ws.autoFilter).toBe('A1:F3')
  })

  it('writes real dates, real numbers and money/date formats', async () => {
    const ws = (await buildWorkbook(makeReport())).getWorksheet('Ventas')!
    const date = ws.getCell('A2')
    expect(date.value).toBeInstanceOf(Date)
    expect((date.value as Date).toISOString()).toBe('2026-09-24T12:00:00.000Z')
    expect(date.numFmt).toBe('dd/mm/yyyy hh:mm')
    expect(ws.getCell('B2').value).toBe('Ana')
    expect(ws.getCell('C2').value).toBe(1)
    for (const address of ['D2', 'E2', 'F2', 'D3']) {
      const cell = ws.getCell(address)
      expect(typeof cell.value).toBe('number')
      expect(cell.numFmt).toBe(MONEY_FORMAT)
    }
    expect(ws.getCell('D2').value).toBe(50.5)
    expect(ws.getCell('D3').value).toBe(1250)
  })

  it('adds a totals row with SUM formulas and cached results', async () => {
    const ws = (await buildWorkbook(makeReport())).getWorksheet('Ventas')!
    // Filas 2-3 de datos, fila 4 en blanco, totales en la 5.
    expect(ws.getCell('A5').value).toBe('Total')
    expect(ws.getCell('B5').value).toBe('2 ventas')
    expect(ws.getCell('C5').value).toEqual({ formula: 'SUM(C2:C3)', result: 4 })
    expect(ws.getCell('D5').value).toEqual({ formula: 'SUM(D2:D3)', result: 1300.5 })
    expect(ws.getCell('E5').value).toEqual({ formula: 'SUM(E2:E3)', result: 1600 })
    expect(ws.getCell('F5').value).toEqual({ formula: 'SUM(F2:F3)', result: 299.5 })
    expect(ws.getCell('D5').numFmt).toBe(MONEY_FORMAT)
    expect(ws.getCell('D5').font?.bold).toBe(true)
  })

  it('sets readable column widths', async () => {
    const ws = (await buildWorkbook(makeReport())).getWorksheet('Ventas')!
    expect(ws.getColumn(1).width).toBeGreaterThanOrEqual(16)
    expect(ws.getColumn(2).width).toBeGreaterThanOrEqual(14)
  })

  it('builds an empty report without formulas or crashes', async () => {
    const ws = (await buildWorkbook(makeReport([]))).getWorksheet('Ventas')!
    expect(ws.getRow(1).values).toEqual([undefined, 'Fecha', 'Persona', 'Artículos', 'Total', 'Efectivo recibido', 'Cambio'])
    expect(ws.getCell('A2').value).toBe('Total')
    expect(ws.getCell('D2').value).toBe(0)
    expect(ws.autoFilter).toBeFalsy()
  })

  it('writes the Por persona sheet', async () => {
    const ws = (await buildWorkbook(makeReport())).getWorksheet('Por persona')!
    expect(ws.getRow(1).values).toEqual([undefined, 'Persona', 'Rol', 'Ventas', 'Total vendido', '% del total'])
    expect(ws.getCell('A2').value).toBe('Carlos Núñez')
    expect(ws.getCell('B2').value).toBe('Colaborador')
    expect(ws.getCell('D2').value).toBe(1250)
    expect(ws.getCell('D2').numFmt).toBe(MONEY_FORMAT)
    expect(ws.getCell('E2').value).toBe(0.961)
    expect(ws.getCell('E2').numFmt).toBe('0.0%')
    expect(ws.getCell('D4').value).toEqual({ formula: 'SUM(D2:D3)', result: 1300.5 })
  })

  it('writes the Resumen sheet', async () => {
    const ws = (await buildWorkbook(makeReport())).getWorksheet('Resumen')!
    expect(ws.getCell('A1').value).toBe('La Marchanta')
    expect(ws.getCell('A2').value).toBe('Ventas del 24/09/2026')
    const labels = ws.getColumn(1).values.filter(Boolean)
    expect(labels).toEqual(expect.arrayContaining(['Periodo', 'Generado el', 'Ventas', 'Artículos', 'Total vendido']))
    const totalRow = ws.getRows(1, 12)!.find((row) => row.getCell(1).value === 'Total vendido')!
    expect(totalRow.getCell(2).value).toBe(1300.5)
    expect(totalRow.getCell(2).numFmt).toBe(MONEY_FORMAT)
  })

  it('stores seller names that look like formulas as plain text', async () => {
    const evil = ['=HYPERLINK("http://x","y")', '+SUM(1,1)', '-2+3', '@SUM(1)']
    const sales = evil.map((_, i) => sale(`e${i}`, `m-${i}`, `2026-09-24T1${i}:00:00.000Z`, 100, 100, [1]))
    const names = Object.fromEntries(evil.map((name, i) => [`m-${i}`, name]))
    const wb = await buildWorkbook(makeReport(sales, names))

    for (const [sheetName, column] of [['Ventas', 2], ['Por persona', 1]] as const) {
      const ws = wb.getWorksheet(sheetName)!
      const values = evil.map((_, i) => ws.getRow(i + 2).getCell(column))
      for (const cell of values) {
        expect(cell.type).toBe(ExcelJS.ValueType.String)
        expect(evil).toContain(cell.value)
        expect(cell.numFmt).toBe('@')
      }
    }
  })

  it('survives a write/read round trip with the same values', async () => {
    const wb = await buildWorkbook(makeReport())
    const buffer = await wb.xlsx.writeBuffer()
    const loaded = await new ExcelJS.Workbook().xlsx.load(buffer as ArrayBuffer)
    const ws = loaded.getWorksheet('Ventas')!
    expect(ws.getCell('B3').value).toBe('Carlos Núñez')
    expect(ws.getCell('D3').value).toBe(1250)
    expect((ws.getCell('A3').value as Date).toISOString()).toBe('2026-09-24T14:05:00.000Z')
    expect(ws.getCell('D5').value).toEqual({ formula: 'SUM(D2:D3)', result: 1300.5 })
    expect(ws.getCell('A1').type).toBe(ExcelJS.ValueType.String)
    expect(ws.autoFilter).toBe('A1:F3')
    expect(loaded.getWorksheet('Por persona')!.getCell('D2').value).toBe(1250)
  })
})

describe('downloadExcel', () => {
  it('renders the workbook and saves it under the given file name', async () => {
    await downloadExcel(makeReport(), 'ventas-la-marchanta-2026-09-24.xlsx')
    expect(saveBlob).toHaveBeenCalledTimes(1)
    const [blob, name] = vi.mocked(saveBlob).mock.calls[0]
    expect(name).toBe('ventas-la-marchanta-2026-09-24.xlsx')
    expect(blob.type).toBe(XLSX_MIME)
  })
})

describe('renderExcelBlob', () => {
  it('returns an xlsx Blob (a zip: starts with "PK")', async () => {
    const blob = await renderExcelBlob(makeReport())
    expect(blob.type).toBe(XLSX_MIME)
    expect(XLSX_MIME).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(blob.size).toBeGreaterThan(1000)
    const head = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(new TextDecoder().decode(new Uint8Array(reader.result as ArrayBuffer)))
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(blob.slice(0, 2))
    })
    expect(head).toBe('PK')
  })
})
