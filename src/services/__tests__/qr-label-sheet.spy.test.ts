import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateQrLabelSheet } from '../qr-label-sheet'
import { NAME_FONT_PT, planLabelSheet } from '@/utils/label-sheet-plan'
import source from '../qr-label-sheet.ts?raw'

// jsPDF sustituido por un doble que anota cada llamada: así se comprueba que el
// renderer dibuja EXACTAMENTE lo que el plan dice (mm, alias, saltos de página).
const calls = vi.hoisted(() => ({
  ctor: [] as unknown[],
  addImage: [] as unknown[][],
  text: [] as unknown[][],
  addPage: [] as unknown[][],
  order: [] as string[],
  loads: 0,
}))

vi.mock('jspdf', () => {
  calls.loads += 1
  class FakeJsPdf {
    constructor(options: unknown) { calls.ctor.push(options) }
    setFont() { return this }
    setFontSize() { return this }
    setProperties() { return this }
    getTextWidth(text: string) { return text.length * 0.9 }
    addImage(...args: unknown[]) { calls.addImage.push(args); calls.order.push('image'); return this }
    text(...args: unknown[]) { calls.text.push(args); calls.order.push('text'); return this }
    addPage(...args: unknown[]) { calls.addPage.push(args); calls.order.push('page'); return this }
    getNumberOfPages() { return calls.addPage.length + 1 }
    output() { return new Blob(['%PDF-fake'], { type: 'application/pdf' }) }
  }
  return { jsPDF: FakeJsPdf }
})

const qrCalls = vi.hoisted(() => [] as { id: string; options: unknown }[])
vi.mock('@/utils/product-qr', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/utils/product-qr')>()
  return {
    ...original,
    productQrDataUrl: vi.fn(async (id: string, options: unknown) => {
      qrCalls.push({ id, options })
      return `data:image/png;base64,FAKE-${id}`
    }),
  }
})

const ID = (n: number) => `01a0ddd7-7f00-744a-8b23-${String(n).padStart(12, '0')}`
const items = (count: number) => Array.from({ length: count }, (_, i) => ({ id: ID(i), name: `Taza ${i}` }))
const cal = { offsetTopMm: 1.5, offsetLeftMm: -0.8, rowPitchMm: 24.75 }

beforeEach(() => {
  calls.ctor.length = 0
  calls.addImage.length = 0
  calls.text.length = 0
  calls.addPage.length = 0
  calls.order.length = 0
  qrCalls.length = 0
})

describe('generateQrLabelSheet (jsPDF spy)', () => {
  it('creates a portrait A4 document in millimetres', async () => {
    await generateQrLabelSheet(items(1), cal)
    expect(calls.ctor).toHaveLength(1)
    expect(calls.ctor[0]).toMatchObject({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  })

  it('places every QR at the planned mm coordinates and size, as a PNG', async () => {
    const products = items(10)
    const plan = planLabelSheet(products, cal, (t) => t.length * 0.9)
    await generateQrLabelSheet(products, cal)
    expect(calls.addImage).toHaveLength(10)
    plan.labels.forEach((label, i) => {
      const [data, format, x, y, w, h] = calls.addImage[i]!
      expect(data).toBe(`data:image/png;base64,FAKE-${label.id}`)
      expect(format).toBe('PNG')
      expect([x, y, w, h]).toEqual([label.qr.x, label.qr.y, label.qr.size, label.qr.size])
    })
  })

  it('writes the name lines at the planned coordinates, centred, anchored at their top edge', async () => {
    const products = items(3)
    const plan = planLabelSheet(products, cal, (t) => t.length * 0.9)
    await generateQrLabelSheet(products, cal)
    const expected = plan.labels.flatMap((l) => l.textLines)
    expect(calls.text).toHaveLength(expected.length)
    expected.forEach((line, i) => {
      const [text, x, y, options] = calls.text[i]!
      expect([text, x, y]).toEqual([line.text, line.x, line.y])
      expect(options).toMatchObject({ align: 'center', baseline: 'top' })
    })
  })

  it('adds a page after the 72nd label and continues there (73 labels -> 1 addPage before the 73rd)', async () => {
    const sheet = await generateQrLabelSheet(items(73), cal)
    expect(calls.addPage).toHaveLength(1)
    expect(sheet.plan.pages).toBe(2)
    const firstImageOfPage2 = calls.order.indexOf('page')
    const imagesBefore = calls.order.slice(0, firstImageOfPage2).filter((o) => o === 'image').length
    expect(imagesBefore).toBe(72)
    // The 73rd label uses the coordinates of cell (0, 0) of the new page.
    const [, , x, y] = calls.addImage[72]!
    expect([x, y]).toEqual([calls.addImage[0]![2], calls.addImage[0]![3]])
  })

  it('144 labels -> exactly 2 pages, 145 -> 3', async () => {
    expect((await generateQrLabelSheet(items(144), cal)).plan.pages).toBe(2)
    expect(calls.addPage).toHaveLength(1)
    calls.addPage.length = 0
    expect((await generateQrLabelSheet(items(145), cal)).plan.pages).toBe(3)
    expect(calls.addPage).toHaveLength(2)
  })

  it('renders each QR at a high, integer pixel scale with a quiet zone of at least 2 modules', async () => {
    await generateQrLabelSheet(items(1), cal)
    const options = qrCalls[0]!.options as { scale: number; quietZone: number }
    expect(Number.isInteger(options.scale)).toBe(true)
    expect(options.quietZone).toBeGreaterThanOrEqual(2)
    // >= 300 dpi at the printed size: modules (29 + 2 x quiet zone) x scale pixels over 16.35 mm.
    const pixels = (29 + 2 * options.quietZone) * options.scale
    expect(pixels / (16.35 / 25.4)).toBeGreaterThanOrEqual(300)
  })

  it('generates one QR per UNIQUE id and reuses the same image alias for repeated ids', async () => {
    const repeated = [{ id: ID(1), name: 'A' }, { id: ID(2), name: 'B' }, { id: ID(1), name: 'A' }, { id: ID(1), name: 'A' }]
    await generateQrLabelSheet(repeated, cal)
    expect(qrCalls.map((c) => c.id)).toEqual([ID(1), ID(2)])
    const aliases = calls.addImage.map((args) => args[6])
    expect(aliases).toEqual([ID(1), ID(2), ID(1), ID(1)])
  })

  it('returns the plan, the document and a PDF blob', async () => {
    const sheet = await generateQrLabelSheet(items(2), cal)
    expect(sheet.plan.labels).toHaveLength(2)
    expect(sheet.blob.type).toBe('application/pdf')
    expect(NAME_FONT_PT).toBe(6)
  })

  it('refuses an empty selection and an invalid id before drawing anything', async () => {
    await expect(generateQrLabelSheet([], cal)).rejects.toThrow(/product/i)
    await expect(generateQrLabelSheet([{ id: 'p-1', name: 'X' }], cal)).rejects.toThrow(/id/i)
    expect(calls.addImage).toHaveLength(0)
  })
})

describe('lazy loading', () => {
  it('imports jsPDF only through import(), never at the top level', () => {
    expect(source).not.toMatch(/^\s*import\s[^;]*from\s+['"]jspdf['"]/m)
    expect(source).toMatch(/import\(\s*['"]jspdf['"]\s*\)/)
  })
})
