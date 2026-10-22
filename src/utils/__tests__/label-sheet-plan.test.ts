import { describe, expect, it } from 'vitest'
import {
  CALIBRATION_KEYS,
  CALIBRATION_LIMITS,
  DEFAULT_CALIBRATION,
  DETAIL_TEXT_WIDTH_MM,
  LABELS_PER_SHEET,
  LABEL_COLUMNS,
  LABEL_ROWS,
  LETTER_HEIGHT_MM,
  LETTER_WIDTH_MM,
  QR_TARGET_MM,
  cellOrigin,
  gridBottomOverflowMm,
  gridRightOverflowMm,
  isDefaultCalibration,
  isLabelDesign,
  labelSheetFileName,
  normalizeCalibration,
  planLabelSheet,
  sanitizeLabelText,
  sheetCount,
  slotOf,
  wrapText,
  type LabelCalibration,
  type LabelDesign,
  type LabelInput,
  type TextMeasure,
} from '../label-sheet-plan'

const ID = (n: number) => `01a0ddd7-7f00-744a-8b23-${String(n).padStart(12, '0')}`
const items = (count: number, name = 'Taza'): LabelInput[] => Array.from({ length: count }, (_, i) => ({ id: ID(i), name: `${name} ${i}` }))
/** Medidor de prueba: 1 mm por carácter a 7 pt (proporcional al tamaño), exacto y sin depender de una fuente. */
const mm: TextMeasure = (text, pt) => (text.length * pt) / 7
const CALIBRATED: LabelCalibration = { marginTopMm: 10.2, marginLeftMm: 6.1, labelWidthMm: 66.2, labelHeightMm: 25.1, gapXMm: 3.6, pitchYMm: 25.6 }
const near = (actual: number, expected: number, digits = 6) => expect(actual).toBeCloseTo(expected, digits)

describe('sheet geometry (Office Depot 64413, Carta, 3 x 10)', () => {
  it('is 3 columns x 10 rows = 30 labels on a Letter sheet', () => {
    expect(LABEL_COLUMNS * LABEL_ROWS).toBe(30)
    expect(LABELS_PER_SHEET).toBe(30)
    expect(LETTER_WIDTH_MM).toBe(215.9)
    expect(LETTER_HEIGHT_MM).toBe(279.4)
  })

  it('has the documented default calibration', () => {
    expect(DEFAULT_CALIBRATION).toEqual({
      marginTopMm: 12.7, marginLeftMm: 4.8, labelWidthMm: 66.7, labelHeightMm: 25.4, gapXMm: 3.2, pitchYMm: 25.4,
    })
  })

  it('the default grid fits the Letter sheet', () => {
    expect(gridBottomOverflowMm(DEFAULT_CALIBRATION)).toBe(0)
    expect(gridRightOverflowMm(DEFAULT_CALIBRATION)).toBe(0)
  })

  it('reports how far a calibration pushes the grid off the sheet', () => {
    expect(gridBottomOverflowMm({ ...DEFAULT_CALIBRATION, marginTopMm: 30, pitchYMm: 30 })).toBeCloseTo(30 + 9 * 30 + 25.4 - 279.4, 6)
    expect(gridRightOverflowMm({ ...DEFAULT_CALIBRATION, marginLeftMm: 30 })).toBeCloseTo(30 + 2 * (66.7 + 3.2) + 66.7 - 215.9, 6)
  })
})

describe('sheetCount (30 per sheet)', () => {
  it.each([[0, 0], [1, 1], [30, 1], [31, 2], [60, 2], [61, 3], [300, 10]])('%i labels -> %i sheet(s)', (n, expected) => {
    expect(sheetCount(n)).toBe(expected)
  })

  it.each([-1, 1.5, Number.NaN])('rejects %s', (n) => {
    expect(() => sheetCount(n)).toThrow()
  })
})

