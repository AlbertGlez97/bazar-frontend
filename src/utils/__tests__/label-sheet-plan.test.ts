import { describe, expect, it } from 'vitest'
import {
  A4_HEIGHT_MM,
  A4_WIDTH_MM,
  CALIBRATION_LIMITS,
  DEFAULT_CALIBRATION,
  DEFAULT_ROW_PITCH_MM,
  LABELS_PER_SHEET,
  LABEL_COLUMNS,
  LABEL_MARGIN_MM,
  LABEL_ROWS,
  LABEL_WIDTH_MM,
  cellOrigin,
  evaluateLabelLayouts,
  gridBottomOverflowMm,
  labelSheetFileName,
  normalizeCalibration,
  planLabelSheet,
  sanitizeLabelText,
  sheetCount,
  wrapLabelName,
  type LabelInput,
} from '../label-sheet-plan'

const ID = (n: number) => `01a0ddd7-7f00-744a-8b23-${String(n).padStart(12, '0')}`
const items = (count: number, name = 'Taza'): LabelInput[] => Array.from({ length: count }, (_, i) => ({ id: ID(i), name: `${name} ${i}` }))
/** Medidor de prueba: 1 mm por carácter, exacto y sin depender de una fuente. */
const oneMmPerChar = (text: string) => text.length

describe('sheet geometry (OFITURIA, A4, 6 x 12)', () => {
  it('is 6 columns x 12 rows = 72 labels', () => {
    expect(LABEL_COLUMNS * LABEL_ROWS).toBe(72)
    expect(LABELS_PER_SHEET).toBe(72)
  })

  it('6 columns of 35 mm fill the A4 width exactly', () => {
    expect(LABEL_COLUMNS * LABEL_WIDTH_MM).toBe(A4_WIDTH_MM)
  })

  it('the default row pitch is 297/12 = 24.75 mm so the 12 rows fill the A4 height exactly', () => {
    expect(DEFAULT_ROW_PITCH_MM).toBe(24.75)
    expect(LABEL_ROWS * DEFAULT_ROW_PITCH_MM).toBe(A4_HEIGHT_MM)
  })

  it('a 25 mm pitch cannot fit: 12 x 25 = 300 mm is 3 mm more than an A4 sheet', () => {
    expect(LABEL_ROWS * 25 - A4_HEIGHT_MM).toBe(3)
  })
})

describe('sheetCount', () => {
  it.each([[0, 0], [1, 1], [71, 1], [72, 1], [73, 2], [144, 2], [145, 3], [1000, 14]])('%i labels -> %i sheet(s)', (n, expected) => {
    expect(sheetCount(n)).toBe(expected)
  })

  it.each([-1, 1.5, Number.NaN])('rejects %s', (n) => {
    expect(() => sheetCount(n)).toThrow()
  })
})

describe('cellOrigin (mm)', () => {
  it.each([
    [0, 0, 0, 0],
    [0, 5, 175, 0],
    [11, 0, 0, 272.25],
    [11, 5, 175, 272.25],
    [3, 2, 70, 74.25],
  ])('row %i col %i -> x %s, y %s with the default calibration', (row, col, x, y) => {
    expect(cellOrigin(row, col, DEFAULT_CALIBRATION)).toEqual({ x, y })
  })

  it('the last row ends exactly at the bottom of the A4 sheet with the default pitch', () => {
    expect(cellOrigin(11, 0, DEFAULT_CALIBRATION).y + DEFAULT_ROW_PITCH_MM).toBe(A4_HEIGHT_MM)
  })

  it('applies positive, negative and decimal offsets exactly (no float drift)', () => {
    const cal = { offsetTopMm: 1.5, offsetLeftMm: -0.8, rowPitchMm: 24.75 }
    expect(cellOrigin(0, 0, cal)).toEqual({ x: -0.8, y: 1.5 })
    expect(cellOrigin(11, 5, cal)).toEqual({ x: 174.2, y: 273.75 })
    expect(cellOrigin(1, 1, { offsetTopMm: 0.1, offsetLeftMm: 0.2, rowPitchMm: 24.75 })).toEqual({ x: 35.2, y: 24.85 })
  })

  it('a custom row pitch moves every row', () => {
    const cal = { ...DEFAULT_CALIBRATION, rowPitchMm: 25 }
    expect(cellOrigin(11, 0, cal).y).toBe(275)
    expect(cellOrigin(1, 0, cal).y).toBe(25)
  })
})

