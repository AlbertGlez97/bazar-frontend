/**
 * Plan de una hoja de etiquetas Office Depot SKU 64413: tamaño CARTA (215,9 x 279,4 mm),
 * 30 etiquetas de ~67 x 25 mm en una cuadrícula de 3 columnas x 10 filas. PURO: sin PDF,
 * sin QR, sin DOM. Todo en milímetros; `services/qr-label-sheet.ts` solo dibuja lo que
 * este plan dice.
 *
 * Los valores por omisión son los típicos del formato Avery 5160 y NO están verificados en
 * la hoja real; por eso TODA la geometría es calibrable (márgenes, ancho, alto, separación
 * horizontal y paso vertical) y se guarda en `localStorage` (ver `label-calibration.store`).
 *
 * Dos diseños, mismo para todo el lote:
 * - `qr-only`: el QR centrado en la etiqueta, sin texto.
 * - `qr-detail`: QR a la izquierda (centrado en vertical) y a la derecha, en este orden de
 *   prioridad: nombre (negritas, máx. 2 renglones), marca, presentación y descripción breve
 *   (máx. 2 renglones, solo si cabe). Los campos vacíos no se dibujan ni dejan huecos.
 *   Sin precio.
 *
 * Texto: las fuentes base de PDF (Helvetica) cubren Latin-1 (acentos y ñ) más la elipsis
 * «…» de WinAnsi. Todo lo demás (emoji, CJK…) se cambia por un espacio y los blancos se
 * colapsan: ver `sanitizeLabelText`. El recorte se calcula con el ANCHO real medido
 * (`TextMeasure`, en el servicio `doc.getTextWidth`), nunca por número de caracteres.
 */
import { isProductId } from './product-qr'

export const LETTER_WIDTH_MM = 215.9
export const LETTER_HEIGHT_MM = 279.4
export const LABEL_COLUMNS = 3
export const LABEL_ROWS = 10
export const LABELS_PER_SHEET = LABEL_COLUMNS * LABEL_ROWS

export type LabelDesign = 'qr-only' | 'qr-detail'
export const LABEL_DESIGNS: readonly LabelDesign[] = ['qr-only', 'qr-detail']
export const DEFAULT_LABEL_DESIGN: LabelDesign = 'qr-only'

/** Lado del QR (incluye su zona de silencio) en ambos diseños: ~20 mm. */
export const QR_TARGET_MM = 20
/** Aire mínimo entre el QR y el borde de la etiqueta cuando la etiqueta es baja. */
const QR_EDGE_MM = 1
/** Diseño B: aire a la izquierda del QR, entre QR y texto, y a la derecha del texto. */
const DETAIL_PAD_LEFT_MM = 2
const DETAIL_GAP_MM = 2
const DETAIL_PAD_RIGHT_MM = 2
/** Ancho útil del texto del diseño B (~40 mm). */
export const DETAIL_TEXT_WIDTH_MM = 40
/** Aire arriba y abajo del bloque de texto. */
const TEXT_EDGE_MM = 1.5

/** Tamaños de letra (pt): mínimo legible 6; el nombre, en negritas, es el más grande. */
export const NAME_FONT_PT = 7
export const DETAIL_FONT_PT = 6.5
export const DESCRIPTION_FONT_PT = 6
export const NAME_MAX_LINES = 2
export const DESCRIPTION_MAX_LINES = 2

const MM_PER_PT = 25.4 / 72
const LINE_HEIGHT_FACTOR = 1.15
const NAME_FALLBACK = 'Sin nombre'
const ELLIPSIS = '…'
const QR_STEP_MM = 0.05

export interface LabelCalibration {
  /** Distancia del borde superior de la hoja a la primera fila (mm). */
  marginTopMm: number
  /** Distancia del borde izquierdo de la hoja a la primera columna (mm). */
  marginLeftMm: number
  /** Ancho de la etiqueta (mm). */
  labelWidthMm: number
  /** Alto de la etiqueta (mm). */
  labelHeightMm: number
  /** Espacio horizontal ENTRE etiquetas (mm); el paso de columna es ancho + separación. */
  gapXMm: number
  /** Paso vertical: de la parte superior de una fila a la de la siguiente (mm). */
  pitchYMm: number
}

export const DEFAULT_CALIBRATION: LabelCalibration = {
  marginTopMm: 12.7,
  marginLeftMm: 4.8,
  labelWidthMm: 66.7,
  labelHeightMm: 25.4,
  gapXMm: 3.2,
  pitchYMm: 25.4,
}