describe('slotOf / cellOrigin (mm)', () => {
  it.each([
    [0, 0, 0, 0], [1, 0, 0, 1], [2, 0, 0, 2], [3, 0, 1, 0], [29, 0, 9, 2], [30, 1, 0, 0], [59, 1, 9, 2], [60, 2, 0, 0],
  ])('label index %i -> page %i, row %i, col %i', (index, page, row, col) => {
    expect(slotOf(index)).toEqual({ page, row, col })
  })

  it('label 1 sits at (left margin, top margin) with the defaults', () => {
    expect(cellOrigin(0, 0, DEFAULT_CALIBRATION)).toEqual({ x: 4.8, y: 12.7 })
  })

  it('moves one column by width + gap and one row by the vertical pitch', () => {
    near(cellOrigin(0, 1, DEFAULT_CALIBRATION).x, 4.8 + 66.7 + 3.2)
    near(cellOrigin(1, 0, DEFAULT_CALIBRATION).y, 12.7 + 25.4)
    near(cellOrigin(9, 2, CALIBRATED).x, 6.1 + 2 * (66.2 + 3.6))
    near(cellOrigin(9, 2, CALIBRATED).y, 10.2 + 9 * 25.6)
  })
})

describe('planLabelSheet positions', () => {
  it.each([['defaults', DEFAULT_CALIBRATION], ['calibrated', CALIBRATED]] as const)(
    'label 1 is at the margins and label 30 is column 3, row 10, inside 279.4 mm (%s)',
    (_name, cal) => {
      for (const design of ['qr-only', 'qr-detail'] as LabelDesign[]) {
        const { labels } = planLabelSheet(items(30), cal, design, mm)
        expect(labels[0]!.cell).toEqual({ x: cal.marginLeftMm, y: cal.marginTopMm, w: cal.labelWidthMm, h: cal.labelHeightMm })
        const last = labels[29]!
        expect([last.page, last.row, last.col]).toEqual([0, 9, 2])
        expect(last.cell.y + last.cell.h).toBeLessThanOrEqual(LETTER_HEIGHT_MM)
        expect(last.cell.x + last.cell.w).toBeLessThanOrEqual(LETTER_WIDTH_MM)
        near(last.cell.x, cal.marginLeftMm + 2 * (cal.labelWidthMm + cal.gapXMm))
        near(last.cell.y, cal.marginTopMm + 9 * cal.pitchYMm)
      }
    },
  )

  it.each([[30, 1], [31, 2], [60, 2], [61, 3]])('%i labels -> %i page(s)', (n, pages) => {
    const plan = planLabelSheet(items(n), DEFAULT_CALIBRATION, 'qr-only', mm)
    expect(plan.pages).toBe(pages)
    expect(plan.labels.at(-1)!.page).toBe(pages - 1)
  })

  it('label 31 starts a new page back at the first cell', () => {
    const { labels } = planLabelSheet(items(31), DEFAULT_CALIBRATION, 'qr-only', mm)
    expect(labels[30]!.page).toBe(1)
    expect(labels[30]!.cell).toEqual(labels[0]!.cell)
  })

  it.each(['qr-only', 'qr-detail'] as LabelDesign[])('copies repeat the id and each takes its own cell (%s)', (design) => {
    const one = { id: ID(7), name: 'Vaso largo', brand: 'Acme' }
    const copies = [one, one, one, { id: ID(8), name: 'Plato' }, one]
    const { labels } = planLabelSheet(copies, DEFAULT_CALIBRATION, design, mm)
    expect(labels.map((l) => l.id)).toEqual([ID(7), ID(7), ID(7), ID(8), ID(7)])
    expect(labels.map((l) => [l.row, l.col])).toEqual([[0, 0], [0, 1], [0, 2], [1, 0], [1, 1]])
    expect(new Set(labels.map((l) => `${l.cell.x},${l.cell.y}`)).size).toBe(5)
    // The QR keeps the same offset inside every cell: copies are identical labels.
    const offsets = labels.filter((l) => l.id === ID(7)).map((l) => [l.qr.x - l.cell.x, l.qr.y - l.cell.y, l.textLines.length].map((n) => n.toFixed(3)).join())
    expect(new Set(offsets).size).toBe(1)
  })

  it('rejects an empty list, a bad id and an unknown design', () => {
    expect(() => planLabelSheet([], DEFAULT_CALIBRATION, 'qr-only', mm)).toThrow()
    expect(() => planLabelSheet([{ id: 'abc', name: 'x' }], DEFAULT_CALIBRATION, 'qr-only', mm)).toThrow(/Invalid product id/)
    expect(() => planLabelSheet(items(1), DEFAULT_CALIBRATION, 'nope' as LabelDesign, mm)).toThrow(/Unknown label design/)
  })

  it('works with the built-in estimator when no measure is given', () => {
    expect(planLabelSheet(items(1)).labels).toHaveLength(1)
    expect(planLabelSheet(items(1), DEFAULT_CALIBRATION, 'qr-detail').labels[0]!.textLines.length).toBeGreaterThan(0)
  })
})

