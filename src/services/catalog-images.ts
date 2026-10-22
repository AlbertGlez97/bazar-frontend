/**
 * Fotos del catálogo en Word: se bajan (ruta relativa, mismo origen, públicas), se REDUCEN
 * en el navegador y se entregan como bytes JPEG. Las originales son PNG de hasta 5 MB sin
 * miniaturas; incrustarlas tal cual haría un archivo enorme.
 *
 * - Reducción: el lado largo queda en `maxSide` (400 px "Normal", 800 px "Alta"), se conserva
 *   la proporción y nunca se agranda una foto chica. Se pinta fondo BLANCO antes de dibujar:
 *   un PNG con transparencia saldría negro al pasar a JPEG. JPEG calidad 0.75.
 * - Pocas a la vez (`IMAGE_CONCURRENCY`) y se libera la memoria de cada una (bitmap y canvas).
 * - Una foto que falla (red, formato roto) NO rompe el catálogo: lleva el marcador "Sin foto".
 * - El marcador (gris claro con la leyenda) se dibuja por código y se inserta como imagen,
 *   para que quien reciba el Word lo pueda reemplazar.
 * - Cancelable con un `AbortSignal`: lanza `AbortError` y no sigue con las que faltan.
 *
 * El entorno de dibujo (decodificar, canvas) está detrás de `RasterEnv` para poder probar la
 * lógica sin un navegador; `browserRasterEnv` es el real.
 */

export const IMAGE_CONCURRENCY = 4
export const JPEG_QUALITY = 0.75
export const PHOTO_QUALITY = { normal: 400, high: 800 } as const
export type PhotoQuality = keyof typeof PHOTO_QUALITY
export const PLACEHOLDER_LABEL = 'Sin foto'

export interface ReducedImage {
  bytes: Uint8Array
  /** Tamaño en píxeles de la imagen reducida. */
  width: number
  height: number
  /** `true` si es el marcador "Sin foto". */
  placeholder: boolean
}

/** Lo que se necesita de una imagen decodificada. */
export interface DecodedImage {
  width: number
  height: number
  /** Lo que el lienzo dibuja (en el navegador, un `ImageBitmap`). */
  source: unknown
  /** Libera la memoria del bitmap. */
  close(): void
}

/** Lo que se necesita de un lienzo. */
export interface RasterCanvas {
  fillRect(color: string, x: number, y: number, width: number, height: number): void
  drawImage(image: DecodedImage, x: number, y: number, width: number, height: number): void
  drawCenteredText(text: string, color: string, fontPx: number): void
  toJpeg(quality: number): Promise<Uint8Array>
  /** Libera el lienzo. */
  dispose(): void
}

export interface RasterEnv {
  decode(blob: Blob): Promise<DecodedImage>
  createCanvas(width: number, height: number): RasterCanvas
}

/** Tamaño de destino: el lado largo en `maxSide`, misma proporción, sin agrandar. */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) throw new RangeError('The image has no size')
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** Reduce una imagen a JPEG (fondo blanco, lado largo `maxSide`). */
export async function reduceImage(blob: Blob, maxSide: number, env: RasterEnv = browserRasterEnv): Promise<ReducedImage> {
  const image = await env.decode(blob)
  let canvas: RasterCanvas | null = null
  try {
    const size = fitWithin(image.width, image.height, maxSide)
    canvas = env.createCanvas(size.width, size.height)
    canvas.fillRect('#ffffff', 0, 0, size.width, size.height)
    canvas.drawImage(image, 0, 0, size.width, size.height)
    const bytes = await canvas.toJpeg(JPEG_QUALITY)
    return { bytes, ...size, placeholder: false }
  } finally {
    image.close()
    canvas?.dispose()
  }
}