export const CALIBRATION_KEYS = Object.keys(DEFAULT_CALIBRATION) as (keyof LabelCalibration)[]

export const CALIBRATION_LIMITS: Record<keyof LabelCalibration, { min: number; max: number; step: number }> = {
  marginTopMm: { min: 0, max: 30, step: 0.1 },
  marginLeftMm: { min: 0, max: 30, step: 0.1 },
  labelWidthMm: { min: 40, max: 100, step: 0.1 },
  labelHeightMm: { min: 15, max: 40, step: 0.1 },
  gapXMm: { min: 0, max: 10, step: 0.1 },
  pitchYMm: { min: 15, max: 40, step: 0.1 },
}

export interface LabelInput {
  id: string
  name: string
  brand?: string | null
  presentation?: string | null
  description?: string | null
}

export interface CellBox { x: number; y: number; w: number; h: number }

export interface PlannedText {
  text: string
  /** Borde IZQUIERDO del renglón (el texto se alinea a la izquierda). */
  x: number
  /** Borde SUPERIOR del renglón. */
  y: number
  fontPt: number
  bold: boolean
}

export interface PlannedLabel {
  id: string
  /** Posición en la lista (0-based). */
  index: number
  page: number
  row: number
  col: number
  /** Caja de la etiqueta en la hoja. */
  cell: CellBox
  /** Caja cuadrada del QR (incluye su zona de silencio). */
  qr: { x: number; y: number; size: number }
  /** Vacío en el diseño "Solo QR". */
  textLines: PlannedText[]
}

export interface LabelSheetPlan {
  calibration: LabelCalibration
  design: LabelDesign
  pages: number
  labels: PlannedLabel[]
  qrSizeMm: number
  textMaxWidthMm: number
  /** Cuánto se sale de la hoja el borde inferior de la última fila (0 si cabe). */
  bottomOverflowMm: number
  /** Cuánto se sale de la hoja el borde derecho de la última columna (0 si cabe). */
  rightOverflowMm: number
}

/** Mide un texto en mm con el tamaño (pt) y el peso dados. */
export type TextMeasure = (text: string, fontPt: number, bold: boolean) => number

// ── Aritmética exacta ────────────────────────────────────────────────────────
function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}
const round3 = (value: number) => round(value, 3)

function floorToStep(value: number, step: number): number {
  return round3(Math.floor(value / step + 1e-9) * step)
}

// ── Calibración ──────────────────────────────────────────────────────────────
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** Deja una calibración válida: no numérico -> por omisión, fuera de rango -> al límite, 2 decimales. */
export function normalizeCalibration(input: unknown): LabelCalibration {
  const source = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>
  const result = { ...DEFAULT_CALIBRATION }
  for (const key of CALIBRATION_KEYS) {
    const value = toNumber(source[key])
    if (value === null) continue
    const { min, max } = CALIBRATION_LIMITS[key]
    result[key] = round(Math.min(max, Math.max(min, value)), 2)
  }
  return result
}

export function isDefaultCalibration(calibration: LabelCalibration): boolean {
  return CALIBRATION_KEYS.every((key) => calibration[key] === DEFAULT_CALIBRATION[key])
}

export function isLabelDesign(value: unknown): value is LabelDesign {
  return typeof value === 'string' && (LABEL_DESIGNS as readonly string[]).includes(value)
}

// ── Hojas y celdas ───────────────────────────────────────────────────────────
/** Hojas necesarias para `count` etiquetas (30 por hoja). */
export function sheetCount(count: number): number {
  if (!Number.isInteger(count) || count < 0) throw new RangeError('The number of labels must be a whole number >= 0')
  return Math.ceil(count / LABELS_PER_SHEET)
}

/** Fila y columna (0-based) de la etiqueta en su hoja, y número de hoja (0-based). */
export function slotOf(index: number): { page: number; row: number; col: number } {
  const slot = index % LABELS_PER_SHEET
  return { page: Math.floor(index / LABELS_PER_SHEET), row: Math.floor(slot / LABEL_COLUMNS), col: slot % LABEL_COLUMNS }
}

/** Esquina superior izquierda de la celda (fila, columna) en mm, con la calibración dada. */
export function cellOrigin(row: number, col: number, calibration: LabelCalibration): { x: number; y: number } {
  return {
    x: round3(calibration.marginLeftMm + col * (calibration.labelWidthMm + calibration.gapXMm)),
    y: round3(calibration.marginTopMm + row * calibration.pitchYMm),
  }
}