describe('normalizeCalibration', () => {
  it('defaults are 0, 0 and 24.75', () => {
    expect(DEFAULT_CALIBRATION).toEqual({ offsetTopMm: 0, offsetLeftMm: 0, rowPitchMm: 24.75 })
    expect(normalizeCalibration({})).toEqual(DEFAULT_CALIBRATION)
    expect(normalizeCalibration(null)).toEqual(DEFAULT_CALIBRATION)
    expect(normalizeCalibration('nope')).toEqual(DEFAULT_CALIBRATION)
  })

  it('keeps valid values, negatives included', () => {
    expect(normalizeCalibration({ offsetTopMm: -1.2, offsetLeftMm: 3.4, rowPitchMm: 25 })).toEqual({ offsetTopMm: -1.2, offsetLeftMm: 3.4, rowPitchMm: 25 })
  })

  it('falls back to the default for NaN, Infinity, empty and non-numeric input', () => {
    expect(normalizeCalibration({ offsetTopMm: Number.NaN, offsetLeftMm: Infinity, rowPitchMm: '' })).toEqual(DEFAULT_CALIBRATION)
    expect(normalizeCalibration({ offsetTopMm: 'abc', offsetLeftMm: {}, rowPitchMm: [] })).toEqual(DEFAULT_CALIBRATION)
  })

  it('accepts numeric text (an input field) and rounds to 2 decimals', () => {
    expect(normalizeCalibration({ offsetTopMm: '1.5', offsetLeftMm: ' 0.333 ', rowPitchMm: '24.754' })).toEqual({ offsetTopMm: 1.5, offsetLeftMm: 0.33, rowPitchMm: 24.75 })
    expect(normalizeCalibration({ offsetTopMm: 0.1 + 0.2 }).offsetTopMm).toBe(0.3)
  })

  it('clamps to the allowed ranges', () => {
    const { offset, rowPitch } = CALIBRATION_LIMITS
    expect(normalizeCalibration({ offsetTopMm: 99, offsetLeftMm: -99, rowPitchMm: 99 })).toEqual({ offsetTopMm: offset.max, offsetLeftMm: offset.min, rowPitchMm: rowPitch.max })
    expect(normalizeCalibration({ rowPitchMm: 1 }).rowPitchMm).toBe(rowPitch.min)
  })

  it('the range allows typing 25 mm (the nominal label height) even though it cannot fit', () => {
    expect(CALIBRATION_LIMITS.rowPitch.max).toBeGreaterThanOrEqual(25)
  })
})

describe('sanitizeLabelText (jsPDF core fonts are Latin-1 only)', () => {
  it.each([
    ['Bonsái Ficus Ginseng', 'Bonsái Ficus Ginseng'],
    ['Ñandú pequeño ü', 'Ñandú pequeño ü'],
    ['Maceta 🌵 grande', 'Maceta grande'],
    ['  varios   espacios\ty\nsaltos ', 'varios espacios y saltos'],
    ['日本語', ''],
    ['', ''],
  ])('%j -> %j', (input, expected) => {
    expect(sanitizeLabelText(input)).toBe(expected)
  })
})

describe('wrapLabelName (max 2 lines, ellipsis)', () => {
  it('keeps a short name on one line', () => {
    expect(wrapLabelName('Taza', 30, oneMmPerChar)).toEqual(['Taza'])
  })

  it('wraps at word boundaries into 2 lines', () => {
    expect(wrapLabelName('Taza de barro negro pulido', 15, oneMmPerChar)).toEqual(['Taza de barro', 'negro pulido'])
  })

  it('never returns more than 2 lines and marks the cut with an ellipsis that still fits', () => {
    const lines = wrapLabelName('Un nombre larguísimo que no cabe en dos renglones de una etiqueta pequeña', 20, oneMmPerChar)
    expect(lines).toHaveLength(2)
    expect(lines[1]!.endsWith('...')).toBe(true)
    for (const line of lines) expect(oneMmPerChar(line)).toBeLessThanOrEqual(20)
  })

  it('breaks a single word longer than the line', () => {
    const lines = wrapLabelName('Supercalifragilisticoespialidoso', 10, oneMmPerChar)
    expect(lines.length).toBeLessThanOrEqual(2)
    for (const line of lines) expect(oneMmPerChar(line)).toBeLessThanOrEqual(10)
  })

  it('an empty or unsupported name gets a readable fallback', () => {
    expect(wrapLabelName('', 30, oneMmPerChar)).toEqual(['Sin nombre'])
    expect(wrapLabelName('🌵🌵', 30, oneMmPerChar)).toEqual(['Sin nombre'])
  })
})