/** El marcador neutro "Sin foto" (gris claro), con la proporción 4:3. */
export async function makePlaceholder(maxSide: number, env: RasterEnv = browserRasterEnv): Promise<ReducedImage> {
  const width = maxSide
  const height = Math.round((maxSide * 3) / 4)
  const canvas = env.createCanvas(width, height)
  try {
    canvas.fillRect('#e5e7eb', 0, 0, width, height)
    canvas.drawCenteredText(PLACEHOLDER_LABEL, '#6b7280', Math.max(12, Math.round(maxSide / 14)))
    return { bytes: await canvas.toJpeg(JPEG_QUALITY), width, height, placeholder: true }
  } finally {
    canvas.dispose()
  }
}

/** Corre `task` sobre cada elemento con a lo más `limit` en vuelo; conserva el orden de los resultados. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker(): Promise<void> {
    while (next < items.length) {
      signal?.throwIfAborted()
      const index = next
      next += 1
      results[index] = await task(items[index]!, index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, () => worker()))
  signal?.throwIfAborted()
  return results
}

export interface ProcessImagesOptions {
  maxSide: number
  concurrency?: number
  signal?: AbortSignal
  /** Se llama al terminar cada foto (`done` de `total`). */
  onProgress?: (done: number, total: number) => void
  /** Baja la foto como Blob; por omisión `fetch` del mismo origen. */
  fetchImage?: (url: string, signal?: AbortSignal) => Promise<Blob>
  env?: RasterEnv
}

export async function fetchImageBlob(url: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`No se pudo bajar la foto (${response.status})`)
  const type = (response.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase()
  if (!type.startsWith('image/')) throw new Error('El archivo descargado no es una imagen')
  return response.blob()
}

/**
 * Baja y reduce las fotos de `urls` (sin repetir). Devuelve un mapa url -> imagen reducida;
 * las que fallan llevan el marcador. Lanza `AbortError` si se cancela.
 */
export async function processCatalogImages(
  urls: readonly string[],
  options: ProcessImagesOptions,
): Promise<Map<string, ReducedImage>> {
  const env = options.env ?? browserRasterEnv
  const fetchImage = options.fetchImage ?? fetchImageBlob
  const unique = [...new Set(urls)]
  const result = new Map<string, ReducedImage>()
  let placeholder: Promise<ReducedImage> | null = null
  const getPlaceholder = () => (placeholder ??= makePlaceholder(options.maxSide, env))
  let done = 0

  await mapWithConcurrency(
    unique,
    options.concurrency ?? IMAGE_CONCURRENCY,
    async (url) => {
      let image: ReducedImage
      try {
        image = await reduceImage(await fetchImage(url, options.signal), options.maxSide, env)
      } catch (error) {
        if (options.signal?.aborted) throw error
        image = await getPlaceholder()
      }
      result.set(url, image)
      done += 1
      options.onProgress?.(done, unique.length)
    },
    options.signal,
  )
  return result
}

// ── Entorno real del navegador ───────────────────────────────────────────────

function createBrowserCanvas(width: number, height: number): RasterCanvas {
  const element = document.createElement('canvas')
  element.width = width
  element.height = height
  const context = element.getContext('2d')
  if (!context) throw new Error('El navegador no pudo crear el lienzo')
  return {
    fillRect(color, x, y, w, h) {
      context.fillStyle = color
      context.fillRect(x, y, w, h)
    },
    drawImage(image, x, y, w, h) {
      context.drawImage(image.source as ImageBitmap, x, y, w, h)
    },
    drawCenteredText(text, color, fontPx) {
      context.fillStyle = color
      context.font = `${fontPx}px Calibri, Arial, sans-serif`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(text, width / 2, height / 2)
    },
    toJpeg(quality) {
      return new Promise((resolve, reject) => {
        element.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('No se pudo convertir la foto'))
            blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject)
          },
          'image/jpeg',
          quality,
        )
      })
    },
    dispose() {
      // Soltar el búfer del lienzo ya (no esperar al recolector).
      element.width = 0
      element.height = 0
    },
  }
}

export const browserRasterEnv: RasterEnv = {
  async decode(blob) {
    const bitmap = await createImageBitmap(blob)
    return { width: bitmap.width, height: bitmap.height, source: bitmap, close: () => bitmap.close() }
  },
  createCanvas: createBrowserCanvas,
}
