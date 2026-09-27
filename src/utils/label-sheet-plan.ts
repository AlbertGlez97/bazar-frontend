/**
 * Plan de una hoja de etiquetas OFITURIA: A4, 72 etiquetas de 35 x 25 mm en una
 * cuadrícula de 6 columnas x 12 filas. PURO: sin PDF, sin QR, sin DOM. Todo en
 * milímetros; `services/qr-label-sheet.ts` solo dibuja lo que este plan dice.
 *
 * El problema físico que resuelve la calibración:
 * - 6 columnas x 35 mm = 210 mm = el ancho exacto de un A4: no hay nada que ajustar.
 * - 12 filas x 25 mm = 300 mm, pero un A4 mide 297 mm. El error no se arregla con un
 *   desplazamiento porque se acumula fila por fila (0,25 mm por fila, 3 mm en la última).
 *   Por eso la calibración incluye el ALTO DE FILA (`rowPitchMm`): por omisión 24,75 mm
 *   (= 297 / 12), con lo que las 12 filas llenan el A4 exacto. Quien quiera 25 mm puede
 *   escribirlo: el plan lo permite y avisa cuánto se sale de la hoja (`bottomOverflowMm`).
 * - Además de eso, la impresora casi nunca alinea perfecto: `offsetTopMm` y `offsetLeftMm`.
 */
import { isProductId } from './product-qr'

export const A4_WIDTH_MM = 210
export const A4_HEIGHT_MM = 297
export const LABEL_COLUMNS = 6
export const LABEL_ROWS = 12
export const LABELS_PER_SHEET = LABEL_COLUMNS * LABEL_ROWS
/** Paso de columna = ancho de la etiqueta (6 x 35 = 210). Fijo. */
export const LABEL_WIDTH_MM = 35
/** Alto nominal de la etiqueta en el papel. */
export const LABEL_NOMINAL_HEIGHT_MM = 25
/** 297 / 12: las 12 filas llenan el A4 exacto. */
export const DEFAULT_ROW_PITCH_MM = 24.75
/** Margen de seguridad a cada borde de la etiqueta (la impresora se corre). */
export const LABEL_MARGIN_MM = 1.5

/** Tamaño del nombre y su interlineado (fuentes base de PDF: Helvetica). */
export const NAME_FONT_PT = 6
export const NAME_MAX_LINES = 2
const MM_PER_PT = 25.4 / 72
const LINE_HEIGHT_FACTOR = 1.15
const NAME_GAP_MM = 0.5
/** Con menos ancho que esto un nombre ya no se lee: decide "abajo" o "al lado". */
export const MIN_LEGIBLE_TEXT_WIDTH_MM = 15
const QR_STEP_MM = 0.05
const NAME_FALLBACK = 'Sin nombre'
const ELLIPSIS = '...'

export interface LabelCalibration {
  /** Desplazamiento de toda la cuadrícula hacia abajo (mm, puede ser negativo). */
  offsetTopMm: number
  /** Desplazamiento de toda la cuadrícula hacia la derecha (mm, puede ser negativo). */
  offsetLeftMm: number
  /** Distancia entre filas (mm). 24,75 hace caber 12 filas en un A4. */
  rowPitchMm: number
}

export const DEFAULT_CALIBRATION: LabelCalibration = { offsetTopMm: 0, offsetLeftMm: 0, rowPitchMm: DEFAULT_ROW_PITCH_MM }

export const CALIBRATION_LIMITS = {
  offset: { min: -10, max: 10, step: 0.1 },
  /** Permite escribir 25 (el alto nominal) aunque no quepa: se avisa, no se impide. */
  rowPitch: { min: 20, max: 26, step: 0.05 },
} as const

export interface LabelInput {
  id: string
  name: string
}

export interface CellBox { x: number; y: number; w: number; h: number }

export interface PlannedLabel {
  id: string
  /** Posición en la lista (0-based). */
  index: number
  page: number
  row: number
  col: number
  /** Caja de diseño de la etiqueta en la hoja. */
  cell: CellBox
  /** Caja cuadrada del QR (incluye su zona de silencio). */
  qr: { x: number; y: number; size: number }
  /** Renglones del nombre; `y` es el borde SUPERIOR de cada renglón. */
  textLines: { text: string; x: number; y: number }[]
}