describe('design A "Solo QR"', () => {
  it('centres a ~20 mm QR in the label and draws no text', () => {
    for (const cal of [DEFAULT_CALIBRATION, CALIBRATED]) {
      const plan = planLabelSheet(items(30), cal, 'qr-only', mm)
      expect(plan.qrSizeMm).toBe(QR_TARGET_MM)
      for (const label of plan.labels) {
        near(label.qr.x + label.qr.size / 2, label.cell.x + label.cell.w / 2)
        near(label.qr.y + label.qr.size / 2, label.cell.y + label.cell.h / 2)
        expect(label.qr.size).toBe(20)
        expect(label.textLines).toEqual([])
      }
    }
  })

  it('shrinks the QR on a low label so it keeps a safety margin', () => {
    const plan = planLabelSheet(items(1), { ...DEFAULT_CALIBRATION, labelHeightMm: 18 }, 'qr-only', mm)
    expect(plan.qrSizeMm).toBe(16)
  })
})

describe('design B "QR + detalle"', () => {
  const full: LabelInput = { id: ID(1), name: 'Taza de cerámica azul', brand: 'Cerámica Sol', presentation: '350 ml', description: 'Apta para microondas y lavavajillas' }
  const label = (input: LabelInput, cal: LabelCalibration = DEFAULT_CALIBRATION, measure: TextMeasure = mm) =>
    planLabelSheet([input], cal, 'qr-detail', measure).labels[0]!

  it('puts a ~20 mm QR on the left, vertically centred, with ~40 mm of text to its right', () => {
    const plan = planLabelSheet([full], DEFAULT_CALIBRATION, 'qr-detail', mm)
    const planned = plan.labels[0]!
    expect(planned.qr.size).toBe(20)
    near(planned.qr.y + planned.qr.size / 2, planned.cell.y + planned.cell.h / 2)
    expect(planned.qr.x).toBeLessThan(planned.cell.x + planned.cell.w / 2 - planned.qr.size)
    expect(plan.textMaxWidthMm).toBe(DETAIL_TEXT_WIDTH_MM)
    for (const line of planned.textLines) {
      expect(line.x).toBeGreaterThanOrEqual(planned.qr.x + planned.qr.size)
      expect(line.x + plan.textMaxWidthMm).toBeLessThanOrEqual(planned.cell.x + planned.cell.w)
    }
  })

  it('orders name (bold), brand, presentation and description, with readable sizes', () => {
    const texts = label(full).textLines
    expect(texts.map((l) => l.text)).toEqual(['Taza de cerámica azul', 'Cerámica Sol', '350 ml', 'Apta para microondas y lavavajillas'])
    expect(texts[0]!.bold).toBe(true)
    expect(texts.slice(1).every((l) => !l.bold)).toBe(true)
    for (const line of texts) expect(line.fontPt).toBeGreaterThanOrEqual(6)
    expect(texts.map((l) => l.y)).toEqual([...texts.map((l) => l.y)].sort((a, b) => a - b))
  })

  it('never draws a price', () => {
    const texts = label({ ...full, price: 99 } as LabelInput).textLines.map((l) => l.text).join(' ')
    expect(texts).not.toMatch(/\$|99/)
  })

  it('omits empty fields without leaving gaps', () => {
    const only = label({ id: ID(1), name: 'Taza', presentation: '350 ml', brand: '  ', description: null }).textLines
    expect(only.map((l) => l.text)).toEqual(['Taza', '350 ml'])
    const pitch = only[1]!.y - only[0]!.y
    expect(pitch).toBeGreaterThan(0)
    expect(pitch).toBeLessThan(4)
    // A lone name is centred on the label.
    const nameOnly = label({ id: ID(1), name: 'Taza' })
    expect(nameOnly.textLines).toHaveLength(1)
    near(nameOnly.textLines[0]!.y + (7 * 1.15 * (25.4 / 72)) / 2, nameOnly.cell.y + nameOnly.cell.h / 2, 2)
  })

  it('treats emoji-only optional fields as empty', () => {
    expect(label({ id: ID(1), name: 'Taza', brand: '🌵', description: '日本語' }).textLines.map((l) => l.text)).toEqual(['Taza'])
  })

  it('wraps the name in 2 lines and truncates a long one with an ellipsis, within the width', () => {
    const long = 'Juego de vasos de vidrio templado resistente a golpes y cambios de temperatura extremos'
    const texts = label({ id: ID(1), name: long }).textLines.filter((l) => l.bold)
    expect(texts).toHaveLength(2)
    expect(texts[1]!.text.endsWith('…')).toBe(true)
    for (const line of texts) expect(mm(line.text, line.fontPt, line.bold)).toBeLessThanOrEqual(DETAIL_TEXT_WIDTH_MM)
  })

  it('truncates a long brand, presentation and description with an ellipsis, within the width', () => {
    const big = 'palabra '.repeat(40)
    const texts = label({ id: ID(1), name: 'Taza', brand: big, presentation: big, description: big }).textLines
    expect(texts.filter((l) => !l.bold)).toHaveLength(4) // brand 1 + presentation 1 + description 2
    expect(texts.filter((l) => l.fontPt === 6)).toHaveLength(2)
    expect(texts.at(-1)!.text.endsWith('…')).toBe(true)
    for (const line of texts) expect(mm(line.text, line.fontPt, line.bold)).toBeLessThanOrEqual(DETAIL_TEXT_WIDTH_MM)
  })

  it('breaks a single word wider than the text area instead of overflowing', () => {
    const texts = label({ id: ID(1), name: 'Supercalifragilisticoespialidosoextraordinarioyadicional1234567890' }).textLines
    for (const line of texts) expect(mm(line.text, line.fontPt, line.bold)).toBeLessThanOrEqual(DETAIL_TEXT_WIDTH_MM)
  })

  it('uses the width actually measured, not the character count', () => {
    const wide: TextMeasure = (text, pt) => (text.length * pt * 3) / 7
    for (const line of label(full, DEFAULT_CALIBRATION, wide).textLines) {
      expect(wide(line.text, line.fontPt, line.bold)).toBeLessThanOrEqual(DETAIL_TEXT_WIDTH_MM)
    }
    // Narrow letters fit more characters per line than wide ones.
    const narrow: TextMeasure = (text, pt) => (text.length * pt * 0.3) / 7
    expect(label({ id: ID(1), name: 'M'.repeat(30) }, DEFAULT_CALIBRATION, narrow).textLines[0]!.text).toHaveLength(30)
  })

  it('drops the description when the label is too low to fit it, and stays inside the label', () => {
    const low: LabelCalibration = { ...DEFAULT_CALIBRATION, labelHeightMm: 15, pitchYMm: 15 }
    const planned = label({ ...full, name: 'Taza de cerámica azul con asa grande y tapa de bambú' }, low)
    expect(planned.textLines.filter((l) => l.bold)).toHaveLength(2)
    expect(planned.textLines.map((l) => l.text)).not.toContain('Apta para microondas y lavavajillas')
    for (const line of planned.textLines) {
      expect(line.y).toBeGreaterThanOrEqual(planned.cell.y)
      expect(line.y).toBeLessThan(planned.cell.y + planned.cell.h)
    }
  })

  it('always keeps the name, even with no usable name ("Sin nombre")', () => {
    expect(label({ id: ID(1), name: '🌵' }).textLines[0]!.text).toBe('Sin nombre')
  })

  it('keeps the text to the right of the QR for calibrated sizes', () => {
    const planned = label(full, CALIBRATED)
    for (const line of planned.textLines) expect(line.x).toBeGreaterThanOrEqual(planned.qr.x + planned.qr.size)
  })
})

