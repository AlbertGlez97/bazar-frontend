// Generación del reporte financiero anual en Excel — 100% en el frontend.
// Los datos llegan ya descifrados desde los stores de Pinia (E2EE: el servidor
// no ve nada; el descifrado pasa en memoria). Este módulo es puro: recibe
// estructuras planas y devuelve el .xlsx — no conoce stores ni la red.
//
// Estructura del workbook (en orden):
//   1.  RESUMEN ANUAL          — pivot de 12 meses Presupuesto vs Real
//   2-13. ENE…DIC              — solo los meses que tienen budget cargado
//   14. DEUDAS Y AMORTIZACIÓN  — resumen + tabla por deuda
//   15. METAS DE AHORRO        — metas + historial de contribuciones

import ExcelJS from 'exceljs'

// ─── Tipos de entrada ───────────────────────────────────────────────────────

export interface ExportIncome  { name: string; budgeted: number; actual: number }
export interface ExportBill    { name: string; budgeted: number; actual: number; dueDate: string | null; paymentType: string | null; isPaid: boolean }
export interface ExportExpenseCategory { category: string; budgeted: number; actual: number }
export interface ExportTransaction { date: string; category: string; note: string | null; paymentType: string | null; amount: number }

export interface ExportReglaBlock { limite: number; actual: number }
export interface ExportRegla { necesidades: ExportReglaBlock; deseos: ExportReglaBlock; ahorro: ExportReglaBlock }

export interface ExportBudget {
  year:                          number
  month:                         number   // 1 = enero, 12 = diciembre
  totalIngresoReal:              number
  totalIngresoBudgeted:          number
  totalFacturasReal:             number
  totalFacturasBudgeted:         number
  totalGastosVariablesReal:      number
  totalGastosVariablesBudgeted:  number
  disponible:                    number
  pagoDeudasMin:                 number   // suma de pagos mínimos de las deudas activas
  regla:                         ExportRegla
  incomes:                       ExportIncome[]
  bills:                         ExportBill[]
  expenses:                      ExportExpenseCategory[]
  transactions:                  ExportTransaction[]
}

export interface ExportAmortizationRow {
  mes:           number
  fechaEstimada: string
  pagoEsperado:  number
  capital:       number
  interes:       number
  iva:           number
  saldoRestante: number
}

export interface ExportDebt {
  id:                 string
  name:               string
  initialAmount:      number
  remainingBalance:   number
  capitalAmortizado:  number
  porcentajeAvance:   number   // 0–100
  minimumPayment:     number
  annualInterestRate: number   // % anual (ej. 18.5)
  rateType:           'fixed' | 'variable'
  ivaRate:            number   // 0 cuando no aplica
  method:             string   // etiqueta legible
  status:             string   // 'Activa' | 'Pausada' | 'Liquidada'
  amortization:       ExportAmortizationRow[]
}

export interface ExportSavingContribution { date: string; amount: number; note: string | null }

export interface ExportSavingGoal {
  id:                    string
  name:                  string
  targetAmount:          number
  currentAmount:         number
  restante:              number
  porcentaje:            number
  frecuencia:            string   // etiqueta legible
  aportePorPeriodo:      number
  aporteMensualEfectivo: number
  mesesRestantes:        number | null
  fechaEstimada:         string | null
  esAporteUnico:         boolean
  isCompleted:           boolean
  contributions:         ExportSavingContribution[]
}

export interface ExportData {
  year:    number
  budgets: ExportBudget[]
  debts:   ExportDebt[]
  savings: ExportSavingGoal[]
}

// ─── Paleta de colores y formatos (HEX sin #, ExcelJS no acepta el prefijo) ─

const C = {
  HEADER_BG:       'FF1E3A5F',
  HEADER_FG:       'FFFFFFFF',
  SECTION_BG:      'FF2563EB',
  SECTION_FG:      'FFFFFFFF',
  TABLE_HEAD_BG:   'FFEFF6FF',
  TABLE_HEAD_FG:   'FF1E40AF',
  TOTAL_BG:        'FFF0FDF4',
  TOTAL_FG:        'FF166534',
  POSITIVE:        'FF16A34A',
  NEGATIVE:        'FFDC2626',
  ROW_ODD:         'FFFFFFFF',
  ROW_EVEN:        'FFF8FAFC',
  BORDER:          'FFCBD5E1',
  WARNING_BG:      'FFFEE2E2',
  EMPTY_FG:        'FF94A3B8',
}

const FMT = {
  CURRENCY: '"$"#,##0.00;[Red]("$"#,##0.00)',
  PERCENT:  '0.0%',
  DATE:     'DD/MM/YYYY',
  INTEGER:  '#,##0',
}

const BASE_FONT = { name: 'Arial', size: 10 }

const MES_CORTO = ['', 'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
const MES_LARGO = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

// ─── Helpers de estilo ──────────────────────────────────────────────────────

const thinBorder: ExcelJS.Borders = {
  top:    { style: 'thin', color: { argb: C.BORDER } },
  left:   { style: 'thin', color: { argb: C.BORDER } },
  bottom: { style: 'thin', color: { argb: C.BORDER } },
  right:  { style: 'thin', color: { argb: C.BORDER } },
  diagonal: { style: 'thin' },
}

/** Cabecera principal de la hoja: fila 1 con merge, fondo azul oscuro, 14pt bold. */
function applySheetTitle(ws: ExcelJS.Worksheet, title: string, lastCol: string) {
  ws.mergeCells(`A1:${lastCol}1`)
  const cell = ws.getCell('A1')
  cell.value     = title
  cell.font      = { ...BASE_FONT, size: 14, bold: true, color: { argb: C.HEADER_FG } }
  cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.HEADER_BG } }
  cell.alignment = { vertical: 'middle', horizontal: 'center' }
  ws.getRow(1).height = 28
}