describe('planLabelSheet', () => {
  it('needs at least one product', () => {
    expect(() => planLabelSheet([], DEFAULT_CALIBRATION)).toThrow(/product/i)
  })

  it.each([[1, 1], [72, 1], [73, 2], [144, 2], [145, 3]])('%i products -> %i page(s), one planned label each', (n, pages) => {
    const plan = planLabelSheet(items(n), DEFAULT_CALIBRATION, oneMmPerChar)
    expect(plan.pages).toBe(pages)
    expect(plan.labels).toHaveLength(n)
  })

  it('fills left to right, then top to bottom, then the next page', () => {
    const plan = planLabelSheet(items(145), DEFAULT_CALIBRATION, oneMmPerChar)
    const at = (i: number) => ({ page: plan.labels[i]!.page, row: plan.labels[i]!.row, col: plan.labels[i]!.col })
    expect(at(0)).toEqual({ page: 0, row: 0, col: 0 })
    expect(at(5)).toEqual({ page: 0, row: 0, col: 5 })
    expect(at(6)).toEqual({ page: 0, row: 1, col: 0 })
    expect(at(71)).toEqual({ page: 0, row: 11, col: 5 })
    expect(at(72)).toEqual({ page: 1, row: 0, col: 0 })
    expect(at(143)).toEqual({ page: 1, row: 11, col: 5 })
    expect(at(144)).toEqual({ page: 2, row: 0, col: 0 })
  })

  it('places the last label of the last page in its own cell', () => {
    const plan = planLabelSheet(items(100), DEFAULT_CALIBRATION, oneMmPerChar)
    const last = plan.labels[99]!
    expect(last.page).toBe(1)
    expect([last.row, last.col]).toEqual([4, 3]) // slot 99 - 72 = 27 -> row floor(27/6) = 4, col 27 % 6 = 3
  })

  it('cell boxes follow the calibration (offsets and pitch) in mm', () => {
    const cal = { offsetTopMm: 1.5, offsetLeftMm: -0.8, rowPitchMm: 24.75 }
    const plan = planLabelSheet(items(72), cal, oneMmPerChar)
    expect(plan.labels[0]!.cell).toEqual({ x: -0.8, y: 1.5, w: 35, h: 24.75 })
    expect(plan.labels[71]!.cell).toEqual({ x: 174.2, y: 273.75, w: 35, h: 24.75 })
  })

  it('the design box is min(row pitch, 25 mm) high', () => {
    expect(planLabelSheet(items(1), { ...DEFAULT_CALIBRATION, rowPitchMm: 24.75 }, oneMmPerChar).labels[0]!.cell.h).toBe(24.75)
    expect(planLabelSheet(items(1), { ...DEFAULT_CALIBRATION, rowPitchMm: 25 }, oneMmPerChar).labels[0]!.cell.h).toBe(25)
    expect(planLabelSheet(items(1), { ...DEFAULT_CALIBRATION, rowPitchMm: 26 }, oneMmPerChar).labels[0]!.cell.h).toBe(25)
  })

  it('reports whether the grid fits the A4 sheet (24.75 fits, 25 overflows by 3 mm)', () => {
    expect(planLabelSheet(items(1), DEFAULT_CALIBRATION, oneMmPerChar).bottomOverflowMm).toBe(0)
    expect(planLabelSheet(items(1), { ...DEFAULT_CALIBRATION, rowPitchMm: 25 }, oneMmPerChar).bottomOverflowMm).toBe(3)
    expect(planLabelSheet(items(1), { ...DEFAULT_CALIBRATION, offsetTopMm: 2 }, oneMmPerChar).bottomOverflowMm).toBe(2)
  })

  it('the QR is centred, the same size on every label, and keeps the safety margin to every edge', () => {
    const plan = planLabelSheet(items(72), DEFAULT_CALIBRATION, oneMmPerChar)
    const sizes = new Set(plan.labels.map((l) => l.qr.size))
    expect(sizes.size).toBe(1)
    for (const label of plan.labels) {
      const { cell, qr } = label
      expect(qr.x).toBeGreaterThanOrEqual(cell.x + LABEL_MARGIN_MM)
      expect(qr.x + qr.size).toBeLessThanOrEqual(cell.x + cell.w - LABEL_MARGIN_MM)
      expect(qr.y).toBeGreaterThanOrEqual(cell.y + LABEL_MARGIN_MM)
      expect(qr.x + qr.size / 2).toBeCloseTo(cell.x + cell.w / 2, 6)
    }
  })

  it('the QR is 16.35 mm at the default pitch (documented layout numbers)', () => {
    const plan = planLabelSheet(items(1), DEFAULT_CALIBRATION, oneMmPerChar)
    expect(plan.labels[0]!.qr.size).toBe(16.35)
    expect(plan.layout.fontSizePt).toBe(6)
  })

  it('the name lines sit below the QR, inside the cell minus the margin, centred and at most 2', () => {
    const plan = planLabelSheet(items(72, 'Un nombre bastante largo para forzar dos renglones'), DEFAULT_CALIBRATION, oneMmPerChar)
    for (const label of plan.labels) {
      expect(label.textLines.length).toBeGreaterThan(0)
      expect(label.textLines.length).toBeLessThanOrEqual(2)
      label.textLines.forEach((line, i) => {
        expect(line.x).toBeCloseTo(label.cell.x + label.cell.w / 2, 6)
        expect(line.y).toBeGreaterThanOrEqual(label.qr.y + label.qr.size)
        expect(line.y + plan.layout.linePitchMm).toBeLessThanOrEqual(label.cell.y + label.cell.h - LABEL_MARGIN_MM + 1e-9)
        if (i > 0) expect(line.y).toBeGreaterThan(label.textLines[i - 1]!.y)
      })
    }
  })

  it('never puts the price (or any number that is not in the name) on a label', () => {
    const plan = planLabelSheet([{ id: ID(1), name: 'Taza' }], DEFAULT_CALIBRATION, oneMmPerChar)
    expect(plan.labels[0]!.textLines.map((l) => l.text)).toEqual(['Taza'])
  })

  it('keeps a label inside its cell even with a 25 mm pitch (taller box, still inside)', () => {
    const plan = planLabelSheet(items(6), { ...DEFAULT_CALIBRATION, rowPitchMm: 25 }, oneMmPerChar)
    for (const label of plan.labels) {
      expect(label.qr.y + label.qr.size).toBeLessThanOrEqual(label.cell.y + label.cell.h - LABEL_MARGIN_MM)
    }
  })

  it('is deterministic', () => {
    const a = planLabelSheet(items(80), DEFAULT_CALIBRATION, oneMmPerChar)
    const b = planLabelSheet(items(80), DEFAULT_CALIBRATION, oneMmPerChar)
    expect(a).toEqual(b)
  })

  it('normalizes a wild calibration instead of trusting it', () => {
    const plan = planLabelSheet(items(1), { offsetTopMm: 999, offsetLeftMm: Number.NaN, rowPitchMm: -4 } as never, oneMmPerChar)
    expect(plan.calibration.offsetTopMm).toBe(CALIBRATION_LIMITS.offset.max)
    expect(plan.calibration.offsetLeftMm).toBe(0)
    expect(plan.calibration.rowPitchMm).toBe(CALIBRATION_LIMITS.rowPitch.min)
  })

  it('rejects a product whose id is not a UUID (its QR would be unreadable by the scanner)', () => {
    expect(() => planLabelSheet([{ id: 'p-1', name: 'X' }], DEFAULT_CALIBRATION, oneMmPerChar)).toThrow(/id/i)
  })
})

