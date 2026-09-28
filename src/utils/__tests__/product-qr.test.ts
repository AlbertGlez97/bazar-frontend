import { describe, expect, it } from 'vitest'
import { decode } from 'fast-png'
import {
  DEFAULT_QR_SCALE,
  QR_QUIET_ZONE_MODULES,
  dataUrlToBlob,
  isProductId,
  productQrBlob,
  productQrDataUrl,
  productQrFileName,
} from '../product-qr'
import source from '../product-qr.ts?raw'

const ID = '01a0ddd7-7f00-744a-8b23-72c005912b97'
/** Un UUID de 36 caracteres en byte mode cabe en la versión 3: 29 x 29 módulos. */
const MODULES = 29

function pngBytes(dataUrl: string): Uint8Array {
  return Uint8Array.from(atob(dataUrl.split(',')[1]!), (c) => c.charCodeAt(0))
}

describe('isProductId', () => {
  it.each([
    ID,
    '0190A5F0-7C3E-7000-8000-00000000000A',
    '11111111-2222-4333-8444-555555555555',
  ])('accepts a UUID: %s', (value) => {
    expect(isProductId(value)).toBe(true)
  })

  it.each([
    '', 'p-1', 'abc', ID + '\n', ' ' + ID, ID + 'x', ID.slice(1), ID.replace(/-/g, ''),
    'zzzzzzzz-7f00-744a-8b23-72c005912b97', 42, null, undefined, {}, [ID],
  ])('rejects %j', (value) => {
    expect(isProductId(value)).toBe(false)
  })
})

describe('productQrDataUrl', () => {
  it('returns a PNG data URL', async () => {
    const url = await productQrDataUrl(ID)
    expect(url.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('is deterministic: the same id gives the same image every time (nothing is stored)', async () => {
    expect(await productQrDataUrl(ID)).toBe(await productQrDataUrl(ID))
  })

  it('gives a different image for a different id', async () => {
    expect(await productQrDataUrl(ID)).not.toBe(await productQrDataUrl('0190a5f0-7c3e-7000-8000-00000000000a'))
  })

  it.each(['', 'p-1', ID + '\n', 42 as unknown as string, null as unknown as string])(
    'rejects an invalid id (%j) instead of drawing a code the scanner could not match',
    async (bad) => {
      await expect(productQrDataUrl(bad)).rejects.toThrow(/id/i)
    },
  )

  it('has exactly (modules + 2 x quiet zone) x scale pixels per side, an integer scale', async () => {
    const image = decode(pngBytes(await productQrDataUrl(ID)))
    const side = (MODULES + 2 * QR_QUIET_ZONE_MODULES) * DEFAULT_QR_SCALE
    expect(image.width).toBe(side)
    expect(image.height).toBe(side)
  })

  it('honours a custom scale and quiet zone', async () => {
    const image = decode(pngBytes(await productQrDataUrl(ID, { scale: 12, quietZone: 2 })))
    expect(image.width).toBe((MODULES + 2 * 2) * 12)
  })

  it('leaves a white quiet zone on every side and starts the code with a dark finder module', async () => {
    const image = decode(pngBytes(await productQrDataUrl(ID)))
    const zone = QR_QUIET_ZONE_MODULES * DEFAULT_QR_SCALE
    const channels = image.channels
    const isWhite = (x: number, y: number) => {
      const at = (y * image.width + x) * channels
      return image.data[at] === 255 && image.data[at + 1] === 255 && image.data[at + 2] === 255
    }
    for (let i = 0; i < image.width; i += 7) {
      for (let depth = 0; depth < zone; depth += 5) {
        expect(isWhite(i, depth)).toBe(true) // top
        expect(isWhite(i, image.height - 1 - depth)).toBe(true) // bottom
        expect(isWhite(depth, i)).toBe(true) // left
        expect(isWhite(image.width - 1 - depth, i)).toBe(true) // right
      }
    }
    // The first module of a QR code (top-left finder pattern) is always dark.
    expect(isWhite(zone + 1, zone + 1)).toBe(false)
  })
})

describe('dataUrlToBlob / productQrBlob', () => {
  it('turns the data URL into a PNG Blob with the same bytes', async () => {
    const url = await productQrDataUrl(ID)
    const blob = dataUrlToBlob(url)
    expect(blob.type).toBe('image/png')
    expect(blob.size).toBe(pngBytes(url).length)
  })

  it('productQrBlob is a PNG Blob', async () => {
    const blob = await productQrBlob(ID)
    expect(blob.type).toBe('image/png')
    expect(blob.size).toBeGreaterThan(200)
  })

  it('rejects something that is not a data URL', () => {
    expect(() => dataUrlToBlob('https://example.com/x.png')).toThrow(/data URL/i)
  })
})

describe('productQrFileName', () => {
  it.each([
    ['Taza de barro', ID, 'qr-taza-de-barro-01a0ddd7.png'],
    ['Bonsái Ficus Ginseng', ID, 'qr-bonsai-ficus-ginseng-01a0ddd7.png'],
    ['  Maceta   #5 (grande)!  ', ID, 'qr-maceta-5-grande-01a0ddd7.png'],
    ['Ñandú', ID, 'qr-nandu-01a0ddd7.png'],
    ['', ID, 'qr-producto-01a0ddd7.png'],
    ['???', ID, 'qr-producto-01a0ddd7.png'],
  ])('%j -> %s', (name, id, expected) => {
    expect(productQrFileName(name, id)).toBe(expected)
  })

  it('caps the name part so the file name stays short', () => {
    const name = productQrFileName('a'.repeat(200), ID)
    expect(name.length).toBeLessThanOrEqual('qr-'.length + 40 + '-01a0ddd7.png'.length)
    expect(name.endsWith('-01a0ddd7.png')).toBe(true)
  })
})

describe('lazy loading', () => {
  it('never imports the QR library at the top level (only through import())', () => {
    expect(source).not.toMatch(/^\s*import\s[^;]*from\s+['"]qrcode['"]/m)
    expect(source).toMatch(/import\(\s*['"]qrcode['"]\s*\)/)
  })
})