/** Cabecera de bloque/sección (azul medio, blanco, 11pt bold). */
function applySectionTitle(ws: ExcelJS.Worksheet, row: number, title: string, lastCol: string) {
  ws.mergeCells(`A${row}:${lastCol}${row}`)
  const cell = ws.getCell(`A${row}`)
  cell.value     = title
  cell.font      = { ...BASE_FONT, size: 11, bold: true, color: { argb: C.SECTION_FG } }
  cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.SECTION_BG } }
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  ws.getRow(row).height = 22
}

/** Cabecera de columnas de tabla — azul muy claro, texto azul oscuro, borde inferior doble. */
function applyTableHeaderRow(row: ExcelJS.Row) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font      = { ...BASE_FONT, size: 9, bold: true, color: { argb: C.TABLE_HEAD_FG } }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.TABLE_HEAD_BG } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border    = {
      ...thinBorder,
      bottom: { style: 'double', color: { argb: C.TABLE_HEAD_FG } },
    }
  })
  row.height = 24
}

/** Fila de TOTAL: negrita, fondo verde claro, texto verde oscuro. */
function applyTotalRow(row: ExcelJS.Row) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font   = { ...BASE_FONT, size: 10, bold: true, color: { argb: C.TOTAL_FG } }
    cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.TOTAL_BG } }
    cell.border = thinBorder
  })
}

/** Estilo de filas de datos: alternadas + bordes thin. */
function applyDataRowStyle(row: ExcelJS.Row, isEven: boolean) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font   = cell.font ?? BASE_FONT
    cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? C.ROW_EVEN : C.ROW_ODD } }
    cell.border = thinBorder
  })
}

/** Mensaje de fila vacía spanning toda la tabla — itálico gris. */
function applyEmptyRow(ws: ExcelJS.Worksheet, row: number, colCount: number) {
  const lastCol = colLetter(colCount)
  ws.mergeCells(`A${row}:${lastCol}${row}`)
  const cell = ws.getCell(`A${row}`)
  cell.value     = 'Sin registros para este período'
  cell.font      = { ...BASE_FONT, italic: true, color: { argb: C.EMPTY_FG } }
  cell.alignment = { vertical: 'middle', horizontal: 'center' }
  cell.border    = thinBorder
}

/** Calcula anchos de columna dinámicamente: el contenido más largo + 4 de padding (clamp 12–40). */
function autoFitColumns(ws: ExcelJS.Worksheet, fromRow = 1) {
  ws.columns?.forEach((col, idx) => {
    let max = 12
    ws.eachRow({ includeEmpty: false }, (row, rNum) => {
      if (rNum < fromRow) return
      const cell = row.getCell(idx + 1)
      const v    = cell.value
      if (v == null) return
      const txt = typeof v === 'object' && 'richText' in (v as object)
        ? ((v as ExcelJS.CellRichTextValue).richText.map(r => r.text).join('') ?? '')
        : String(v)
      const len = txt.length + 4
      if (len > max) max = len
    })
    col.width = Math.min(40, max)
  })
}

