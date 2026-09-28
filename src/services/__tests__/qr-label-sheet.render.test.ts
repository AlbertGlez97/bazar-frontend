import { describe, expect, it } from 'vitest'
import { generateQrLabelSheet } from '../qr-label-sheet'
import { DEFAULT_CALIBRATION } from '@/utils/label-sheet-plan'

// Render REAL con jsPDF (sin mocks): comprueba que el plan es válido para jsPDF,
// que las imágenes PNG se aceptan y que sale un PDF con el número de hojas esperado.
const ID = (n: number) => `01a0ddd7-7f00-744a-8b23-${String(n).padStart(12, '0')}`
const items = (count: number) => Array.from({ length: count }, (_, i) => ({ id: ID(i), name: `Bonsái número ${i} de La Marchanta` }))

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

describe('generateQrLabelSheet (real jsPDF)', () => {
  it('produces a real PDF with one page for up to 72 labels', async () => {
    const sheet = await generateQrLabelSheet(items(5), DEFAULT_CALIBRATION)
    expect(sheet.doc.getNumberOfPages()).toBe(1)
    expect(sheet.blob.type).toBe('application/pdf')
    const bytes = await readBytes(sheet.blob)
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    expect(bytes.length).toBeGreaterThan(3000)
  }, 60_000)

  it('is A4 portrait: 210 x 297 mm', async () => {
    const { doc } = await generateQrLabelSheet(items(1), DEFAULT_CALIBRATION)
    // jsPDF define A4 como 595.28 x 841.89 pt: 210.0016 mm. Un error de 2 micras no importa al imprimir.
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(210, 2)
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(297, 2)
  }, 60_000)

  it.each([[72, 1], [73, 2], [144, 2], [145, 3]])('%i labels -> %i page(s)', async (n, pages) => {
    const sheet = await generateQrLabelSheet(items(n), DEFAULT_CALIBRATION)
    expect(sheet.doc.getNumberOfPages()).toBe(pages)
  }, 120_000)

  it('the same id repeated many times does not grow the file per copy (one embedded image)', async () => {
    const one = { id: ID(1), name: 'Igual' }
    const few = await generateQrLabelSheet(Array.from({ length: 2 }, () => one), DEFAULT_CALIBRATION)
    const many = await generateQrLabelSheet(Array.from({ length: 70 }, () => one), DEFAULT_CALIBRATION)
    const fewSize = (await readBytes(few.blob)).length
    const manySize = (await readBytes(many.blob)).length
    // 68 more labels add text and one image reference each, not a whole PNG each.
    expect(manySize - fewSize).toBeLessThan(fewSize * 4)
  }, 120_000)

  // Regresión del tamaño: 80 etiquetas únicas daban un PDF de 37,656,340 bytes (píxeles sin comprimir).
  // Estos topes fallan con ese comportamiento y dejan mucho margen al real (~100 kB por hoja).
  const MB = 1024 * 1024

  it('a full sheet of 72 UNIQUE labels is a small PDF (well under 2 MB)', async () => {
    const sheet = await generateQrLabelSheet(items(72), DEFAULT_CALIBRATION)
    expect(sheet.blob.size).toBeLessThan(2 * MB)
    expect(sheet.blob.size).toBeLessThan(300 * 1024)
  }, 120_000)

  it('the size grows roughly linearly: 144 unique labels stay far below 4 MB and about twice 72', async () => {
    const one = (await generateQrLabelSheet(items(72), DEFAULT_CALIBRATION)).blob.size
    const two = (await generateQrLabelSheet(items(144), DEFAULT_CALIBRATION)).blob.size
    expect(two).toBeLessThan(4 * MB)
    expect(two).toBeLessThan(one * 2.5)
    expect(two).toBeGreaterThan(one * 1.5)
  }, 240_000)

  it('accepts names outside Latin-1 (emoji, CJK) without failing', async () => {
    const sheet = await generateQrLabelSheet([{ id: ID(1), name: '🌵 日本語 Cactus' }, { id: ID(2), name: '' }], DEFAULT_CALIBRATION)
    expect(sheet.doc.getNumberOfPages()).toBe(1)
  }, 60_000)
})
