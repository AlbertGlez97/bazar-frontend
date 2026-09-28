/**
 * QR de un producto, generado en el navegador.
 *
 * El código contiene EXACTAMENTE el id del producto (un UUID, 36 caracteres,
 * sin URL, prefijo ni salto de línea): es lo que espera el escáner de venta
 * (`saleCatalog.findByScannedText`). El id nunca cambia, así que el QR no se
 * guarda en ningún lado: se recalcula cada vez y no hay llamada al backend.
 *
 * `qrcode` se importa de forma diferida: quien no pide un QR no descarga ni una
 * línea de la librería. La imagen es un PNG con un número ENTERO de píxeles por
 * módulo (nítido, sin interpolar) y ECC `M`; un UUID en minúsculas entra en la
 * versión 3 (29 x 29 módulos).
 */

const PRODUCT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Nivel de corrección de errores: M tolera ~15 % de daño y mantiene el código pequeño. */
export const QR_ERROR_CORRECTION = 'M'
/** Zona de silencio (módulos blancos alrededor) de la imagen suelta: 4, el valor de la norma. */
export const QR_QUIET_ZONE_MODULES = 4
/** Píxeles por módulo de la imagen suelta: 370 px de lado para un código de 29 módulos. */
export const DEFAULT_QR_SCALE = 10

export interface QrImageOptions {
  /** Píxeles por módulo; se redondea a un entero >= 1. */
  scale?: number
  /** Módulos blancos alrededor; se redondea a un entero >= 0 (la norma pide 4, mínimo práctico 2). */
  quietZone?: number
}

/** ¿Es un id de producto (UUID, cualquier versión)? Sin espacios ni saltos de línea. */
export function isProductId(value: unknown): value is string {
  return typeof value === 'string' && PRODUCT_ID_RE.test(value)
}

function assertProductId(value: unknown): asserts value is string {
  if (!isProductId(value)) throw new Error('Invalid product id: a QR can only encode a product UUID')
}

function wholeNumber(value: number | undefined, fallback: number, min: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(min, Math.round(value))
}

type QrLib = typeof import('qrcode')

let qrLibReady: Promise<QrLib> | null = null

/** Carga `qrcode` una sola vez. La build de navegador (CommonJS) se toma por su `default`. */
function loadQrLib(): Promise<QrLib> {
  qrLibReady ??= import('qrcode')
    .then((module) => ((module as { default?: QrLib }).default ?? module) as QrLib)
    .catch((cause) => {
      qrLibReady = null
      throw cause
    })
  return qrLibReady
}

/** PNG (data URL) del QR del producto: `(módulos + 2 x zona de silencio) x escala` píxeles de lado. */
export async function productQrDataUrl(productId: string, options: QrImageOptions = {}): Promise<string> {
  assertProductId(productId)
  const QRCode = await loadQrLib()
  return QRCode.toDataURL(productId, {
    type: 'image/png',
    errorCorrectionLevel: QR_ERROR_CORRECTION,
    scale: wholeNumber(options.scale, DEFAULT_QR_SCALE, 1),
    margin: wholeNumber(options.quietZone, QR_QUIET_ZONE_MODULES, 0),
  })
}

/** Convierte un data URL base64 en un Blob con su tipo. Lanza si no es un data URL. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl)
  if (!match) throw new Error('Not a base64 data URL')
  const binary = atob(match[2]!)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: match[1]! })
}

/** PNG del QR como Blob (para descargarlo). */
export async function productQrBlob(productId: string, options: QrImageOptions = {}): Promise<Blob> {
  return dataUrlToBlob(await productQrDataUrl(productId, options))
}

const MAX_NAME_PART = 40

/**
 * Nombre del archivo PNG: `qr-<nombre-simplificado>-<8 primeros del id>.png`.
 * El nombre va sin acentos, en minúsculas y con guiones; si queda vacío, "producto".
 */
export function productQrFileName(name: string, productId: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_NAME_PART)
    .replace(/-+$/g, '')
  return `qr-${slug || 'producto'}-${productId.slice(0, 8)}.png`
}