/** Letra de columna a partir del índice 1-based (1→A, 27→AA). */
function colLetter(n: number): string {
  let s = ''
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/** Reemplaza valores nulos/undefined por el guión largo (—). */
function dash<T>(v: T | null | undefined): T | string { return v == null ? '—' : v }

/** Mapeo de método de pago a etiqueta legible. */
function paymentTypeLabel(p: string | null): string {
  if (!p) return '—'
  const map: Record<string, string> = {
    efectivo:      'Efectivo',
    tarjeta:       'Tarjeta de crédito',
    debito:        'Tarjeta de débito',
    transferencia: 'Transferencia',
    otro:          'Otro',
  }
  return map[p] ?? p
}

// ─── HOJA 1: RESUMEN ANUAL ──────────────────────────────────────────────────

function buildResumenAnual(wb: ExcelJS.Workbook, data: ExportData) {
  const ws = wb.addWorksheet('RESUMEN ANUAL')

  // Fila de encabezados: CATEGORÍA + (PRESUP/REAL × 12 meses) + (PRESUP TOTAL/REAL TOTAL)
  // Total de columnas = 1 + 24 + 2 = 27
  const COLS = 1 + 12 * 2 + 2
  const lastCol = colLetter(COLS)

  applySheetTitle(ws, `RESUMEN ANUAL ${data.year}`, lastCol)

  const headerRow = ws.getRow(2)
  headerRow.getCell(1).value = 'CATEGORÍA'
  for (let m = 1; m <= 12; m++) {
    const baseCol = 2 + (m - 1) * 2
    headerRow.getCell(baseCol).value     = `${MES_CORTO[m]} PRESUP.`
    headerRow.getCell(baseCol + 1).value = `${MES_CORTO[m]} REAL`
  }
  headerRow.getCell(COLS - 1).value = 'PRESUP. TOTAL'
  headerRow.getCell(COLS).value     = 'REAL TOTAL'
  applyTableHeaderRow(headerRow)

  // Indexamos los budgets por mes para acceso rápido.
  const byMonth = new Map<number, ExportBudget>()
  for (const b of data.budgets) byMonth.set(b.month, b)

  // Conjunto único de nombres de cada categoría a través de todos los meses.
  const incomeNames    = new Set<string>()
  const billNames      = new Set<string>()
  const expenseCats    = new Set<string>()
  for (const b of data.budgets) {
    b.incomes.forEach(i  => incomeNames.add(i.name))
    b.bills.forEach(bi   => billNames.add(bi.name))
    b.expenses.forEach(e => expenseCats.add(e.category))
  }
  const debtNames = data.debts.map(d => d.name)

  let cursor = 3   // próxima fila libre

  /** Escribe una fila (cat, valoresPorMes[budgeted, actual] × 12) y devuelve la fila escrita. */
  const writeRow = (
    label:    string,
    perMonth: (m: number) => { budgeted: number; actual: number } | null,
    isEven:   boolean,
  ) => {
    const row = ws.getRow(cursor)
    row.getCell(1).value = label
    let totalBudgeted = 0
    let totalActual   = 0
    for (let m = 1; m <= 12; m++) {
      const v       = perMonth(m)
      const baseCol = 2 + (m - 1) * 2
      if (v) {
        // Coerción Number() defensiva — protege contra DECIMAL serializado
        // como string desde TypeORM. La columna REAL TOTAL al final de la
        // fila depende de que el `+=` sume y no concatene.
        const budgeted = Number(v.budgeted) || 0
        const actual   = Number(v.actual)   || 0
        row.getCell(baseCol).value     = budgeted
        row.getCell(baseCol + 1).value = actual
        totalBudgeted += budgeted
        totalActual   += actual
      } else {
        row.getCell(baseCol).value     = '—'
        row.getCell(baseCol + 1).value = '—'
      }
    }
    row.getCell(COLS - 1).value = totalBudgeted
    row.getCell(COLS).value     = totalActual
    // Aplicar formato moneda a las celdas numéricas + alineación.
    for (let c = 2; c <= COLS; c++) {
      const cell = row.getCell(c)
      if (typeof cell.value === 'number') cell.numFmt = FMT.CURRENCY
      cell.alignment = { vertical: 'middle', horizontal: typeof cell.value === 'number' ? 'right' : 'center' }
    }
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    applyDataRowStyle(row, isEven)
    cursor++
    return row
  }

  /** Escribe una fila TOTAL — formula manual (ya no necesitamos por mes, agregamos sólo del array). */
  const writeTotal = (label: string, perMonth: (m: number) => number) => {
    const row = ws.getRow(cursor)
    row.getCell(1).value = label
    let total = 0
    for (let m = 1; m <= 12; m++) {
      // Number() defensivo — el callback puede devolver string si la fuente
      // upstream (calculator del budget, reduce sin coerción) no se sanea.
      const v = Number(perMonth(m)) || 0
      const baseCol = 2 + (m - 1) * 2
      // En el resumen anual, la fila TOTAL solo muestra el agregado real del mes
      // en la columna "REAL"; la columna "PRESUP." queda con el mismo valor
      // calculado por el caller (la pasamos como un número único).
      row.getCell(baseCol).value     = v
      row.getCell(baseCol + 1).value = v
      total += v
    }
    row.getCell(COLS - 1).value = total
    row.getCell(COLS).value     = total
    for (let c = 2; c <= COLS; c++) {
      const cell = row.getCell(c)
      if (typeof cell.value === 'number') cell.numFmt = FMT.CURRENCY
      cell.alignment = { vertical: 'middle', horizontal: 'right' }
    }
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    applyTotalRow(row)
    cursor++
  }

  // ── Bloque 1: INGRESOS ────────────────────────────────────────────────────
  applySectionTitle(ws, cursor, '💰 INGRESOS', lastCol)
  cursor++
  let alt = 0
  if (incomeNames.size === 0) { applyEmptyRow(ws, cursor, COLS); cursor++ }
  else for (const name of incomeNames) {
    writeRow(name, (m) => {
      const b   = byMonth.get(m)
      const inc = b?.incomes.find(i => i.name === name)
      return inc ? { budgeted: inc.budgeted, actual: inc.actual } : null
    }, alt++ % 2 === 1)
  }
  writeTotal('TOTAL INGRESOS', (m) => byMonth.get(m)?.totalIngresoReal ?? 0)

  // ── Bloque 2: FACTURAS ────────────────────────────────────────────────────
  applySectionTitle(ws, cursor, '🧾 FACTURAS (GASTOS FIJOS)', lastCol)
  cursor++
  alt = 0
  if (billNames.size === 0) { applyEmptyRow(ws, cursor, COLS); cursor++ }
  else for (const name of billNames) {
    writeRow(name, (m) => {
      const b    = byMonth.get(m)
      const bill = b?.bills.find(bi => bi.name === name)
      return bill ? { budgeted: bill.budgeted, actual: bill.actual } : null
    }, alt++ % 2 === 1)
  }
  writeTotal('TOTAL FACTURAS', (m) => byMonth.get(m)?.totalFacturasReal ?? 0)

  // ── Bloque 3: GASTOS VARIABLES ────────────────────────────────────────────
  applySectionTitle(ws, cursor, '🛒 GASTOS VARIABLES', lastCol)
  cursor++
  alt = 0
  if (expenseCats.size === 0) { applyEmptyRow(ws, cursor, COLS); cursor++ }
  else for (const cat of expenseCats) {
    writeRow(cat, (m) => {
      const b = byMonth.get(m)
      const e = b?.expenses.find(x => x.category === cat)
      return e ? { budgeted: e.budgeted, actual: e.actual } : null
    }, alt++ % 2 === 1)
  }
  writeTotal('TOTAL GASTOS VARIABLES', (m) => byMonth.get(m)?.totalGastosVariablesReal ?? 0)

  // ── Bloque 4: DEUDAS ──────────────────────────────────────────────────────
  applySectionTitle(ws, cursor, '💳 PAGO DE DEUDAS', lastCol)
  cursor++
  alt = 0
  // Normalizamos minimumPayment a Number una vez — los DECIMAL llegan como
  // string desde TypeORM y un reduce con `+` haría string concat, generando
  // NaN en la fila BALANCE cuando hay más de una deuda.
  const debtsNum = data.debts.map(d => ({ ...d, minimumPayment: Number(d.minimumPayment) || 0 }))
  if (debtNames.length === 0) { applyEmptyRow(ws, cursor, COLS); cursor++ }
  else for (const debt of debtsNum) {
    // El pago mínimo no varía por mes en este reporte: lo replicamos en cada celda.
    writeRow(debt.name, () => ({ budgeted: debt.minimumPayment, actual: debt.minimumPayment }), alt++ % 2 === 1)
  }
  writeTotal('TOTAL DEUDAS', () => debtsNum.reduce((s, d) => s + d.minimumPayment, 0))

  // ── Fila final: BALANCE (Ingresos - Facturas - Variables - Deudas) ────────
  cursor++  // separador visual
  const balanceRow = ws.getRow(cursor)
  balanceRow.getCell(1).value = 'BALANCE'
  let balanceTotal = 0
  const totalDeudas = debtsNum.reduce((s, d) => s + d.minimumPayment, 0)
  for (let m = 1; m <= 12; m++) {
    const b   = byMonth.get(m)
    // Number() defensivo en cada operando — la resta sí coerciona, pero la
    // suma final `balanceTotal += bal` sería string concat si bal saliera
    // como string desde un .toFixed sobre NaN o concat upstream.
    const ing = Number(b?.totalIngresoReal)         || 0
    const fac = Number(b?.totalFacturasReal)        || 0
    const gv  = Number(b?.totalGastosVariablesReal) || 0
    const bal = +(ing - fac - gv - (b ? totalDeudas : 0)).toFixed(2)
    balanceTotal += bal
    const baseCol = 2 + (m - 1) * 2
    balanceRow.getCell(baseCol).value     = bal
    balanceRow.getCell(baseCol + 1).value = bal
  }
  balanceRow.getCell(COLS - 1).value = balanceTotal
  balanceRow.getCell(COLS).value     = balanceTotal
  for (let c = 2; c <= COLS; c++) {
    const cell = balanceRow.getCell(c)
    if (typeof cell.value === 'number') {
      cell.numFmt = FMT.CURRENCY
      cell.font   = { ...BASE_FONT, bold: true, color: { argb: cell.value >= 0 ? C.POSITIVE : C.NEGATIVE } }
    }
    cell.alignment = { vertical: 'middle', horizontal: 'right' }
  }
  balanceRow.getCell(1).font      = { ...BASE_FONT, bold: true }
  balanceRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  balanceRow.eachCell({ includeEmpty: true }, (cell) => { cell.border = thinBorder })

  // Anchos de columna y freeze de la fila de cabeceras.
  ws.columns = Array.from({ length: COLS }, () => ({ width: 14 }))
  ws.getColumn(1).width = 28
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 2 }]
  autoFitColumns(ws, 2)
}