describe('gridBottomOverflowMm', () => {
  it.each([
    [{ offsetTopMm: 0, offsetLeftMm: 0, rowPitchMm: 24.75 }, 0],
    [{ offsetTopMm: 0, offsetLeftMm: 0, rowPitchMm: 25 }, 3],
    [{ offsetTopMm: 2, offsetLeftMm: 0, rowPitchMm: 24.75 }, 2],
    [{ offsetTopMm: -2, offsetLeftMm: 0, rowPitchMm: 24.75 }, 0],
    [{ offsetTopMm: 1.5, offsetLeftMm: 0, rowPitchMm: 25 }, 4.5],
    [{ offsetTopMm: 0, offsetLeftMm: 0, rowPitchMm: 24 }, 0],
  ])('%j -> %s mm past the bottom of the A4 sheet', (cal, expected) => {
    expect(gridBottomOverflowMm(cal)).toBe(expected)
  })

  it('normalizes a wild calibration first', () => {
    expect(gridBottomOverflowMm({ offsetTopMm: Number.NaN, offsetLeftMm: 0, rowPitchMm: 24.75 })).toBe(0)
  })
})

describe('labelSheetFileName', () => {
  it('is etiquetas-qr-YYYYMMDD.pdf with the LOCAL date', () => {
    expect(labelSheetFileName(new Date(2026, 8, 26, 23, 59))).toBe('etiquetas-qr-20260926.pdf')
    expect(labelSheetFileName(new Date(2026, 0, 5, 0, 1))).toBe('etiquetas-qr-20260105.pdf')
  })

  it('defaults to today', () => {
    expect(labelSheetFileName()).toMatch(/^etiquetas-qr-\d{8}\.pdf$/)
  })
})

describe('evaluateLabelLayouts (why the name goes BELOW the QR)', () => {
  it('side-by-side gives a bigger QR but leaves a column too narrow for a legible name', () => {
    const { below, side } = evaluateLabelLayouts(DEFAULT_ROW_PITCH_MM)
    expect(below.qrMm).toBe(16.35)
    expect(side.qrMm).toBeGreaterThan(below.qrMm)
    expect(side.textWidthMm).toBeLessThan(12)
    expect(below.textWidthMm).toBe(LABEL_WIDTH_MM - 2 * LABEL_MARGIN_MM)
    expect(below.chosen).toBe(true)
    expect(side.chosen).toBe(false)
  })
})