export interface LabelLayout {
  marginMm: number
  fontSizePt: number
  linePitchMm: number
  gapMm: number
  qrSizeMm: number
  textMaxWidthMm: number
}

export interface LabelSheetPlan {
  calibration: LabelCalibration
  pages: number
  labels: PlannedLabel[]
  layout: LabelLayout
  /** Cuánto se sale del A4 el borde inferior de la última fila (0 si cabe). */
  bottomOverflowMm: number
}

/** Mide un texto en mm al tamaño de fuente del plan (`NAME_FONT_PT`). */
export type TextMeasure = (text: string) => number

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

function clampTo(value: number | null, fallback: number, min: number, max: number): number {
  if (value === null) return fallback
  return round(Math.min(max, Math.max(min, value)), 2)
}

/** Deja una calibración válida: valores no numéricos -> por omisión, fuera de rango -> al límite, 2 decimales. */
export function normalizeCalibration(input: unknown): LabelCalibration {
  const source = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>
  const { offset, rowPitch } = CALIBRATION_LIMITS
  return {
    offsetTopMm: clampTo(toNumber(source.offsetTopMm), DEFAULT_CALIBRATION.offsetTopMm, offset.min, offset.max),
    offsetLeftMm: clampTo(toNumber(source.offsetLeftMm), DEFAULT_CALIBRATION.offsetLeftMm, offset.min, offset.max),
    rowPitchMm: clampTo(toNumber(source.rowPitchMm), DEFAULT_CALIBRATION.rowPitchMm, rowPitch.min, rowPitch.max),
  }
}

// ── Hojas y celdas ───────────────────────────────────────────────────────────
/** Hojas necesarias para `count` etiquetas (72 por hoja). */
export function sheetCount(count: number): number {
  if (!Number.isInteger(count) || count < 0) throw new RangeError('The number of labels must be a whole number >= 0')
  return Math.ceil(count / LABELS_PER_SHEET)
}

/** Esquina superior izquierda de la celda (fila, columna) en mm, con la calibración dada. */
export function cellOrigin(row: number, col: number, calibration: LabelCalibration): { x: number; y: number } {
  return {
    x: round3(calibration.offsetLeftMm + col * LABEL_WIDTH_MM),
    y: round3(calibration.offsetTopMm + row * calibration.rowPitchMm),
  }
}

const cellHeight = (rowPitchMm: number) => Math.min(rowPitchMm, LABEL_NOMINAL_HEIGHT_MM)
const linePitchMm = () => round3(NAME_FONT_PT * LINE_HEIGHT_FACTOR * MM_PER_PT)

// ── Texto ────────────────────────────────────────────────────────────────────
/**
 * Las fuentes base de PDF (Helvetica) cubren Latin-1: acentos y ñ sí; emoji, CJK y
 * demás no. Lo que no cabe se cambia por un espacio (no por un cuadro roto) y los
 * blancos se colapsan.
 */
