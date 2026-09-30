import type { Workbook, Row } from 'exceljs'
import { REPORT_COLORS, toArgb } from '@/config/report-palette'
import { businessWallClock, formatBusinessDateTime } from '@/utils/business-time'
import { saveBlob } from '@/utils/report-files'
import { deudaTypeLabel, GANANCIA_NO_DISPONIBLE, plural, profitPartialNote, rangeDescription, reportNotes, roleLabel } from '@/utils/sales-report'
import type { SalesReport } from '@/types/report.types'

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const MONEY_FORMAT = '"$"#,##0.00'
const DATE_FORMAT = 'dd/mm/yyyy hh:mm'
const PERCENT_FORMAT = '0.0%'
/** Formato de texto: una celda de nombre que empieza con `=`, `+`, `-` o `@` sigue siendo texto aunque la editen. */
const TEXT_FORMAT = '@'

/**
 * Los importes viajan en centavos enteros y se suman así; esta conversión es lo
 * ÚLTIMO que ocurre (una celda de Excel guarda un número de pesos). Nunca se
 * suman pesos flotantes: 10 + 20 centavos es 0.3 exacto, no 0.30000000000000004.
 */
const toPesos = (minor: number) => minor / 100

export interface ExcelSalesRow {
  /** Fecha cuyos campos UTC son la hora de pared del negocio (ver `businessWallClock`). */
  date: Date
  seller: string
  articles: number
  total: number
}

export interface ExcelPersonRow {
  name: string
  role: string
  count: number
  total: number
  /** Fracción (0.961 = 96.1 %), para el formato de porcentaje de Excel. */
  share: number
}

export interface ExcelSummaryRow {
  label: string
  value: string | number
  money?: boolean
}

export interface ExcelProductRow {
  product: string
  member: string
  units: number
  income: number
  /** `null` cuando `gananciaDisponible` es `false` — se escribe "No disponible", NUNCA `0`. */
  profit: number | null
}

/** Una fila de la hoja "Abonos recibidos" (BE-15/D7). */
export interface ExcelAbonoRow {
  date: Date
  deudor: string
  type: string
  amount: number
}

/** Una fila de la hoja "Deudas liquidadas" (BE-15/D7). */
export interface ExcelDeudaLiquidadaRow {
  deudor: string
  type: string
  total: number
  saldadaAt: Date
  /** `null` cuando `gananciaDisponible` es `false` — se escribe "No disponible", NUNCA `0`. */
  profit: number | null
}

/** Los datos de las hojas, ya en pesos y listos para escribir (sin ExcelJS). */
export interface ExcelReportData {
  sales: {
    rows: ExcelSalesRow[]
    totals: { count: number; articles: number; total: number }
  }
  people: {
    rows: ExcelPersonRow[]
    totals: { count: number; total: number }
  }
  /**
   * Desglose por producto/vendedor (D4). `undefined` cuando el reporte no
   * pidió el detalle (`SalesReport.detail` ausente) — la hoja "Por producto"
   * no se agrega en ese caso.
   */
  product?: {
    rows: ExcelProductRow[]
    /** Del periodo completo, no una suma de las filas visibles (misma regla que `sales-detail.totals`). */
    totals: { income: number; profit: number }
    note: string | null
  }
  /**
   * BE-15/D7: abonos recibidos y deudas liquidadas del periodo, SIEMPRE
   * presentes (a diferencia de `product`) — `sales-by-period` ya las trae.
   */
  abonos: { rows: ExcelAbonoRow[]; totalAmount: number }
  deudasLiquidadas: { rows: ExcelDeudaLiquidadaRow[] }
  summary: {
    title: string
    subtitle: string
    rows: ExcelSummaryRow[]
    notes: string[]
  }
}