// ─── HOJAS 2-13: MENSUALES ─────────────────────────────────────────────────

function buildMonthlySheet(wb: ExcelJS.Workbook, budget: ExportBudget) {
  const ws = wb.addWorksheet(MES_CORTO[budget.month])
  const lastCol = 'F'   // 6 columnas máximas en este reporte mensual
  applySheetTitle(ws, `${MES_LARGO[budget.month].toUpperCase()} ${budget.year}`, lastCol)

  let cursor = 3

  // ── Sección 1: VISTA GENERAL ────────────────────────────────────────────
  applySectionTitle(ws, cursor, '📊 VISTA GENERAL', lastCol)
  cursor++

  const head1 = ws.getRow(cursor)
  head1.values = ['INDICADOR', 'VALOR']
  applyTableHeaderRow(head1)
  cursor++

  // Coercemos los KPI a Number antes de operar. Los campos del budget vienen
  // del store (E2EE — esperados como number), pero `pagoDeudasMin` venía del
  // orquestador sumando minimos crudos de deudas (TypeORM serializa los
  // DECIMAL como string). Un `+ "1500"` daba "01500" → la fila DEUDA PAGADA
  // mostraba "02965.471072.01" en vez del total. Coerción defensiva.
  const ingresoReal              = Number(budget.totalIngresoReal)             || 0
  const totalFacturasReal        = Number(budget.totalFacturasReal)            || 0
  const totalGastosVariablesReal = Number(budget.totalGastosVariablesReal)     || 0
  const pagoDeudasMin            = Number(budget.pagoDeudasMin)                || 0
  const totalGastado             = +(totalFacturasReal + totalGastosVariablesReal).toFixed(2)
  const disponible               = +(ingresoReal - totalGastado).toFixed(2)
  const kpis: { label: string; value: number; tone?: 'positive' | 'negative' | 'auto' }[] = [
    { label: 'INGRESO TOTAL', value: ingresoReal,             tone: 'positive' },
    { label: 'TOTAL GASTADO', value: totalGastado },
    { label: 'DISPONIBLE',    value: disponible,              tone: 'auto'     },
    { label: 'DEUDA PAGADA',  value: pagoDeudasMin },
  ]
  kpis.forEach((kpi, idx) => {
    const row = ws.getRow(cursor)
    row.getCell(1).value = kpi.label
    row.getCell(2).value = kpi.value
    row.getCell(2).numFmt = FMT.CURRENCY
    if (kpi.tone === 'positive') row.getCell(2).font = { ...BASE_FONT, bold: true, color: { argb: C.POSITIVE } }
    else if (kpi.tone === 'auto') row.getCell(2).font = { ...BASE_FONT, bold: true, color: { argb: kpi.value >= 0 ? C.POSITIVE : C.NEGATIVE } }
    else                          row.getCell(2).font = { ...BASE_FONT, bold: true }
    row.getCell(1).alignment = { horizontal: 'left',  vertical: 'middle', indent: 1 }
    row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' }
    applyDataRowStyle(row, idx % 2 === 1)
    cursor++
  })

  cursor += 2

  // ── Sección 2: DISTRIBUCIÓN 50/30/20 ────────────────────────────────────
  applySectionTitle(ws, cursor, '🎯 DISTRIBUCIÓN 50/30/20', lastCol)
  cursor++

  const head2 = ws.getRow(cursor)
  head2.values = ['CATEGORÍA', 'OBJETIVO', 'REAL', 'DIFERENCIA']
  applyTableHeaderRow(head2)
  cursor++

  const reglaRows: { label: string; data: ExportReglaBlock }[] = [
    { label: 'Necesidades (50%)', data: budget.regla.necesidades },
    { label: 'Deseos (30%)',      data: budget.regla.deseos      },
    { label: 'Ahorros/Deudas (20%)', data: budget.regla.ahorro    },
  ]
  reglaRows.forEach((r, idx) => {
    const row = ws.getRow(cursor)
    const dif = +(r.data.limite - r.data.actual).toFixed(2)
    row.getCell(1).value = r.label
    row.getCell(2).value = r.data.limite
    row.getCell(3).value = r.data.actual
    row.getCell(4).value = dif
    for (let c = 2; c <= 4; c++) {
      row.getCell(c).numFmt = FMT.CURRENCY
      row.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' }
    }
    // Verde si Real ≤ Objetivo, rojo si excede.
    const tone = r.data.actual <= r.data.limite ? C.POSITIVE : C.NEGATIVE
    row.getCell(3).font = { ...BASE_FONT, color: { argb: tone } }
    row.getCell(4).font = { ...BASE_FONT, bold: true, color: { argb: tone } }
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    applyDataRowStyle(row, idx % 2 === 1)
    cursor++
  })

  cursor += 2

  // ── Sección 3: INGRESOS ─────────────────────────────────────────────────
  applySectionTitle(ws, cursor, '💰 INGRESOS', lastCol)
  cursor++
  cursor = renderTable(ws, cursor, ['NOMBRE', 'PRESUPUESTADO', 'REAL'], budget.incomes.map(i => [i.name, i.budgeted, i.actual]),
    { numCols: [2, 3], totals: ['TOTAL', sum(budget.incomes, i => i.budgeted), sum(budget.incomes, i => i.actual)] })

  cursor += 2

  // ── Sección 4: FACTURAS ─────────────────────────────────────────────────
  applySectionTitle(ws, cursor, '🧾 FACTURAS', lastCol)
  cursor++
  const billRows = budget.bills.map(b => [
    b.name, b.budgeted, b.actual,
    dash(b.dueDate),
    paymentTypeLabel(b.paymentType),
    b.isPaid ? '✅ Pagada' : '⏳ Pendiente',
  ])
  cursor = renderTable(ws, cursor,
    ['NOMBRE', 'PRESUPUESTADO', 'REAL PAGADO', 'VENCIMIENTO', 'MÉTODO', 'ESTADO'],
    billRows,
    { numCols: [2, 3], dateCols: [4] },
  )

  cursor += 2

  // ── Sección 5: GASTOS VARIABLES ─────────────────────────────────────────
  applySectionTitle(ws, cursor, '🛒 GASTOS VARIABLES', lastCol)
  cursor++
  // Ordenar de mayor a menor por % usado (categoría más excedida primero).
  const expSorted = [...budget.expenses]
    .map(e => ({ ...e, dif: e.budgeted - e.actual, pct: e.budgeted > 0 ? e.actual / e.budgeted : 0 }))
    .sort((a, b) => b.pct - a.pct)
  const expRows = expSorted.map(e => [e.category, e.budgeted, e.actual, e.dif, e.pct])
  cursor = renderTable(ws, cursor,
    ['CATEGORÍA', 'PRESUPUESTADO', 'GASTADO', 'DIFERENCIA', '% USADO'],
    expRows,
    {
      numCols:    [2, 3, 4],
      percentCol: 5,
      // Fondo rojo claro cuando el % usado supera el 100% (categoría excedida).
      rowHighlight: (r) => (typeof r[4] === 'number' && r[4] > 1) ? C.WARNING_BG : null,
    },
  )

  cursor += 2

  // ── Sección 6: TRANSACCIONES ────────────────────────────────────────────
  applySectionTitle(ws, cursor, '📒 TRANSACCIONES', lastCol)
  cursor++
  const txSorted = [...budget.transactions].sort((a, b) => b.date.localeCompare(a.date))
  const txRows = txSorted.map(t => [
    t.date,
    t.category,
    dash(t.note),
    paymentTypeLabel(t.paymentType),
    t.amount,
  ])
  cursor = renderTable(ws, cursor,
    ['FECHA', 'CATEGORÍA', 'NOTA', 'MÉTODO', 'MONTO'],
    txRows,
    {
      numCols:  [5],
      dateCols: [1],
      totals:   ['TOTAL', '', '', '', sum(budget.transactions, t => t.amount)],
    },
  )

  // Anchos y freeze.
  ws.columns = Array.from({ length: 6 }, () => ({ width: 18 }))
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  autoFitColumns(ws, 2)
}