describe('normalizeCalibration', () => {
  it('returns the defaults for anything that is not an object of numbers', () => {
    expect(normalizeCalibration({})).toEqual(DEFAULT_CALIBRATION)
    expect(normalizeCalibration(null)).toEqual(DEFAULT_CALIBRATION)
    expect(normalizeCalibration('nope')).toEqual(DEFAULT_CALIBRATION)
    // The old A4 shape is ignored, never half-applied.
    expect(normalizeCalibration({ offsetTopMm: 5, rowPitchMm: 24.75 })).toEqual(DEFAULT_CALIBRATION)
  })

  it('keeps valid values', () => {
    expect(normalizeCalibration(CALIBRATED)).toEqual(CALIBRATED)
  })

  it('falls back to each default for NaN, Infinity, empty and non-numeric input', () => {
    expect(normalizeCalibration({ marginTopMm: Number.NaN, marginLeftMm: Infinity, labelWidthMm: '', labelHeightMm: 'abc', gapXMm: {}, pitchYMm: [] })).toEqual(DEFAULT_CALIBRATION)
  })

  it('accepts numeric text and rounds to 2 decimals', () => {
    expect(normalizeCalibration({ marginTopMm: '1.5', marginLeftMm: ' 0.333 ' })).toMatchObject({ marginTopMm: 1.5, marginLeftMm: 0.33 })
    expect(normalizeCalibration({ marginTopMm: 0.1 + 0.2 }).marginTopMm).toBe(0.3)
  })

  it('clamps every field to its range', () => {
    const high = normalizeCalibration(Object.fromEntries(CALIBRATION_KEYS.map((k) => [k, 999])))
    const low = normalizeCalibration(Object.fromEntries(CALIBRATION_KEYS.map((k) => [k, -999])))
    for (const key of CALIBRATION_KEYS) {
      expect(high[key]).toBe(CALIBRATION_LIMITS[key].max)
      expect(low[key]).toBe(CALIBRATION_LIMITS[key].min)
    }
  })

  it('recognises the default calibration and the valid designs', () => {
    expect(isDefaultCalibration(DEFAULT_CALIBRATION)).toBe(true)
    expect(isDefaultCalibration({ ...DEFAULT_CALIBRATION, gapXMm: 3.3 })).toBe(false)
    expect(isLabelDesign('qr-only')).toBe(true)
    expect(isLabelDesign('qr-detail')).toBe(true)
    expect(isLabelDesign('other')).toBe(false)
  })
})