/** Da forma a los datos del reporte para el libro. Pura: no carga ExcelJS. */
export function buildExcelData(report: SalesReport): ExcelReportData {
  const { totals } = report
  return {
    sales: {
      rows: report.rows.map((row) => ({
        date: businessWallClock(row.receivedAt),
        seller: row.sellerName,
        articles: row.articleCount,
        total: toPesos(row.totalMinor),
      })),
      totals: {
        count: totals.saleCount,
        articles: totals.articleCount,
        total: toPesos(totals.totalMinor),
      },
    },
    people: {
      rows: report.people.map((person) => ({
        name: person.name,
        role: roleLabel(person.role),
        count: person.saleCount,
        total: toPesos(person.totalMinor),
        share: Math.round(person.sharePercent * 10) / 1000,
      })),
      totals: { count: totals.saleCount, total: toPesos(totals.totalMinor) },
    },
    product: report.detail && {
      rows: report.detail.rows.map((row) => ({
        product: row.productName,
        member: row.memberName,
        units: row.units,
        income: toPesos(row.ingresoMinor),
        profit: row.gananciaDisponible && row.gananciaMinor !== null ? toPesos(row.gananciaMinor) : null,
      })),
      totals: {
        income: toPesos(report.detail.totals.ingresoMinor),
        profit: toPesos(report.detail.totals.gananciaMinor),
      },
      note: profitPartialNote(report.detail.totals.lineasSinCosto),
    },
    abonos: {
      rows: report.abonosRecibidos.map((abono) => ({
        date: businessWallClock(abono.fecha),
        deudor: abono.deudor,
        type: deudaTypeLabel(abono.type),
        amount: toPesos(abono.montoMinor),
      })),
      totalAmount: toPesos(report.abonosRecibidosMinor),
    },
    deudasLiquidadas: {
      rows: report.deudasLiquidadas.map((deuda) => ({
        deudor: deuda.deudor,
        type: deudaTypeLabel(deuda.type),
        total: toPesos(deuda.totalMinor),
        saldadaAt: businessWallClock(deuda.saldadaAt),
        profit: deuda.gananciaDisponible && deuda.gananciaMinor !== null ? toPesos(deuda.gananciaMinor) : null,
      })),
    },
    summary: {
      title: report.businessName,
      subtitle: `Ventas del ${rangeDescription(report)}`,
      rows: [
        { label: 'Periodo', value: rangeDescription(report) },
        { label: 'Generado el', value: formatBusinessDateTime(report.generatedAt) },
        { label: 'Ventas', value: totals.saleCount },
        { label: 'Artículos', value: totals.articleCount },
        { label: 'Total vendido', value: toPesos(totals.totalMinor), money: true },
        { label: 'Abonos recibidos', value: toPesos(report.abonosRecibidosMinor), money: true },
        // BE-15/D7: total combinado — ventas de contado + abonos reales.
        { label: 'Total ingresado', value: toPesos(report.totalIngresadoMinor), money: true },
      ],
      notes: reportNotes(report),
    },
  }
}

type ExcelJsModule = typeof import('exceljs')

/** ExcelJS solo se carga al pedir un Excel (~1 MB que nadie necesita para ver los totales). */
async function loadExcelJs(): Promise<ExcelJsModule> {
  const mod = await import('exceljs')
  return ((mod as { default?: ExcelJsModule }).default ?? mod) as ExcelJsModule
}

const headerStyle = (row: Row, rightFrom: number[]) => {
  row.height = 22
  row.eachCell((cell, column) => {
    cell.font = { bold: true, color: { argb: toArgb(REPORT_COLORS.onPrimary) } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: toArgb(REPORT_COLORS.primary) } }
    cell.alignment = { vertical: 'middle', horizontal: rightFrom.includes(column) ? 'right' : 'left' }
  })
}

const totalsStyle = (row: Row, columns: number) => {
  for (let column = 1; column <= columns; column++) {
    const cell = row.getCell(column)
    cell.font = { bold: true, color: { argb: toArgb(REPORT_COLORS.text) } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: toArgb(REPORT_COLORS.primarySoft) } }
    cell.border = { top: { style: 'thin', color: { argb: toArgb(REPORT_COLORS.primary) } } }
  }
}