// ─── Helper genérico para renderizar tablas ──────────────────────────────────

interface TableOptions {
  numCols?:       number[]   // columnas (1-based) con formato moneda
  dateCols?:      number[]   // columnas con formato fecha
  percentCol?:    number     // columna con formato porcentaje
  totals?:        (string | number)[]   // fila TOTAL al final (mismo nro. de columnas)
  rowHighlight?:  (row: (string | number)[]) => string | null   // fondo opcional por fila
}

/**
 * Renderiza una tabla con cabecera + filas + (opcional) fila TOTAL.
 * Devuelve el cursor de fila libre tras la tabla.
 */
function renderTable(
  ws:      ExcelJS.Worksheet,
  startRow: number,
  headers:  string[],
  rows:     (string | number)[][],
  opts:     TableOptions = {},
): number {
  const headRow = ws.getRow(startRow)
  headRow.values = headers
  applyTableHeaderRow(headRow)
  let cursor = startRow + 1

  if (rows.length === 0) {
    applyEmptyRow(ws, cursor, headers.length)
    return cursor + 1
  }

  rows.forEach((r, idx) => {
    const row = ws.getRow(cursor)
    r.forEach((v, ci) => row.getCell(ci + 1).value = v)
    // Formatos por columna.
    opts.numCols?.forEach(c => { row.getCell(c).numFmt = FMT.CURRENCY })
    opts.dateCols?.forEach(c => { row.getCell(c).numFmt = FMT.DATE })
    if (opts.percentCol) row.getCell(opts.percentCol).numFmt = FMT.PERCENT
    // Alineación: número/% derecha, texto izquierda.
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      const isNum = typeof cell.value === 'number'
      const isPct = c === opts.percentCol
      cell.alignment = {
        vertical:   'middle',
        horizontal: isPct ? 'center' : (isNum ? 'right' : 'left'),
        indent:     !isNum && !isPct ? 1 : 0,
      }
    })
    applyDataRowStyle(row, idx % 2 === 1)
    // Highlight opcional (ej. % > 100).
    const tone = opts.rowHighlight?.(r)
    if (tone) row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tone } }
    })
    cursor++
  })

  if (opts.totals) {
    const row = ws.getRow(cursor)
    opts.totals.forEach((v, ci) => row.getCell(ci + 1).value = v)
    opts.numCols?.forEach(c => { row.getCell(c).numFmt = FMT.CURRENCY })
    if (opts.percentCol) row.getCell(opts.percentCol).numFmt = FMT.PERCENT
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      const isNum = typeof cell.value === 'number'
      cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : (isNum ? 'right' : 'center'), indent: c === 1 ? 1 : 0 }
    })
    applyTotalRow(row)
    cursor++
  }

  return cursor
}

