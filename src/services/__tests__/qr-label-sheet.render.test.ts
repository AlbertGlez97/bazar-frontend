import { describe, expect, it } from 'vitest'
import QRCode from 'qrcode'
import { LABEL_QR_QUIET_ZONE, LABEL_QR_SCALE, generateQrLabelSheet } from '../qr-label-sheet'
import { DEFAULT_CALIBRATION, DETAIL_TEXT_WIDTH_MM, QR_TARGET_MM, type LabelDesign, type LabelInput } from '@/utils/label-sheet-plan'
import { QR_ERROR_CORRECTION } from '@/utils/product-qr'

// Render REAL con jsPDF (sin mocks): comprueba que el plan es válido para jsPDF,
// que las imágenes PNG se aceptan y que sale un PDF con el número de hojas esperado.
const ID = (n: number) => `01a0ddd7-7f00-744a-8b23-${String(n).padStart(12, '0')}`
const items = (count: number): LabelInput[] => Array.from({ length: count }, (_, i) => ({ id: ID(i), name: `Bonsái número ${i} de La Marchanta` }))

async function readBytes(blob: Blob): Promise<Uint8Array> {
  // jsdom no implementa Blob.arrayBuffer(): se lee con FileReader.
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
  return new Uint8Array(buffer)
}

describe.each(['qr-only', 'qr-detail'] as LabelDesign[])('generateQrLabelSheet (real jsPDF, %s)', (design) => {
  it('produces a real PDF with one page for up to 30 labels', async () => {
    const sheet = await generateQrLabelSheet(items(5), DEFAULT_CALIBRATION, design)
    expect(sheet.doc.getNumberOfPages()).toBe(1)
    expect(sheet.blob.type).toBe('application/pdf')
    const bytes = await readBytes(sheet.blob)
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    expect(bytes.length).toBeGreaterThan(3000)
  }, 60_000)

  it('is Letter portrait: 215.9 x 279.4 mm', async () => {
    const { doc } = await generateQrLabelSheet(items(1), DEFAULT_CALIBRATION, design)
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(215.9, 2)
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(279.4, 2)
  }, 60_000)

  it.each([[30, 1], [31, 2], [60, 2], [61, 3]])('%i labels -> %i page(s), every page Letter', async (n, pages) => {
    const sheet = await generateQrLabelSheet(items(n), DEFAULT_CALIBRATION, design)
    expect(sheet.doc.getNumberOfPages()).toBe(pages)
    expect(sheet.doc.internal.pageSize.getHeight()).toBeCloseTo(279.4, 2)
  }, 120_000)

  it('the same id repeated many times does not grow the file per copy (one embedded image)', async () => {
    const one = { id: ID(1), name: 'Igual' }
    const few = await generateQrLabelSheet(Array.from({ length: 2 }, () => one), DEFAULT_CALIBRATION, design)
    const many = await generateQrLabelSheet(Array.from({ length: 30 }, () => one), DEFAULT_CALIBRATION, design)
    const fewSize = (await readBytes(few.blob)).length
    const manySize = (await readBytes(many.blob)).length
    // 28 more labels add text and one image reference each, not a whole PNG each.
    expect(manySize - fewSize).toBeLessThan(fewSize * 4)
  }, 120_000)

  // Regresión del tamaño: 80 etiquetas únicas daban un PDF de 37,656,340 bytes (píxeles sin comprimir).
  const MB = 1024 * 1024

  it('a full sheet of 30 UNIQUE labels is a small PDF (well under 2 MB)', async () => {
    const sheet = await generateQrLabelSheet(items(30), DEFAULT_CALIBRATION, design)
    expect(sheet.blob.size).toBeLessThan(2 * MB)
    expect(sheet.blob.size).toBeLessThan(200 * 1024)
  }, 120_000)

  it('accepts text outside Latin-1 (emoji, CJK) without failing', async () => {
    const sheet = await generateQrLabelSheet(
      [{ id: ID(1), name: '🌵 日本語 Cactus', brand: '🌵', description: '日本語' }, { id: ID(2), name: '' }],
      DEFAULT_CALIBRATION,
      design,
    )
    expect(sheet.doc.getNumberOfPages()).toBe(1)
  }, 60_000)
})

describe('design B measured with the real jsPDF font', () => {
  const product: LabelInput = {
    id: ID(1),
    name: 'Juego de vasos de vidrio templado resistente a golpes, cambios de temperatura y lavavajillas industriales',
    brand: 'Cristalería Artesanal de Occidente Sociedad Anónima',
    presentation: 'Caja con 12 piezas de 350 mililitros cada una',
    description: 'Vasos ideales para jugos, refrescos y bebidas calientes; apilables, ligeros y muy resistentes al uso diario en el hogar o el negocio.',
  }

  it('no line is wider than the 40 mm usable width, and long text ends with an ellipsis', async () => {
    const { doc, plan } = await generateQrLabelSheet([product], DEFAULT_CALIBRATION, 'qr-detail')
    const lines = plan.labels[0]!.textLines
    expect(lines.length).toBeGreaterThan(3)
    for (const line of lines) {
      doc.setFont('helvetica', line.bold ? 'bold' : 'normal')
      doc.setFontSize(line.fontPt)
      expect(doc.getTextWidth(line.text)).toBeLessThanOrEqual(DETAIL_TEXT_WIDTH_MM)
    }
    expect(lines.filter((l) => l.bold).at(-1)!.text.endsWith('…')).toBe(true)
    expect(lines.at(-1)!.text.endsWith('…')).toBe(true)
  }, 60_000)

  it('keeps accents and ñ in the text', async () => {
    const { plan } = await generateQrLabelSheet([{ id: ID(1), name: 'Niño año', brand: 'Pequeño Ñandú' }], DEFAULT_CALIBRATION, 'qr-detail')
    expect(plan.labels[0]!.textLines.map((l) => l.text)).toEqual(['Niño año', 'Pequeño Ñandú'])
  }, 60_000)
})

describe('QR quality at the printed size', () => {
  it('a product UUID makes a 29-module QR (ECC M); with the quiet zone each module is >= 0.5 mm at 20 mm', () => {
    const modules = QRCode.create(ID(1), { errorCorrectionLevel: QR_ERROR_CORRECTION }).modules.size
    expect(modules).toBe(29)
    const withQuietZone = modules + 2 * LABEL_QR_QUIET_ZONE
    const moduleMm = QR_TARGET_MM / withQuietZone
    expect(moduleMm).toBeGreaterThanOrEqual(0.5)
    // Whole pixels per module and >= 300 dpi at the printed size.
    expect(Number.isInteger(LABEL_QR_SCALE)).toBe(true)
    expect((withQuietZone * LABEL_QR_SCALE) / (QR_TARGET_MM / 25.4)).toBeGreaterThanOrEqual(300)
  })
})
