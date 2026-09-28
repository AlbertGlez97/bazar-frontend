// @vitest-environment node
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { decode } from 'fast-png'
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'
import { LABEL_QR_QUIET_ZONE, LABEL_QR_SCALE, generateQrLabelSheet } from '../qr-label-sheet'
import { DEFAULT_CALIBRATION } from '@/utils/label-sheet-plan'

// Prueba de compatibilidad sobre el raster que REALMENTE queda dentro del PDF (ya comprimido por
// jsPDF), no sobre lo que devuelve el codificador: se sacan las imágenes del archivo, se
// reconstruye un PNG con los mismos bytes (el stream de jsPDF usa predictores PNG, así que es
// exactamente un IDAT) y se lee con zxing, el motor del escáner de venta.

const ID = (n: number) => `01a0ddd7-7f00-744a-8b23-${String(n).padStart(12, '0')}`
const MODULES = 29 + 2 * LABEL_QR_QUIET_ZONE
const SIDE = MODULES * LABEL_QR_SCALE

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type: string, data: Uint8Array): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), Buffer.from(data)])
  const out = Buffer.alloc(8 + data.length + 4)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), 8 + data.length)
  return out
}

interface EmbeddedImage { width: number; height: number; colors: number; png: Buffer; streamBytes: number }

/** Todas las imágenes del PDF, cada una como un PNG válido hecho con sus bytes tal cual están en el archivo. */
function extractImages(pdf: Buffer): EmbeddedImage[] {
  const text = pdf.toString('latin1') // 1 carácter = 1 byte: los índices coinciden con los del Buffer
  const found: EmbeddedImage[] = []
  const dictionary = /<<(?:(?!>>\s*stream)[\s\S])*?\/Subtype\s*\/Image[\s\S]*?>>\s*stream\r?\n/g
  for (const match of text.matchAll(dictionary)) {
    const dict = match[0]
    const number = (key: string) => Number(new RegExp(`/${key}\\s+(\\d+)`).exec(dict)?.[1])
    const width = number('Width')
    const height = number('Height')
    const length = number('Length')
    const colors = number('Colors')
    expect(dict).toContain('/FlateDecode') // nunca sin comprimir
    const start = match.index! + dict.length
    const stream = pdf.subarray(start, start + length)
    const ihdr = Buffer.alloc(13)
    ihdr.writeUInt32BE(width, 0)
    ihdr.writeUInt32BE(height, 4)
    ihdr[8] = 8
    ihdr[9] = colors === 1 ? 0 : 2
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr), chunk('IDAT', stream), chunk('IEND', new Uint8Array()),
    ])
    found.push({ width, height, colors, png, streamBytes: length })
  }
  return found
}

async function pdfOf(products: { id: string; name: string }[]): Promise<Buffer> {
  const sheet = await generateQrLabelSheet(products, DEFAULT_CALIBRATION)
  return Buffer.from(await sheet.blob.arrayBuffer())
}

beforeAll(async () => {
  const wasmBinary = readFileSync(new URL('../../../node_modules/zxing-wasm/dist/reader/zxing_reader.wasm', import.meta.url))
  await prepareZXingModule({ overrides: { wasmBinary }, fireImmediately: true })
})

const decodeText = async (png: Buffer) =>
  (await readBarcodes(new Uint8Array(png), { formats: ['QRCode'], tryHarder: true })).map((r) => r.text)

describe('QR images embedded in the label sheet PDF', () => {
  it('every embedded image decodes EXACTLY to its product id (round trip on the compressed raster)', async () => {
    const ids = [ID(1), ID(2), ID(3), 'ffffffff-ffff-7fff-bfff-ffffffffffff', '00000000-0000-7000-8000-000000000000', ID(99)]
    const images = extractImages(await pdfOf(ids.map((id, i) => ({ id, name: `Producto ${i}` }))))
    expect(images).toHaveLength(ids.length)
    const decoded = await Promise.all(images.map((image) => decodeText(image.png)))
    expect(decoded.map((d) => d[0]).sort()).toEqual([...ids].sort())
    for (const texts of decoded) expect(texts).toHaveLength(1)
  }, 120_000)

  it('the raster is (modules + quiet zone) x integer scale on each side', async () => {
    const [image] = extractImages(await pdfOf([{ id: ID(1), name: 'Taza' }]))
    expect(image!.width).toBe(SIDE)
    expect(image!.height).toBe(SIDE)
  }, 60_000)

  it('stays crisp: only pure black and white, and every module is a uniform block of whole pixels', async () => {
    const [image] = extractImages(await pdfOf([{ id: ID(7), name: 'Taza' }]))
    const raster = decode(new Uint8Array(image!.png))
    const channels = raster.channels
    const values = new Set<number>()
    for (let y = 0; y < SIDE; y += 1) {
      for (let x = 0; x < SIDE; x += 1) {
        const at = (y * SIDE + x) * channels
        // Cada píxel de un módulo es igual al primero de su bloque LABEL_QR_SCALE x LABEL_QR_SCALE.
        const originAt = (Math.floor(y / LABEL_QR_SCALE) * LABEL_QR_SCALE * SIDE + Math.floor(x / LABEL_QR_SCALE) * LABEL_QR_SCALE) * channels
        for (let c = 0; c < channels; c += 1) {
          values.add(raster.data[at + c]!)
          expect(raster.data[at + c]).toBe(raster.data[originAt + c])
        }
      }
    }
    expect([...values].sort((a, b) => a - b)).toEqual([0, 255])
  }, 60_000)

  it('keeps the quiet zone white on every side', async () => {
    const [image] = extractImages(await pdfOf([{ id: ID(8), name: 'Taza' }]))
    const raster = decode(new Uint8Array(image!.png))
    const zone = LABEL_QR_QUIET_ZONE * LABEL_QR_SCALE
    for (let i = 0; i < SIDE; i += 1) {
      for (let depth = 0; depth < zone; depth += 1) {
        for (const [x, y] of [[i, depth], [i, SIDE - 1 - depth], [depth, i], [SIDE - 1 - depth, i]] as const) {
          expect(raster.data[(y * SIDE + x) * raster.channels]).toBe(255)
        }
      }
    }
  }, 60_000)

  it('a repeated id is embedded ONCE (alias reuse) and each image is small', async () => {
    const products = [{ id: ID(1), name: 'A' }, { id: ID(2), name: 'B' }, { id: ID(1), name: 'A' }, { id: ID(1), name: 'A' }]
    const images = extractImages(await pdfOf(products))
    expect(images).toHaveLength(2)
    for (const image of images) expect(image.streamBytes).toBeLessThan(3 * 1024) // ~1.3 kB medido; 470 kB sin comprimir
  }, 60_000)

  it('the embedded images of a whole 72-label sheet weigh far less than 100 kB in total', async () => {
    const products = Array.from({ length: 72 }, (_, i) => ({ id: ID(i), name: `Producto ${i}` }))
    const images = extractImages(await pdfOf(products))
    expect(images).toHaveLength(72)
    const total = images.reduce((sum, image) => sum + image.streamBytes, 0)
    expect(total).toBeLessThan(100 * 1024)
  }, 120_000)
})