export function sanitizeLabelText(input: string): string {
  return input
    .normalize('NFC')
    .replace(/[^ -~¡-¬®-ÿ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Medida aproximada (0,55 em por carácter) cuando no hay una fuente real a mano. */
function estimateTextWidthMm(text: string): number {
  return text.length * 0.55 * NAME_FONT_PT * MM_PER_PT
}

function breakLongWord(word: string, maxWidthMm: number, measure: TextMeasure): string[] {
  const parts: string[] = []
  let current = ''
  for (const char of word) {
    if (current && measure(current + char) > maxWidthMm) {
      parts.push(current)
      current = char
    } else {
      current += char
    }
  }
  if (current) parts.push(current)
  return parts
}

function fitWithEllipsis(line: string, maxWidthMm: number, measure: TextMeasure): string {
  let text = line
  while (text.length > 0 && measure(text + ELLIPSIS) > maxWidthMm) text = text.slice(0, -1)
  return text.trimEnd() + ELLIPSIS
}

/** El nombre en como mucho `maxLines` renglones; si sobra texto, el último termina en "...". */
export function wrapLabelName(name: string, maxWidthMm: number, measure: TextMeasure, maxLines: number = NAME_MAX_LINES): string[] {
  const text = sanitizeLabelText(name) || NAME_FALLBACK
  const words = text.split(' ').flatMap((word) => (measure(word) > maxWidthMm ? breakLongWord(word, maxWidthMm, measure) : [word]))

  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (current && measure(candidate) > maxWidthMm) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)

  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  kept[maxLines - 1] = fitWithEllipsis(kept[maxLines - 1]!, maxWidthMm, measure)
  return kept
}

// ── Diseño de la etiqueta ────────────────────────────────────────────────────
export interface LayoutOption { qrMm: number; textWidthMm: number; chosen: boolean }

/**
 * Compara los dos diseños posibles para el alto de fila dado. "Al lado" da un QR más
 * grande pero deja una columna de texto demasiado angosta para leer un nombre; el plan
 * usa "abajo" salvo que la columna del texto llegue a `MIN_LEGIBLE_TEXT_WIDTH_MM`.
 */
export function evaluateLabelLayouts(rowPitchMm: number): { below: LayoutOption; side: LayoutOption } {
  const innerW = LABEL_WIDTH_MM - 2 * LABEL_MARGIN_MM
  const innerH = cellHeight(rowPitchMm) - 2 * LABEL_MARGIN_MM
  const belowQr = floorToStep(Math.min(innerW, innerH - NAME_MAX_LINES * linePitchMm() - NAME_GAP_MM), QR_STEP_MM)
  const sideQr = floorToStep(Math.min(innerH, innerW), QR_STEP_MM)
  const sideText = round3(innerW - sideQr - NAME_GAP_MM)
  const sideWins = sideText >= MIN_LEGIBLE_TEXT_WIDTH_MM && sideQr > belowQr
  return {
    below: { qrMm: belowQr, textWidthMm: innerW, chosen: !sideWins },
    side: { qrMm: sideQr, textWidthMm: sideText, chosen: sideWins },
  }
}

// ── El plan ──────────────────────────────────────────────────────────────────
export function planLabelSheet(
  products: readonly LabelInput[],
  calibration: LabelCalibration = DEFAULT_CALIBRATION,
  measure: TextMeasure = estimateTextWidthMm,
): LabelSheetPlan {
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error('At least one product is required to build a label sheet')
  }
  for (const product of products) {
    if (!isProductId(product?.id)) throw new Error(`Invalid product id "${String(product?.id)}": its QR could not be read by the scanner`)
  }

  const cal = normalizeCalibration(calibration)
  const pitch = linePitchMm()
  const boxH = cellHeight(cal.rowPitchMm)
  const innerW = LABEL_WIDTH_MM - 2 * LABEL_MARGIN_MM
  const qrSize = evaluateLabelLayouts(cal.rowPitchMm).below.qrMm

  const labels = products.map((product, index): PlannedLabel => {
    const slot = index % LABELS_PER_SHEET
    const row = Math.floor(slot / LABEL_COLUMNS)
    const col = slot % LABEL_COLUMNS
    const origin = cellOrigin(row, col, cal)
    const cell: CellBox = { x: origin.x, y: origin.y, w: LABEL_WIDTH_MM, h: boxH }
    const qr = {
      x: round3(cell.x + (LABEL_WIDTH_MM - qrSize) / 2),
      y: round3(cell.y + LABEL_MARGIN_MM),
      size: qrSize,
    }
    const centerX = round3(cell.x + LABEL_WIDTH_MM / 2)
    const textTop = qr.y + qr.size + NAME_GAP_MM
    const textLines = wrapLabelName(product.name, innerW, measure).map((text, i) => ({
      text,
      x: centerX,
      y: round3(textTop + i * pitch),
    }))
    return { id: product.id, index, page: Math.floor(index / LABELS_PER_SHEET), row, col, cell, qr, textLines }
  })

  const lastRowBottom = cal.offsetTopMm + (LABEL_ROWS - 1) * cal.rowPitchMm + boxH
  return {
    calibration: cal,
    pages: sheetCount(products.length),
    labels,
    layout: {
      marginMm: LABEL_MARGIN_MM,
      fontSizePt: NAME_FONT_PT,
      linePitchMm: pitch,
      gapMm: NAME_GAP_MM,
      qrSizeMm: qrSize,
      textMaxWidthMm: innerW,
    },
    bottomOverflowMm: Math.max(0, round3(lastRowBottom - A4_HEIGHT_MM)),
  }
}