const nameWidth = (names: string[], minimum: number) =>
  Math.min(40, Math.max(minimum, ...names.map((name) => name.length + 2)))

function addSalesSheet(workbook: Workbook, data: ExcelReportData) {
  const { rows, totals } = data.sales
  const ws = workbook.addWorksheet('Ventas', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = [
    { width: 18 },
    { width: nameWidth(rows.map((r) => r.seller), 16) },
    { width: 11 },
    { width: 14 },
  ]

  headerStyle(ws.addRow(['Fecha', 'Persona', 'Artículos', 'Total']), [3, 4])

  for (const item of rows) {
    const row = ws.addRow([item.date, item.seller, item.articles, item.total])
    row.getCell(1).numFmt = DATE_FORMAT
    row.getCell(2).numFmt = TEXT_FORMAT
    row.getCell(4).numFmt = MONEY_FORMAT
  }

  const n = rows.length
  // Con detalle: una fila en blanco y los totales con SUM (así el filtro y los
  // cálculos del propio Excel siguen vivos). Sin detalle: ceros directos.
  const totalsRow = ws.getRow(n === 0 ? 2 : n + 3)
  totalsRow.getCell(1).value = 'Total'
  totalsRow.getCell(2).value = plural(totals.count, 'venta', 'ventas')
  const sums: Array<[column: number, letter: string, result: number]> = [
    [3, 'C', totals.articles],
    [4, 'D', totals.total],
  ]
  for (const [column, letter, result] of sums) {
    const cell = totalsRow.getCell(column)
    cell.value = n === 0 ? result : { formula: `SUM(${letter}2:${letter}${n + 1})`, result }
    if (column >= 4) cell.numFmt = MONEY_FORMAT
  }
  totalsStyle(totalsRow, 4)

  if (n > 0) ws.autoFilter = `A1:D${n + 1}`
}

function addPeopleSheet(workbook: Workbook, data: ExcelReportData) {
  const { rows, totals } = data.people
  const ws = workbook.addWorksheet('Por persona')
  ws.columns = [{ width: nameWidth(rows.map((r) => r.name), 18) }, { width: 14 }, { width: 10 }, { width: 16 }, { width: 13 }]

  headerStyle(ws.addRow(['Persona', 'Rol', 'Ventas', 'Total vendido', '% del total']), [3, 4, 5])
  for (const item of rows) {
    const row = ws.addRow([item.name, item.role, item.count, item.total, item.share])
    row.getCell(1).numFmt = TEXT_FORMAT
    row.getCell(4).numFmt = MONEY_FORMAT
    row.getCell(5).numFmt = PERCENT_FORMAT
  }

  const n = rows.length
  const totalsRow = ws.getRow(n + 2)
  totalsRow.getCell(1).value = 'Total'
  totalsRow.getCell(3).value = n === 0 ? totals.count : { formula: `SUM(C2:C${n + 1})`, result: totals.count }
  totalsRow.getCell(4).value = n === 0 ? totals.total : { formula: `SUM(D2:D${n + 1})`, result: totals.total }
  totalsRow.getCell(4).numFmt = MONEY_FORMAT
  totalsStyle(totalsRow, 5)
}

/** Hoja "Por producto" (D4): ganancia real por producto/vendedor, con hueco explícito nunca escrito como `0`. */
function addProductSheet(workbook: Workbook, data: ExcelReportData) {
  const { rows, totals, note } = data.product!
  const ws = workbook.addWorksheet('Por producto', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = [
    { width: nameWidth(rows.map((r) => r.product), 20) },
    { width: nameWidth(rows.map((r) => r.member), 16) },
    { width: 11 },
    { width: 14 },
    { width: 14 },
  ]

  headerStyle(ws.addRow(['Producto', 'Persona', 'Unidades', 'Ingreso', 'Ganancia']), [3, 4, 5])

  for (const item of rows) {
    const row = ws.addRow([item.product, item.member, item.units, item.income, item.profit ?? GANANCIA_NO_DISPONIBLE])
    row.getCell(1).numFmt = TEXT_FORMAT
    row.getCell(2).numFmt = TEXT_FORMAT
    row.getCell(4).numFmt = MONEY_FORMAT
    if (item.profit !== null) row.getCell(5).numFmt = MONEY_FORMAT
  }

  const n = rows.length
  // Los totales son del periodo COMPLETO (regla distinta a la de cada fila:
  // una fila sin ganancia visible no participa en una suma parcial), así que
  // se escriben tal cual en vez de una fórmula SUM sobre las filas visibles.
  const totalsRow = ws.getRow(n + 2)
  totalsRow.getCell(1).value = 'Total'
  totalsRow.getCell(4).value = totals.income
  totalsRow.getCell(4).numFmt = MONEY_FORMAT
  totalsRow.getCell(5).value = totals.profit
  totalsRow.getCell(5).numFmt = MONEY_FORMAT
  totalsStyle(totalsRow, 5)

  if (note) {
    const noteRow = ws.getRow(n + 4)
    const label = noteRow.getCell(1)
    label.value = 'Aviso'
    label.font = { bold: true, color: { argb: toArgb(REPORT_COLORS.warning) } }
    const text = noteRow.getCell(2)
    text.value = note
    text.alignment = { wrapText: true, vertical: 'top' }
    text.font = { color: { argb: toArgb(REPORT_COLORS.warning) } }
    text.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: toArgb(REPORT_COLORS.warningSoft) } }
    noteRow.height = 48
  }
}