/** Cuánto se sale de la hoja Carta el borde inferior de la última fila (0 si cabe). */
export function gridBottomOverflowMm(calibration: LabelCalibration): number {
  const bottom = cellOrigin(LABEL_ROWS - 1, 0, calibration).y + calibration.labelHeightMm
  return Math.max(0, round3(bottom - LETTER_HEIGHT_MM))
}

/** Cuánto se sale de la hoja Carta el borde derecho de la última columna (0 si cabe). */
export function gridRightOverflowMm(calibration: LabelCalibration): number {
  const right = cellOrigin(0, LABEL_COLUMNS - 1, calibration).x + calibration.labelWidthMm
  return Math.max(0, round3(right - LETTER_WIDTH_MM))
}

/** `etiquetas-qr-YYYYMMDD.pdf` con la fecha LOCAL. */
export function labelSheetFileName(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `etiquetas-qr-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}.pdf`
}

// ── Texto ────────────────────────────────────────────────────────────────────
/**
 * Las fuentes base de PDF (Helvetica) cubren Latin-1 y la elipsis «…»: acentos y ñ sí;
 * emoji, CJK y demás no. Lo que no cabe se cambia por un espacio (no por un cuadro roto)
 * y los blancos se colapsan.
 */
export function sanitizeLabelText(input: string): string {
  return input
    .normalize('NFC')
    .replace(/[^ -~¡-¬®-ÿ…]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Medida aproximada (0,55 em por carácter) cuando no hay una fuente real a mano. */
const estimateTextWidthMm: TextMeasure = (text, fontPt) => text.length * 0.55 * fontPt * MM_PER_PT

interface Face { fontPt: number; bold: boolean }

function breakLongWord(word: string, fits: (text: string) => boolean): string[] {
  const parts: string[] = []
  let current = ''
  for (const char of word) {
    if (current && !fits(current + char)) {
      parts.push(current)
      current = char
    } else {
      current += char
    }
  }
  if (current) parts.push(current)
  return parts
}

function fitWithEllipsis(line: string, fits: (text: string) => boolean): string {
  let text = line
  while (text.length > 0 && !fits(text + ELLIPSIS)) text = text.slice(0, -1)
  return text.trimEnd() + ELLIPSIS
}

/**
 * El texto en como mucho `maxLines` renglones de hasta `maxWidthMm`; si sobra, el último
 * termina en «…». Cada renglón MIDE ≤ `maxWidthMm` con el medidor dado.
 */
export function wrapText(text: string, maxWidthMm: number, measure: TextMeasure, face: Face, maxLines: number): string[] {
  const clean = sanitizeLabelText(text)
  if (!clean) return []
  const fits = (candidate: string) => measure(candidate, face.fontPt, face.bold) <= maxWidthMm
  const words = clean.split(' ').flatMap((word) => (fits(word) ? [word] : breakLongWord(word, fits)))

  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (current && !fits(candidate)) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)

  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  kept[maxLines - 1] = fitWithEllipsis(kept[maxLines - 1]!, fits)
  return kept
}

// ── Diseños ──────────────────────────────────────────────────────────────────
const linePitchMm = (fontPt: number) => round3(fontPt * LINE_HEIGHT_FACTOR * MM_PER_PT)

/** Lado del QR: ~20 mm, o menos si la etiqueta es más baja o más angosta que eso. */
export function qrSizeFor(calibration: LabelCalibration, design: LabelDesign): number {
  const byHeight = calibration.labelHeightMm - 2 * QR_EDGE_MM
  const byWidth = design === 'qr-only'
    ? calibration.labelWidthMm - 2 * QR_EDGE_MM
    : calibration.labelWidthMm - DETAIL_PAD_LEFT_MM - DETAIL_GAP_MM - DETAIL_PAD_RIGHT_MM - 15
  return floorToStep(Math.min(QR_TARGET_MM, byHeight, byWidth), QR_STEP_MM)
}

/** Ancho útil del texto del diseño B: ~40 mm, o lo que quede junto al QR. */
export function detailTextWidthFor(calibration: LabelCalibration): number {
  const qr = qrSizeFor(calibration, 'qr-detail')
  const free = calibration.labelWidthMm - DETAIL_PAD_LEFT_MM - qr - DETAIL_GAP_MM - DETAIL_PAD_RIGHT_MM
  return floorToStep(Math.min(DETAIL_TEXT_WIDTH_MM, free), QR_STEP_MM)
}

interface TextRun { text: string; face: Face }

/**
 * Renglones del diseño B por orden de prioridad. El nombre siempre entra (hasta 2 renglones,
 * recortado a lo que quepa en alto); marca y presentación van si existen y caben; la
 * descripción solo si cabe, con los renglones que quepan (máx. 2).
 */
function detailRuns(product: LabelInput, widthMm: number, availableHeightMm: number, measure: TextMeasure): TextRun[] {
  const nameFace: Face = { fontPt: NAME_FONT_PT, bold: true }
  const detailFace: Face = { fontPt: DETAIL_FONT_PT, bold: false }
  const descFace: Face = { fontPt: DESCRIPTION_FONT_PT, bold: false }

  const nameLines = wrapText(product.name ?? '', widthMm, measure, nameFace, NAME_MAX_LINES)
  const runs: TextRun[] = (nameLines.length > 0 ? nameLines : [NAME_FALLBACK]).map((text) => ({ text, face: nameFace }))
  let used = runs.length * linePitchMm(NAME_FONT_PT)

  const optional: { value: string | null | undefined; face: Face; maxLines: number }[] = [
    { value: product.brand, face: detailFace, maxLines: 1 },
    { value: product.presentation, face: detailFace, maxLines: 1 },
    { value: product.description, face: descFace, maxLines: DESCRIPTION_MAX_LINES },
  ]
  for (const field of optional) {
    const pitch = linePitchMm(field.face.fontPt)
    const room = Math.floor((availableHeightMm - used + 1e-9) / pitch)
    if (room <= 0) continue
    const lines = wrapText(field.value ?? '', widthMm, measure, field.face, Math.min(field.maxLines, room))
    for (const text of lines) runs.push({ text, face: field.face })
    used += lines.length * pitch
  }
  return runs
}

// ── El plan ──────────────────────────────────────────────────────────────────
export function planLabelSheet(
  products: readonly LabelInput[],
  calibration: LabelCalibration = DEFAULT_CALIBRATION,
  design: LabelDesign = DEFAULT_LABEL_DESIGN,
  measure: TextMeasure = estimateTextWidthMm,
): LabelSheetPlan {
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error('At least one product is required to build a label sheet')
  }
  for (const product of products) {
    if (!isProductId(product?.id)) throw new Error(`Invalid product id "${String(product?.id)}": its QR could not be read by the scanner`)
  }
  if (!isLabelDesign(design)) throw new Error(`Unknown label design "${String(design)}"`)

  const cal = normalizeCalibration(calibration)
  const qrSize = qrSizeFor(cal, design)
  const textWidth = design === 'qr-detail' ? detailTextWidthFor(cal) : 0
  const textAvailableHeight = cal.labelHeightMm - 2 * TEXT_EDGE_MM

  const labels = products.map((product, index): PlannedLabel => {
    const { page, row, col } = slotOf(index)
    const origin = cellOrigin(row, col, cal)
    const cell: CellBox = { x: origin.x, y: origin.y, w: cal.labelWidthMm, h: cal.labelHeightMm }
    const qrY = round3(cell.y + (cell.h - qrSize) / 2)

    if (design === 'qr-only') {
      return { id: product.id, index, page, row, col, cell, qr: { x: round3(cell.x + (cell.w - qrSize) / 2), y: qrY, size: qrSize }, textLines: [] }
    }

    const qr = { x: round3(cell.x + DETAIL_PAD_LEFT_MM), y: qrY, size: qrSize }
    const runs = detailRuns(product, textWidth, textAvailableHeight, measure)
    const blockHeight = runs.reduce((sum, run) => sum + linePitchMm(run.face.fontPt), 0)
    const textX = round3(qr.x + qrSize + DETAIL_GAP_MM)
    let y = cell.y + (cell.h - blockHeight) / 2
    const textLines = runs.map((run): PlannedText => {
      const line = { text: run.text, x: textX, y: round3(y), fontPt: run.face.fontPt, bold: run.face.bold }
      y += linePitchMm(run.face.fontPt)
      return line
    })
    return { id: product.id, index, page, row, col, cell, qr, textLines }
  })

  return {
    calibration: cal,
    design,
    pages: sheetCount(products.length),
    labels,
    qrSizeMm: qrSize,
    textMaxWidthMm: textWidth,
    bottomOverflowMm: gridBottomOverflowMm(cal),
    rightOverflowMm: gridRightOverflowMm(cal),
  }
}
