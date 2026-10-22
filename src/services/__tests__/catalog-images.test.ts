import { describe, expect, it, vi } from 'vitest'
import {
  IMAGE_CONCURRENCY,
  JPEG_QUALITY,
  PHOTO_QUALITY,
  PLACEHOLDER_LABEL,
  fitWithin,
  makePlaceholder,
  mapWithConcurrency,
  processCatalogImages,
  reduceImage,
  type DecodedImage,
  type RasterEnv,
} from '../catalog-images'

/** Entorno de dibujo simulado: anota cada llamada para comprobar el orden y las medidas. */
function fakeEnv(source: { width: number; height: number } = { width: 3000, height: 1500 }) {
  const log = { canvases: [] as { width: number; height: number; ops: string[]; quality?: number; disposed: boolean }[], closed: 0, decoded: 0 }
  const env: RasterEnv = {
    async decode() {
      log.decoded += 1
      const image: DecodedImage = { ...source, source: 'bitmap', close: () => { log.closed += 1 } }
      return image
    },
    createCanvas(width, height) {
      const canvas = { width, height, ops: [] as string[], quality: undefined as number | undefined, disposed: false }
      log.canvases.push(canvas)
      return {
        fillRect: (color, x, y, w, h) => { canvas.ops.push(`fill ${color} ${x},${y} ${w}x${h}`) },
        drawImage: (_image, x, y, w, h) => { canvas.ops.push(`draw ${x},${y} ${w}x${h}`) },
        drawCenteredText: (text, color) => { canvas.ops.push(`text ${text} ${color}`) },
        toJpeg: async (quality) => { canvas.quality = quality; return new Uint8Array([0xff, 0xd8, 0xff]) },
        dispose: () => { canvas.disposed = true },
      }
    },
  }
  return { env, log }
}

const blob = () => new Blob(['x'], { type: 'image/png' })

describe('fitWithin', () => {
  it.each([
    [3000, 1500, 400, 400, 200],
    [1500, 3000, 400, 200, 400],
    [1000, 1000, 800, 800, 800],
    [4000, 3000, 800, 800, 600],
  ])('%ix%i con lado largo %i -> %ix%i (misma proporción)', (w, h, max, ew, eh) => {
    expect(fitWithin(w, h, max)).toEqual({ width: ew, height: eh })
  })

  it('no agranda una foto más chica que el máximo', () => {
    expect(fitWithin(300, 200, 400)).toEqual({ width: 300, height: 200 })
  })

  it('nunca da una dimensión de 0 px', () => {
    expect(fitWithin(10000, 3, 400)).toEqual({ width: 400, height: 1 })
  })

  it('rechaza una imagen sin tamaño', () => {
    expect(() => fitWithin(0, 100, 400)).toThrow()
  })

  it('"Normal" es 400 px y "Alta" 800 px', () => {
    expect(PHOTO_QUALITY).toEqual({ normal: 400, high: 800 })
  })
})

describe('reduceImage', () => {
  it('lado largo en el máximo, proporción conservada, JPEG 0.75', async () => {
    const { env, log } = fakeEnv({ width: 3000, height: 1500 })
    const image = await reduceImage(blob(), 400, env)
    expect(image).toMatchObject({ width: 400, height: 200, placeholder: false })
    expect(log.canvases[0]).toMatchObject({ width: 400, height: 200, quality: JPEG_QUALITY })
    expect(JPEG_QUALITY).toBe(0.75)
  })

  it('pinta fondo blanco ANTES de dibujar la foto (un PNG transparente no sale negro)', async () => {
    const { env, log } = fakeEnv()
    await reduceImage(blob(), 400, env)
    expect(log.canvases[0]!.ops).toEqual(['fill #ffffff 0,0 400x200', 'draw 0,0 400x200'])
  })

  it('libera el bitmap y el lienzo al terminar', async () => {
    const { env, log } = fakeEnv()
    await reduceImage(blob(), 400, env)
    expect(log.closed).toBe(1)
    expect(log.canvases[0]!.disposed).toBe(true)
  })

  it('también los libera si algo falla a la mitad', async () => {
    const { env, log } = fakeEnv()
    const failing: RasterEnv = {
      decode: env.decode,
      createCanvas: (w, h) => ({ ...env.createCanvas(w, h), toJpeg: async () => { throw new Error('boom') } }),
    }
    await expect(reduceImage(blob(), 400, failing)).rejects.toThrow('boom')
    expect(log.closed).toBe(1)
    expect(log.canvases[0]!.disposed).toBe(true)
  })

  it('con calidad Alta usa 800 px', async () => {
    const { env } = fakeEnv({ width: 3000, height: 1500 })
    expect(await reduceImage(blob(), PHOTO_QUALITY.high, env)).toMatchObject({ width: 800, height: 400 })
  })
})