/** Hoja "Abonos recibidos" (BE-15/D7): todo Abono real del periodo, con totales SUM (la lista completa, sin paginar). */
function addAbonosSheet(workbook: Workbook, data: ExcelReportData) {
  const { rows, totalAmount } = data.abonos
  const ws = workbook.addWorksheet('Abonos recibidos', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = [
    { width: 18 },
    { width: nameWidth(rows.map((r) => r.deudor), 16) },
    { width: 12 },
    { width: 14 },
  ]

  headerStyle(ws.addRow(['Fecha', 'Deudor', 'Tipo', 'Monto']), [4])

  for (const item of rows) {
    const row = ws.addRow([item.date, item.deudor, item.type, item.amount])
    row.getCell(1).numFmt = DATE_FORMAT
    row.getCell(2).numFmt = TEXT_FORMAT
    row.getCell(4).numFmt = MONEY_FORMAT
  }

  const n = rows.length
  const totalsRow = ws.getRow(n === 0 ? 2 : n + 3)
  totalsRow.getCell(1).value = 'Total'
  const amountCell = totalsRow.getCell(4)
  amountCell.value = n === 0 ? totalAmount : { formula: `SUM(D2:D${n + 1})`, result: totalAmount }
  amountCell.numFmt = MONEY_FORMAT
  totalsStyle(totalsRow, 4)
}

/** Hoja "Deudas liquidadas" (BE-15/D7): ganancia real, con hueco explícito nunca escrito como `0`. */
function addDeudasLiquidadasSheet(workbook: Workbook, data: ExcelReportData) {
  const { rows } = data.deudasLiquidadas
  const ws = workbook.addWorksheet('Deudas liquidadas', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = [
    { width: nameWidth(rows.map((r) => r.deudor), 18) },
    { width: 12 },
    { width: 14 },
    { width: 18 },
    { width: 14 },
  ]

  headerStyle(ws.addRow(['Deudor', 'Tipo', 'Total', 'Liquidada el', 'Ganancia']), [3, 5])

  for (const item of rows) {
    const row = ws.addRow([item.deudor, item.type, item.total, item.saldadaAt, item.profit ?? GANANCIA_NO_DISPONIBLE])
    row.getCell(1).numFmt = TEXT_FORMAT
    row.getCell(3).numFmt = MONEY_FORMAT
    row.getCell(4).numFmt = DATE_FORMAT
    if (item.profit !== null) row.getCell(5).numFmt = MONEY_FORMAT
  }

  if (rows.length === 0) return
  const n = rows.length
  const totalsRow = ws.getRow(n + 2)
  totalsRow.getCell(1).value = 'Total'
  totalsRow.getCell(3).value = { formula: `SUM(C2:C${n + 1})`, result: rows.reduce((sum, r) => sum + r.total, 0) }
  totalsRow.getCell(3).numFmt = MONEY_FORMAT
  const profitableRows = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.profit !== null)
  if (profitableRows.length > 0) {
    totalsRow.getCell(5).value = {
      formula: `SUM(${profitableRows.map(({ i }) => `E${i + 2}`).join(',')})`,
      result: profitableRows.reduce((sum, { r }) => sum + (r.profit ?? 0), 0),
    }
    totalsRow.getCell(5).numFmt = MONEY_FORMAT
  }
  totalsStyle(totalsRow, 5)
}

function addSummarySheet(workbook: Workbook, data: ExcelReportData) {
  const { title, subtitle, rows, notes } = data.summary
  const ws = workbook.addWorksheet('Resumen')
  ws.columns = [{ width: 18 }, { width: 70 }]

  ws.getCell('A1').value = title
  ws.getCell('A1').font = { bold: true, size: 16, color: { argb: toArgb(REPORT_COLORS.primary) } }
  ws.getCell('A2').value = subtitle
  ws.getCell('A2').font = { size: 12, color: { argb: toArgb(REPORT_COLORS.text) } }

  let index = 4
  for (const item of rows) {
    const label = ws.getCell(index, 1)
    label.value = item.label
    label.font = { bold: true, color: { argb: toArgb(REPORT_COLORS.textMuted) } }
    const value = ws.getCell(index, 2)
    value.value = item.value
    value.alignment = { horizontal: 'left' }
    if (item.money) {
      value.numFmt = MONEY_FORMAT
      value.font = { bold: true, size: 14, color: { argb: toArgb(REPORT_COLORS.primary) } }
    }
    index += 1
  }

  for (const note of notes) {
    index += 1
    const label = ws.getCell(index, 1)
    label.value = 'Aviso'
    label.font = { bold: true, color: { argb: toArgb(REPORT_COLORS.warning) } }
    const text = ws.getCell(index, 2)
    text.value = note
    text.alignment = { wrapText: true, vertical: 'top' }
    text.font = { color: { argb: toArgb(REPORT_COLORS.warning) } }
    text.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: toArgb(REPORT_COLORS.warningSoft) } }
    ws.getRow(index).height = 48
  }
}