function sum<T>(arr: T[], pick: (t: T) => number): number {
  // Coerción explícita a Number en cada item: TypeORM serializa los DECIMAL
  // como string en JSON, y un `0 + "1500"` daría string concat ("01500"),
  // rompiendo el `.toFixed(2)` final con "toFixed is not a function".
  return +arr.reduce((acc, x) => acc + (Number(pick(x)) || 0), 0).toFixed(2)
}

// ─── HOJA 14: DEUDAS Y AMORTIZACIÓN ─────────────────────────────────────────

function buildDeudasSheet(wb: ExcelJS.Workbook, debts: ExportDebt[]) {
  const ws = wb.addWorksheet('DEUDAS Y AMORTIZACIÓN')
  // Resumen tiene 10 columnas; amortización 6-7. Tomamos 10 para el merge.
  const lastCol = 'J'
  applySheetTitle(ws, 'DEUDAS Y AMORTIZACIÓN', lastCol)

  let cursor = 3

  // ── Sección 1: RESUMEN DE DEUDAS ────────────────────────────────────────
  applySectionTitle(ws, cursor, '📋 RESUMEN DE DEUDAS', lastCol)
  cursor++

  const head = ws.getRow(cursor)
  head.values = [
    'NOMBRE', 'CAPITAL INICIAL', 'SALDO ACTUAL', 'AMORTIZADO',
    '% AVANCE', 'PAGO MÍNIMO', 'TASA ANUAL', 'TIPO TASA', 'ESTRATEGIA', 'ESTADO',
  ]
  applyTableHeaderRow(head)
  cursor++

  if (debts.length === 0) {
    applyEmptyRow(ws, cursor, 10)
    cursor++
  } else {
    debts.forEach((rawDebt, idx) => {
      // TypeORM serializa los DECIMAL como string en JSON. Normalizamos
      // todos los campos numéricos al iniciar la fila para que sumas,
      // formato moneda y porcentaje funcionen sin importar qué tipo lleguen.
      const d = {
        ...rawDebt,
        initialAmount:      Number(rawDebt.initialAmount)      || 0,
        remainingBalance:   Number(rawDebt.remainingBalance)   || 0,
        capitalAmortizado:  Number(rawDebt.capitalAmortizado)  || 0,
        porcentajeAvance:   Number(rawDebt.porcentajeAvance)   || 0,
        minimumPayment:     Number(rawDebt.minimumPayment)     || 0,
        annualInterestRate: Number(rawDebt.annualInterestRate) || 0,
        ivaRate:            Number(rawDebt.ivaRate)            || 0,
      }
      const row = ws.getRow(cursor)
      row.values = [
        d.name,
        d.initialAmount,
        d.remainingBalance,
        d.capitalAmortizado,
        d.porcentajeAvance / 100,
        d.minimumPayment,
        d.annualInterestRate / 100,
        d.rateType === 'fixed' ? 'Fija' : 'Variable',
        d.method,
        d.status,
      ]
      // Formatos. Usamos for…of porque `[arr].forEach` justo después de un
      // `row.values = [...]` cae en el trap de ASI: JS lo lee como
      // indexación (comma-operator) sobre el array de valores y termina
      // llamando .forEach sobre un número → "forEach is not a function".
      for (const c of [2, 3, 4, 6]) row.getCell(c).numFmt = FMT.CURRENCY
      for (const c of [5, 7])       row.getCell(c).numFmt = FMT.PERCENT
      row.eachCell({ includeEmpty: true }, (cell, c) => {
        const isNum = typeof cell.value === 'number'
        const isPct = c === 5 || c === 7
        cell.alignment = {
          vertical:   'middle',
          horizontal: isPct ? 'center' : (isNum ? 'right' : 'left'),
          indent:     !isNum && !isPct ? 1 : 0,
        }
      })
      applyDataRowStyle(row, idx % 2 === 1)
      cursor++
    })

    // Fila TOTALES.
    const totalInicial   = sum(debts, d => d.initialAmount)
    const totalSaldo     = sum(debts, d => d.remainingBalance)
    const totalAmort     = sum(debts, d => d.capitalAmortizado)
    const avanceGlobal   = totalInicial > 0 ? totalAmort / totalInicial : 0
    const totalMinPago   = sum(debts, d => d.minimumPayment)
    const trow = ws.getRow(cursor)
    trow.values = ['TOTALES', totalInicial, totalSaldo, totalAmort, avanceGlobal, totalMinPago, '—', '—', '—', '—']
    ;[2, 3, 4, 6].forEach(c => { trow.getCell(c).numFmt = FMT.CURRENCY })
    trow.getCell(5).numFmt = FMT.PERCENT
    trow.eachCell({ includeEmpty: true }, (cell, c) => {
      const isNum = typeof cell.value === 'number'
      cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : (isNum ? 'right' : 'center'), indent: c === 1 ? 1 : 0 }
    })
    applyTotalRow(trow)
    cursor++
  }

  cursor += 2

  // ── Sección 2: AMORTIZACIÓN POR DEUDA ───────────────────────────────────
  applySectionTitle(ws, cursor, '📅 AMORTIZACIÓN POR DEUDA', lastCol)
  cursor++

  for (const rawDebt of debts) {
    if (rawDebt.amortization.length === 0) continue
    // Mismo patrón que arriba — normalizamos numéricos. Extra: las filas de
    // amortización vienen del backend con decimals como string, así que
    // también las pasamos a Number una sola vez por bloque.
    const d = {
      ...rawDebt,
      annualInterestRate: Number(rawDebt.annualInterestRate) || 0,
      ivaRate:            Number(rawDebt.ivaRate)            || 0,
      amortization: rawDebt.amortization.map(a => ({
        ...a,
        pagoEsperado:  Number(a.pagoEsperado)  || 0,
        capital:       Number(a.capital)       || 0,
        interes:       Number(a.interes)       || 0,
        iva:           Number(a.iva)           || 0,
        saldoRestante: Number(a.saldoRestante) || 0,
      })),
    }
    const showIVA = d.ivaRate > 0
    // Cabecera por bloque: nombre + tasa + tipo.
    const subTitle = `${d.name} · ${d.annualInterestRate.toFixed(2)}% ${d.rateType === 'fixed' ? 'fija' : 'variable'}${showIVA ? ` · IVA ${d.ivaRate}%` : ''}`
    applySectionTitle(ws, cursor, subTitle, lastCol)
    cursor++

    const headers = showIVA
      ? ['MES', 'FECHA', 'PAGO ESPERADO', 'CAPITAL', 'INTERÉS', 'IVA', 'SALDO RESTANTE']
      : ['MES', 'FECHA', 'PAGO ESPERADO', 'CAPITAL', 'INTERÉS', 'SALDO RESTANTE']
    const rows = d.amortization.map(a => showIVA
      ? [a.mes, a.fechaEstimada, a.pagoEsperado, a.capital, a.interes, a.iva, a.saldoRestante]
      : [a.mes, a.fechaEstimada, a.pagoEsperado, a.capital, a.interes, a.saldoRestante])

    const totalsRow = showIVA
      ? ['TOTAL', '', sum(d.amortization, a => a.pagoEsperado), sum(d.amortization, a => a.capital), sum(d.amortization, a => a.interes), sum(d.amortization, a => a.iva), '—']
      : ['TOTAL', '', sum(d.amortization, a => a.pagoEsperado), sum(d.amortization, a => a.capital), sum(d.amortization, a => a.interes), '—']

    cursor = renderTable(ws, cursor, headers, rows, {
      numCols:  showIVA ? [3, 4, 5, 6, 7] : [3, 4, 5, 6],
      dateCols: [2],
      totals:   totalsRow,
    })

    cursor += 3   // separación de 3 filas vacías entre deudas
  }

  ws.columns = Array.from({ length: 10 }, () => ({ width: 16 }))
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  autoFitColumns(ws, 2)
}