describe('sanitizeLabelText (jsPDF core fonts are Latin-1 only)', () => {
  it.each([
    ['Bonsái Ficus Ginseng', 'Bonsái Ficus Ginseng'],
    ['Ñandú pequeño ü', 'Ñandú pequeño ü'],
    ['Maceta 🌵 grande', 'Maceta grande'],
    ['Largo…', 'Largo…'],
    ['  varios   espacios\ty\nsaltos ', 'varios espacios y saltos'],
    ['日本語', ''],
    ['', ''],
  ])('%j -> %j', (input, expected) => {
    expect(sanitizeLabelText(input)).toBe(expected)
  })
})

describe('wrapText', () => {
  const face = { fontPt: 7, bold: false }

  it('returns nothing for empty text and keeps a short one on one line', () => {
    expect(wrapText('', 30, mm, face, 2)).toEqual([])
    expect(wrapText('Taza', 30, mm, face, 2)).toEqual(['Taza'])
  })

  it('wraps at word boundaries and ends the last line with an ellipsis when text is left over', () => {
    expect(wrapText('uno dos tres cuatro', 8, mm, face, 3)).toEqual(['uno dos', 'tres', 'cuatro'])
    const out = wrapText('uno dos tres cuatro cinco seis', 8, mm, face, 2)
    expect(out).toHaveLength(2)
    expect(out[1]!.endsWith('…')).toBe(true)
    for (const line of out) expect(mm(line, 7, false)).toBeLessThanOrEqual(8)
  })
})

describe('labelSheetFileName', () => {
  it('uses the LOCAL date', () => {
    expect(labelSheetFileName(new Date(2026, 0, 5))).toBe('etiquetas-qr-20260105.pdf')
  })
})