describe('makePlaceholder', () => {
  it('es gris claro con la leyenda "Sin foto", 4:3, marcado como marcador', async () => {
    const { env, log } = fakeEnv()
    const image = await makePlaceholder(400, env)
    expect(image).toMatchObject({ width: 400, height: 300, placeholder: true })
    expect(log.canvases[0]!.ops).toEqual(['fill #e5e7eb 0,0 400x300', `text ${PLACEHOLDER_LABEL} #6b7280`])
    expect(PLACEHOLDER_LABEL).toBe('Sin foto')
    expect(log.canvases[0]!.disposed).toBe(true)
  })
})

describe('mapWithConcurrency', () => {
  it('nunca corre más de `limit` a la vez y conserva el orden', async () => {
    let running = 0
    let peak = 0
    const out = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4, async (n) => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise((resolve) => setTimeout(resolve, 5))
      running -= 1
      return n * 2
    })
    expect(peak).toBe(4)
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20])
  })

  it('con una lista vacía no hace nada', async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([])
  })

  it('deja de arrancar tareas cuando se cancela', async () => {
    const controller = new AbortController()
    const started: number[] = []
    const run = mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (n) => {
      started.push(n)
      if (n === 2) controller.abort()
      await new Promise((resolve) => setTimeout(resolve, 5))
    }, controller.signal)
    await expect(run).rejects.toMatchObject({ name: 'AbortError' })
    expect(started.length).toBeLessThan(6)
  })
})

describe('processCatalogImages', () => {
  it('usa concurrencia 4 por omisión', () => {
    expect(IMAGE_CONCURRENCY).toBe(4)
  })

  it('no baja dos veces la misma foto y reporta el avance', async () => {
    const { env } = fakeEnv()
    const fetchImage = vi.fn(async () => blob())
    const onProgress = vi.fn()
    const result = await processCatalogImages(['/a.png', '/b.png', '/a.png'], { maxSide: 400, env, fetchImage, onProgress })
    expect(fetchImage).toHaveBeenCalledTimes(2)
    expect([...result.keys()].sort()).toEqual(['/a.png', '/b.png'])
    expect(onProgress.mock.calls).toEqual([[1, 2], [2, 2]])
  })

  it('limita las descargas simultáneas a 4', async () => {
    const { env } = fakeEnv()
    let running = 0
    let peak = 0
    const fetchImage = async () => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise((resolve) => setTimeout(resolve, 5))
      running -= 1
      return blob()
    }
    await processCatalogImages(Array.from({ length: 12 }, (_, i) => `/p${i}.png`), { maxSide: 400, env, fetchImage })
    expect(peak).toBe(4)
  })

  it('una foto que falla usa el marcador y no rompe a las demás', async () => {
    const { env } = fakeEnv()
    const fetchImage = async (url: string) => {
      if (url.includes('mala')) throw new Error('404')
      return blob()
    }
    const result = await processCatalogImages(['/buena.png', '/mala.png', '/otra-mala.png'], { maxSide: 400, env, fetchImage })
    expect(result.get('/buena.png')!.placeholder).toBe(false)
    expect(result.get('/mala.png')!.placeholder).toBe(true)
    expect(result.get('/otra-mala.png')!.placeholder).toBe(true)
    // El marcador se dibuja una sola vez y se comparte.
    expect(result.get('/mala.png')).toBe(result.get('/otra-mala.png'))
  })

  it('una imagen que no se puede decodificar también usa el marcador', async () => {
    const { env } = fakeEnv()
    const broken: RasterEnv = { ...env, decode: async () => { throw new Error('formato roto') } }
    const result = await processCatalogImages(['/x.png'], { maxSide: 400, env: broken, fetchImage: async () => blob() })
    expect(result.get('/x.png')!.placeholder).toBe(true)
  })

  it('al cancelar lanza AbortError (no lo disfraza de marcador)', async () => {
    const { env } = fakeEnv()
    const controller = new AbortController()
    const fetchImage = async () => {
      controller.abort()
      throw new DOMException('abortado', 'AbortError')
    }
    await expect(
      processCatalogImages(['/a.png', '/b.png'], { maxSide: 400, env, fetchImage, signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('sin fotos devuelve un mapa vacío', async () => {
    const { env } = fakeEnv()
    expect((await processCatalogImages([], { maxSide: 400, env })).size).toBe(0)
  })
})

describe('fetchImageBlob', () => {
  it('rechaza una respuesta con error o que no es una imagen', async () => {
    const { fetchImageBlob } = await import('../catalog-images')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 404 })))
    await expect(fetchImageBlob('/x.png')).rejects.toThrow(/404/)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } })))
    await expect(fetchImageBlob('/x.png')).rejects.toThrow(/no es una imagen/)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('png', { status: 200, headers: { 'content-type': 'image/png' } })))
    expect((await fetchImageBlob('/x.png')).size).toBe(3)
    vi.unstubAllGlobals()
  })
})
