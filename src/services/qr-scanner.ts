/**
 * Adaptador del lector de QR (cámara + detector).
 *
 * Librería elegida: `barcode-detector` (ponyfill de la API `BarcodeDetector`
 * sobre zxing-cpp compilado a WASM). Decisión y evidencia en
 * `odd/tasks/sales-screen.md` (A2.1). Puntos que importan:
 * - Si el navegador trae `BarcodeDetector` nativo con QR (Chrome en Android),
 *   se usa ese: sin WASM, más rápido y gasta menos batería.
 * - Si no, se carga el lector de zxing. Por omisión el paquete descarga su
 *   `.wasm` de un CDN en tiempo de ejecución, lo que rompería el modo sin
 *   internet: aquí se redirige al archivo que Vite empaqueta con la app
 *   (`?url`), y el service worker lo precachea (ver `vite.config.ts`).
 * - Todo se importa de forma diferida: quien no abre la cámara no descarga
 *   ni una línea del lector.
 *
 * jsdom no tiene cámara ni WASM, así que la lógica recibe sus dependencias
 * por parámetro (`QrScannerDeps`) y los tests la ejercen con dobles.
 */

export type QrScannerErrorCode =
  | 'permission-denied'
  | 'no-camera'
  | 'camera-busy'
  | 'unsupported'
  | 'unknown'

/** Falla al abrir la cámara o el lector; `code` decide el mensaje amable. */
export class QrScannerError extends Error {
  readonly code: QrScannerErrorCode
  readonly cause: unknown
  constructor(code: QrScannerErrorCode, cause?: unknown) {
    super(`QR scanner: ${code}`)
    this.name = 'QrScannerError'
    this.code = code
    this.cause = cause
  }
}

/** Traduce el error de `getUserMedia` (por `name`) a un código propio. */
export function classifyCameraError(cause: unknown): QrScannerErrorCode {
  const name = (cause as { name?: unknown } | null)?.name
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      return 'permission-denied'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'no-camera'
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'camera-busy'
    case 'TypeError':
      return 'unsupported'
    default:
      return 'unknown'
  }
}

export type ScanSupport = 'ok' | 'insecure-context' | 'unsupported'

interface SupportEnv {
  isSecureContext: boolean
  mediaDevices: { getUserMedia?: unknown } | undefined
}

/**
 * ¿Se puede pedir la cámara aquí? `getUserMedia` solo existe en HTTPS o
 * localhost; en una página http normal `navigator.mediaDevices` es undefined,
 * y eso se explica distinto a "este navegador no sirve".
 */
export function getScanSupport(env?: SupportEnv): ScanSupport {
  const current: SupportEnv = env ?? {
    isSecureContext: typeof window !== 'undefined' && window.isSecureContext,
    mediaDevices: typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined,
  }
  if (!current.isSecureContext) return 'insecure-context'
  if (typeof current.mediaDevices?.getUserMedia !== 'function') return 'unsupported'
  return 'ok'
}

/**
 * Antirrebote de lecturas: una cámara sostenida sobre un QR lo lee muchas
 * veces por segundo y no debe agregar el producto 20 veces. La misma lectura
 * dentro de `windowMs` se descarta, y cada repetición renueva la ventana (el
 * código sigue a la vista); un texto distinto pasa de inmediato.
 */
export function createScanDeduper(windowMs: number, now: () => number = Date.now) {
  let lastText = ''
  let lastSeenAt = 0
  return function accept(text: string): boolean {
    if (!text) return false
    const current = now()
    const repeated = text === lastText && current - lastSeenAt < windowMs
    lastText = text
    lastSeenAt = current
    return !repeated
  }
}

/** Lo mínimo que se usa de un detector (nativo o zxing). */
export interface QrDetector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>
}

export interface QrScannerDeps {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>
  createDetector: () => Promise<QrDetector>
  /** Pausa entre análisis: ~5 cuadros por segundo bastan y cuidan la batería. */
  scanIntervalMs: number
}

export interface QrScannerHandle {
  /** Apaga la cámara (todas las pistas) y el ciclo de lectura. Idempotente. */
  stop(): void
}

const QR_FORMATS = { formats: ['qr_code'] }

/**
 * Detector por defecto: `BarcodeDetector` nativo con QR si existe; si no,
 * zxing-wasm empaquetado localmente.
 */
export async function createDefaultDetector(): Promise<QrDetector> {
  const Native = (globalThis as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector
  if (Native) {
    try {
      const formats = await Native.getSupportedFormats()
      if (formats.includes('qr_code')) return new Native(QR_FORMATS)
    } catch {
      // La API existe pero no responde: se usa el lector de zxing.
    }
  }

  const [{ BarcodeDetector, setZXingModuleOverrides }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/pure'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ])
  setZXingModuleOverrides({
    // Solo el .wasm cambia de origen; lo demás conserva el comportamiento del paquete.
    locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
  })
  return new BarcodeDetector({ formats: ['qr_code'] })
}

interface NativeDetectorClass {
  new (options: { formats: string[] }): QrDetector
  getSupportedFormats(): Promise<string[]>
}

function defaultDeps(): QrScannerDeps {
  return {
    getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
    createDetector: createDefaultDetector,
    scanIntervalMs: 200,
  }
}

const HAVE_CURRENT_DATA = 2

/**
 * Abre la cámara trasera en `video` y llama a `onDecode(texto)` por CADA
 * lectura (el antirrebote es de quien consume). Lanza `QrScannerError` si no
 * se pudo; en ese caso no queda ninguna pista abierta.
 */
export async function startQrScanner(
  video: HTMLVideoElement,
  onDecode: (text: string) => void,
  deps: QrScannerDeps = defaultDeps(),
): Promise<QrScannerHandle> {
  let stream: MediaStream
  try {
    stream = await deps.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
  } catch (cause) {
    throw new QrScannerError(classifyCameraError(cause), cause)
  }

  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const release = () => {
    stopped = true
    if (timer) clearTimeout(timer)
    for (const track of stream.getTracks()) track.stop()
    video.srcObject = null
  }

  let detector: QrDetector
  try {
    detector = await deps.createDetector()
  } catch (cause) {
    release()
    throw new QrScannerError('unsupported', cause)
  }

  try {
    video.srcObject = stream
    video.muted = true
    video.setAttribute('playsinline', '')
    await video.play()
  } catch (cause) {
    // AbortError: el video se reemplazó o se cerró mientras arrancaba; no es un fallo.
    if ((cause as { name?: unknown } | null)?.name !== 'AbortError') {
      release()
      throw new QrScannerError(classifyCameraError(cause), cause)
    }
  }

  const tick = async () => {
    if (stopped) return
    if (video.readyState >= HAVE_CURRENT_DATA) {
      try {
        const codes = await detector.detect(video)
        if (!stopped) for (const code of codes) onDecode(code.rawValue)
      } catch {
        // Un cuadro que no se pudo analizar no es motivo para parar: sigue el siguiente.
      }
    }
    if (!stopped) timer = setTimeout(tick, deps.scanIntervalMs)
  }
  timer = setTimeout(tick, deps.scanIntervalMs)

  return {
    stop() {
      if (stopped) return
      release()
    },
  }
}