// ─── HOJA 15: METAS DE AHORRO ───────────────────────────────────────────────

function buildMetasSheet(wb: ExcelJS.Workbook, savings: ExportSavingGoal[]) {
  const ws = wb.addWorksheet('METAS DE AHORRO')
  const lastCol = 'K'
  applySheetTitle(ws, 'METAS DE AHORRO', lastCol)

  let cursor = 3

  applySectionTitle(ws, cursor, '🎯 METAS', lastCol)
  cursor++

  const head = ws.getRow(cursor)
  head.values = [
    'META', 'OBJETIVO', 'ACUMULADO', 'RESTANTE', 'PROGRESO',
    'FRECUENCIA', 'APORTE / PERÍODO', 'APORTE MENS. EFECTIVO',
    'MESES ESTIMADOS', 'FECHA ESTIMADA', 'ESTADO',
  ]
  applyTableHeaderRow(head)
  cursor++

  if (savings.length === 0) {
    applyEmptyRow(ws, cursor, 11)
    cursor++
  } else {
    savings.forEach((rawGoal, idx) => {
      // Mismo patrón que en buildDeudasSheet — TypeORM serializa decimals
      // como string. Coercemos a Number una vez antes de usar la meta.
      const g = {
        ...rawGoal,
        targetAmount:          Number(rawGoal.targetAmount)          || 0,
        currentAmount:         Number(rawGoal.currentAmount)         || 0,
        restante:              Number(rawGoal.restante)              || 0,
        porcentaje:            Number(rawGoal.porcentaje)            || 0,
        aportePorPeriodo:      Number(rawGoal.aportePorPeriodo)      || 0,
        aporteMensualEfectivo: Number(rawGoal.aporteMensualEfectivo) || 0,
        mesesRestantes: rawGoal.mesesRestantes != null
          ? (Number(rawGoal.mesesRestantes) || 0)
          : null,
      }
      const row = ws.getRow(cursor)
      // Barra visual con caracteres bloque (8 segmentos): "████░░░░ 52%".
      const blocks = Math.round((g.porcentaje / 100) * 8)
      const bar    = '█'.repeat(blocks) + '░'.repeat(8 - blocks)
      row.values = [
        g.name,
        g.targetAmount,
        g.currentAmount,
        g.restante,
        `${bar} ${g.porcentaje.toFixed(1)}%`,
        g.frecuencia,
        g.aportePorPeriodo,
        g.esAporteUnico ? 'Aporte único' : g.aporteMensualEfectivo,
        g.esAporteUnico ? 'Aporte único' : (g.mesesRestantes ?? '—'),
        g.esAporteUnico ? 'Aporte único' : (g.fechaEstimada ?? '—'),
        g.isCompleted ? 'Completada' : 'En curso',
      ]
      // Formatos: monedas en cols 2-4, 7-8 (cuando es número). Usamos for…of
      // para evitar el trap de ASI con `row.values = [...]` arriba —
      // `[N].forEach` se interpretaría como indexación del array.
      for (const c of [2, 3, 4, 7]) row.getCell(c).numFmt = FMT.CURRENCY
      if (typeof row.getCell(8).value === 'number') row.getCell(8).numFmt = FMT.CURRENCY
      if (typeof row.getCell(9).value === 'number') row.getCell(9).numFmt = FMT.INTEGER
      if (typeof row.getCell(10).value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.getCell(10).value as string)) {
        // Lo dejamos como string ISO — Excel lo muestra tal cual, sin parseo a fecha aleatoria.
      }
      row.eachCell({ includeEmpty: true }, (cell, c) => {
        const isNum = typeof cell.value === 'number'
        cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : (isNum ? 'right' : 'center'), indent: c === 1 ? 1 : 0 }
      })
      applyDataRowStyle(row, idx % 2 === 1)
      // Si está completada → fondo verde claro y texto verde oscuro en toda la fila.
      if (g.isCompleted) {
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.TOTAL_BG } }
          cell.font = { ...BASE_FONT, color: { argb: C.TOTAL_FG } }
        })
      }
      cursor++
    })
  }

  cursor += 2

  // ── Sección 2: HISTORIAL DE CONTRIBUCIONES ──────────────────────────────
  applySectionTitle(ws, cursor, '📒 HISTORIAL DE CONTRIBUCIONES', lastCol)
  cursor++

  const allContribs: { goalName: string; date: string; amount: number; note: string | null }[] = []
  for (const g of savings) {
    // c.amount también puede llegar como string desde el backend.
    for (const c of g.contributions) {
      allContribs.push({ goalName: g.name, date: c.date, amount: Number(c.amount) || 0, note: c.note })
    }
  }
  allContribs.sort((a, b) => b.date.localeCompare(a.date))

  cursor = renderTable(ws, cursor,
    ['META', 'FECHA', 'MONTO', 'NOTA'],
    allContribs.map(c => [c.goalName, c.date, c.amount, dash(c.note)]),
    {
      numCols:  [3],
      dateCols: [2],
    },
  )

  ws.columns = Array.from({ length: 11 }, () => ({ width: 16 }))
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  autoFitColumns(ws, 2)
}

// ─── Función principal ──────────────────────────────────────────────────────

/**
 * Construye el workbook con todas las hojas, lo serializa y dispara la
 * descarga en el navegador. No retorna nada — el side-effect es la descarga.
 */
export async function exportFinancialReport(data: ExportData): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator             = 'FinanzasApp'
  wb.created             = new Date()
  wb.properties.date1904 = false

  buildResumenAnual(wb, data)

  // Hojas mensuales: solo los meses que efectivamente tienen budget.
  const sortedBudgets = [...data.budgets].sort((a, b) => a.month - b.month)
  for (const b of sortedBudgets) buildMonthlySheet(wb, b)

  buildDeudasSheet(wb, data.debts)
  buildMetasSheet(wb, data.savings)

  // Disparar descarga: writeBuffer → Blob → URL → click programático.
  const buffer = await wb.xlsx.writeBuffer()
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url    = URL.createObjectURL(blob)

  const today    = new Date()
  const monthIdx = today.getMonth() + 1
  const fileName = `FinanzasApp_Reporte_${MES_LARGO[monthIdx]}_${data.year}.xlsx`

  const a = document.createElement('a')
  a.href     = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