/**
 * Libro de Excel con tres hojas: "Ventas" (una fila por venta, con fecha real,
 * importes numéricos, filtro y totales con SUM), "Por persona" y "Resumen".
 * Carga ExcelJS la primera vez que se llama.
 */
export async function buildWorkbook(report: SalesReport): Promise<Workbook> {
  const ExcelJS = await loadExcelJs()
  const data = buildExcelData(report)
  const workbook = new ExcelJS.Workbook()
  workbook.creator = report.businessName
  workbook.created = new Date(report.generatedAt)
  addSalesSheet(workbook, data)
  addPeopleSheet(workbook, data)
  if (data.product) addProductSheet(workbook, data)
  addAbonosSheet(workbook, data)
  addDeudasLiquidadasSheet(workbook, data)
  addSummarySheet(workbook, data)
  return workbook
}

/** Serializa el libro a un Blob `.xlsx`. */
export async function workbookToBlob(workbook: Workbook): Promise<Blob> {
  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], { type: XLSX_MIME })
}

/** Genera el Excel completo como Blob. Carga ExcelJS la primera vez. */
export async function renderExcelBlob(report: SalesReport): Promise<Blob> {
  return workbookToBlob(await buildWorkbook(report))
}

/** Genera el Excel y lo descarga con ese nombre. Si falla la generación no se guarda nada y el error se propaga. */
export async function downloadExcel(report: SalesReport, filename: string): Promise<void> {
  saveBlob(await renderExcelBlob(report), filename)
}
