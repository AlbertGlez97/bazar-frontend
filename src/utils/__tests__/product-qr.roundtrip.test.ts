// @vitest-environment node
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'
import { productQrDataUrl } from '../product-qr'
import { LABEL_QR_QUIET_ZONE, LABEL_QR_SCALE } from '@/services/qr-label-sheet'
import { useSaleCatalogStore } from '@/stores/sale-catalog.store'
import ProductsService from '@/services/products.service'
import type { Product } from '@/types/product.types'

vi.mock('@/services/products.service', () => ({ default: { listProducts: vi.fn() } }))

// Compatibilidad generación <-> lectura: el PNG que se descarga (y el que va en
// la hoja de etiquetas) se decodifica con el MISMO motor que usa el escáner de
// venta (zxing, vía barcode-detector) y el texto leído tiene que resolver a un
// producto con `findByScannedText`.

const ID = '01a0ddd7-7f00-744a-8b23-72c005912b97'
const OTHER_ID = '0190a5f0-7c3e-7000-8000-00000000000a'

function product(id: string, name: string): Product {
  return {
    id, name, tipo: 'cantidad', unitPriceMinor: 1999, initialStock: 3, stock: 3, category: null,
    purchaseCostMinor: null, supplier: null, notes: null, createdAt: '2026-09-01T00:00:00.000Z', active: true, image: null,
  }
}

async function decodeText(dataUrl: string): Promise<string[]> {
  const bytes = Uint8Array.from(Buffer.from(dataUrl.split(',')[1]!, 'base64'))
  const results = await readBarcodes(bytes, { formats: ['QRCode'], tryHarder: true })
  return results.map((r) => r.text)
}

beforeAll(async () => {
  // En Node el wasm no se puede pedir por URL: se le entrega el binario del paquete.
  const wasmBinary = readFileSync(new URL('../../../node_modules/zxing-wasm/dist/reader/zxing_reader.wasm', import.meta.url))
  await prepareZXingModule({ overrides: { wasmBinary }, fireImmediately: true })
})

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(ProductsService.listProducts).mockReset()
})

describe('QR round trip with the scanner engine', () => {
  it.each([
    ['screen / PNG download (scale 10, quiet zone 4)', {}],
    // Los ajustes REALES con los que la hoja de etiquetas incrusta cada QR en el PDF.
    [`label sheet (scale ${LABEL_QR_SCALE}, quiet zone ${LABEL_QR_QUIET_ZONE})`, { scale: LABEL_QR_SCALE, quietZone: LABEL_QR_QUIET_ZONE }],
    ['small scale (4, quiet zone 2)', { scale: 4, quietZone: 2 }],
  ])('decodes EXACTLY the product id: %s', async (_label, options) => {
    const text = await decodeText(await productQrDataUrl(ID, options))
    expect(text).toEqual([ID])
  })

  it('decodes a range of real-looking UUIDv7 ids exactly', async () => {
    const ids = [
      '01a0ddd7-7f00-744a-8b23-72c005912b97',
      '01a0ddd7-7fb0-752d-8a6d-8348d9a9a063',
      '01a0dbab-59f6-7145-a351-1f07c08e8b93',
      'ffffffff-ffff-7fff-bfff-ffffffffffff',
      '00000000-0000-7000-8000-000000000000',
    ]
    for (const id of ids) {
      expect(await decodeText(await productQrDataUrl(id, { scale: LABEL_QR_SCALE, quietZone: LABEL_QR_QUIET_ZONE }))).toEqual([id])
    }
  })

  it('what the reader decodes resolves to that product through findByScannedText', async () => {
    vi.mocked(ProductsService.listProducts).mockResolvedValue({
      items: [product(OTHER_ID, 'Otro'), product(ID, 'Bonsái Ficus')], total: 2, page: 1, limit: 100,
    })
    const catalog = useSaleCatalogStore()
    await catalog.load()

    const [text] = await decodeText(await productQrDataUrl(ID))
    expect(catalog.findByScannedText(text!)?.id).toBe(ID)
    expect(catalog.findByScannedText(text!)?.name).toBe('Bonsái Ficus')

    const [otherText] = await decodeText(await productQrDataUrl(OTHER_ID))
    expect(catalog.findByScannedText(otherText!)?.id).toBe(OTHER_ID)
  })

  it('encodes nothing else: no prefix, no URL, no newline', async () => {
    const [text] = await decodeText(await productQrDataUrl(ID))
    expect(text).toBe(ID)
    expect(text).toHaveLength(36)
    expect(text).not.toMatch(/\s|:\/\//)
  })
})
