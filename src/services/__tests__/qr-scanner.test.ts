import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// La cámara y el WASM no existen en jsdom: el adaptador recibe sus dependencias
// por parámetro y aquí se prueba toda la lógica (clasificación de errores,
// ciclo de vida del stream, antirrebote) con dobles.
vi.mock('zxing-wasm/reader/zxing_reader.wasm?url', () => ({ default: '/assets/zxing_reader-LOCAL.wasm' }))

const { setZXingModuleOverrides, PonyfillDetector } = vi.hoisted(() => {
  class PonyfillDetector {
    options: unknown
    constructor(options: unknown) { this.options = options }
    detect = async () => []
  }
  return { setZXingModuleOverrides: vi.fn(), PonyfillDetector }
})
vi.mock('barcode-detector/pure', () => ({ BarcodeDetector: PonyfillDetector, setZXingModuleOverrides }))

import {
  QrScannerError,
  classifyCameraError,
  createDefaultDetector,
  createScanDeduper,
  getScanSupport,
  startQrScanner,
  type QrScannerDeps,
} from '../qr-scanner'

const domError = (name: string) => Object.assign(new Error(name), { name })

describe('classifyCameraError', () => {
  it.each([
    ['NotAllowedError', 'permission-denied'],
    ['SecurityError', 'permission-denied'],
    ['NotFoundError', 'no-camera'],
    ['DevicesNotFoundError', 'no-camera'],
    ['OverconstrainedError', 'no-camera'],
    ['NotReadableError', 'camera-busy'],
    ['TrackStartError', 'camera-busy'],
    ['AbortError', 'camera-busy'],
    ['TypeError', 'unsupported'],
    ['Cualquier otra cosa', 'unknown'],
  ])('%s -> %s', (name, code) => {
    expect(classifyCameraError(domError(name))).toBe(code)
  })

  it('un valor que no es un error también da "unknown"', () => {
    expect(classifyCameraError(undefined)).toBe('unknown')
    expect(classifyCameraError('boom')).toBe('unknown')
  })
})

describe('getScanSupport', () => {
  it('ok con contexto seguro y getUserMedia', () => {
    expect(getScanSupport({ isSecureContext: true, mediaDevices: { getUserMedia: vi.fn() } })).toBe('ok')
  })

  it('sin contexto seguro (http fuera de localhost) avisa "insecure-context" aunque falte mediaDevices', () => {
    expect(getScanSupport({ isSecureContext: false, mediaDevices: undefined })).toBe('insecure-context')
  })

  it('contexto seguro pero sin getUserMedia: "unsupported"', () => {
    expect(getScanSupport({ isSecureContext: true, mediaDevices: undefined })).toBe('unsupported')
    expect(getScanSupport({ isSecureContext: true, mediaDevices: {} })).toBe('unsupported')
  })
})

describe('createScanDeduper', () => {
  it('deja pasar la primera lectura y descarta la misma dentro de la ventana', () => {
    let now = 1000
    const dedupe = createScanDeduper(1500, () => now)
    expect(dedupe('abc')).toBe(true)
    now = 1400
    expect(dedupe('abc')).toBe(false)
    now = 2499
    expect(dedupe('abc')).toBe(false)
  })

  it('pasada la ventana la misma lectura vuelve a valer', () => {
    let now = 0
    const dedupe = createScanDeduper(1500, () => now)
    expect(dedupe('abc')).toBe(true)
    now = 1500
    expect(dedupe('abc')).toBe(true)
  })

  it('un código distinto pasa de inmediato', () => {
    const dedupe = createScanDeduper(1500, () => 0)
    expect(dedupe('a')).toBe(true)
    expect(dedupe('b')).toBe(true)
  })

  it('mientras se sigue leyendo el mismo código la ventana se renueva (cámara sostenida)', () => {
    let now = 0
    const dedupe = createScanDeduper(1500, () => now)
    expect(dedupe('a')).toBe(true)
    for (now = 500; now <= 6000; now += 500) expect(dedupe('a')).toBe(false)
    // Se quitó el código de la vista más de 1.5 s: al volver a mostrarlo cuenta de nuevo.
    now = 8000
    expect(dedupe('a')).toBe(true)
  })

  it('ignora lecturas vacías', () => {
    expect(createScanDeduper(1500, () => 0)('')).toBe(false)
  })
})

// ── startQrScanner ───────────────────────────────────────────────────────
function fakeStream() {
  const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }]
  return { stream: { getTracks: () => tracks } as unknown as MediaStream, tracks }
}

function fakeVideo() {
  return {
    srcObject: null as MediaStream | null,
    muted: false,
    readyState: 4,
    play: vi.fn(async () => undefined),
    setAttribute: vi.fn(),
  } as unknown as HTMLVideoElement & { play: ReturnType<typeof vi.fn>; setAttribute: ReturnType<typeof vi.fn> }
}

function makeDeps(overrides: Partial<QrScannerDeps> = {}) {
  const { stream, tracks } = fakeStream()
  const detect = vi.fn(async (): Promise<{ rawValue: string }[]> => [])
  const deps: QrScannerDeps = {
    getUserMedia: vi.fn(async () => stream),
    createDetector: vi.fn(async () => ({ detect })),
    scanIntervalMs: 100,
    ...overrides,
  }
  return { deps, stream, tracks, detect }
}

describe('startQrScanner', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('pide la cámara trasera sin audio, la conecta al video (mudo, inline) y la reproduce', async () => {
    const { deps, stream } = makeDeps()
    const video = fakeVideo()
    const handle = await startQrScanner(video, vi.fn(), deps)

    expect(deps.getUserMedia).toHaveBeenCalledWith({ video: { facingMode: { ideal: 'environment' } }, audio: false })
    expect(video.srcObject).toBe(stream)
    expect(video.muted).toBe(true)
    expect(video.setAttribute).toHaveBeenCalledWith('playsinline', '')
    expect(video.play).toHaveBeenCalled()
    handle.stop()
  })

  it('entrega el texto de cada código detectado', async () => {
    const { deps, detect } = makeDeps()
    detect.mockResolvedValueOnce([{ rawValue: 'producto-1' }, { rawValue: 'producto-2' }])
    const onDecode = vi.fn()
    const handle = await startQrScanner(fakeVideo(), onDecode, deps)

    await vi.advanceTimersByTimeAsync(100)

    expect(onDecode).toHaveBeenCalledTimes(2)
    expect(onDecode).toHaveBeenNthCalledWith(1, 'producto-1')
    expect(onDecode).toHaveBeenNthCalledWith(2, 'producto-2')
    handle.stop()
  })

  it('no analiza mientras el video no tiene imagen (readyState < 2)', async () => {
    const { deps, detect } = makeDeps()
    const video = fakeVideo()
    ;(video as { readyState: number }).readyState = 1
    const handle = await startQrScanner(video, vi.fn(), deps)
    await vi.advanceTimersByTimeAsync(500)
    expect(detect).not.toHaveBeenCalled()
    handle.stop()
  })

  it('un cuadro que falla no detiene la lectura', async () => {
    const { deps, detect } = makeDeps()
    detect.mockRejectedValueOnce(new Error('frame'))
    detect.mockResolvedValue([{ rawValue: 'ok' }])
    const onDecode = vi.fn()
    const handle = await startQrScanner(fakeVideo(), onDecode, deps)

    await vi.advanceTimersByTimeAsync(300)

    expect(onDecode).toHaveBeenCalledWith('ok')
    handle.stop()
  })

  it('no encima análisis: espera a que termine el anterior', async () => {
    const { deps, detect } = makeDeps()
    let release!: () => void
    detect.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve([]) }))
    const handle = await startQrScanner(fakeVideo(), vi.fn(), deps)

    await vi.advanceTimersByTimeAsync(1000)
    expect(detect).toHaveBeenCalledTimes(1)

    release()
    await vi.advanceTimersByTimeAsync(100)
    expect(detect.mock.calls.length).toBeGreaterThan(1)
    handle.stop()
  })

  it('stop() detiene TODAS las pistas, suelta el video y cancela el ciclo', async () => {
    const { deps, tracks, detect } = makeDeps()
    const video = fakeVideo()
    const handle = await startQrScanner(video, vi.fn(), deps)

    handle.stop()

    for (const track of tracks) expect(track.stop).toHaveBeenCalledTimes(1)
    expect(video.srcObject).toBeNull()
    const calls = detect.mock.calls.length
    await vi.advanceTimersByTimeAsync(1000)
    expect(detect.mock.calls.length).toBe(calls)
  })

  it('stop() es idempotente', async () => {
    const { deps, tracks } = makeDeps()
    const handle = await startQrScanner(fakeVideo(), vi.fn(), deps)
    handle.stop()
    handle.stop()
    expect(tracks[0].stop).toHaveBeenCalledTimes(1)
  })

  it('una detección que termina después de stop() ya no se entrega', async () => {
    const { deps, detect } = makeDeps()
    let release!: (codes: { rawValue: string }[]) => void
    detect.mockImplementationOnce(() => new Promise((resolve) => { release = resolve }))
    const onDecode = vi.fn()
    const handle = await startQrScanner(fakeVideo(), onDecode, deps)
    await vi.advanceTimersByTimeAsync(100)

    handle.stop()
    release([{ rawValue: 'tarde' }])
    await vi.advanceTimersByTimeAsync(300)

    expect(onDecode).not.toHaveBeenCalled()
  })

  it('permiso denegado: lanza QrScannerError "permission-denied"', async () => {
    const { deps } = makeDeps({ getUserMedia: vi.fn(async () => { throw domError('NotAllowedError') }) })
    const error = await startQrScanner(fakeVideo(), vi.fn(), deps).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(QrScannerError)
    expect((error as QrScannerError).code).toBe('permission-denied')
  })

  it('sin cámara: "no-camera"', async () => {
    const { deps } = makeDeps({ getUserMedia: vi.fn(async () => { throw domError('NotFoundError') }) })
    await expect(startQrScanner(fakeVideo(), vi.fn(), deps)).rejects.toMatchObject({ code: 'no-camera' })
  })

  it('si el lector no carga, apaga la cámara que ya había abierto y lanza "unsupported"', async () => {
    const { deps, tracks } = makeDeps({ createDetector: vi.fn(async () => { throw new Error('wasm') }) })
    await expect(startQrScanner(fakeVideo(), vi.fn(), deps)).rejects.toMatchObject({ code: 'unsupported' })
    for (const track of tracks) expect(track.stop).toHaveBeenCalled()
  })

  it('si el video no puede reproducir, apaga la cámara y lanza error', async () => {
    const { deps, tracks } = makeDeps()
    const video = fakeVideo()
    video.play.mockRejectedValueOnce(domError('NotAllowedError'))
    await expect(startQrScanner(video, vi.fn(), deps)).rejects.toBeInstanceOf(QrScannerError)
    for (const track of tracks) expect(track.stop).toHaveBeenCalled()
  })

  it('un AbortError de play() (el video se reemplazó) no cuenta como fallo', async () => {
    const { deps } = makeDeps()
    const video = fakeVideo()
    video.play.mockRejectedValueOnce(domError('AbortError'))
    const handle = await startQrScanner(video, vi.fn(), deps)
    handle.stop()
  })
})

// ── Detector por defecto ─────────────────────────────────────────────────
describe('createDefaultDetector', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'BarcodeDetector')
    setZXingModuleOverrides.mockClear()
  })

  it('usa el BarcodeDetector nativo cuando soporta QR (Chrome en Android): sin WASM', async () => {
    const getSupportedFormats = vi.fn(async () => ['qr_code', 'ean_13'])
    class Native {
      static getSupportedFormats = getSupportedFormats
      options: unknown
      constructor(options: unknown) { this.options = options }
      detect = vi.fn()
    }
    ;(globalThis as Record<string, unknown>).BarcodeDetector = Native

    const detector = await createDefaultDetector()

    expect(detector).toBeInstanceOf(Native)
    expect((detector as unknown as Native).options).toEqual({ formats: ['qr_code'] })
    expect(setZXingModuleOverrides).not.toHaveBeenCalled()
  })

  it('sin API nativa carga el lector de zxing y lo pide SOLO de QR', async () => {
    const detector = await createDefaultDetector()
    expect(detector).toBeInstanceOf(PonyfillDetector)
    expect((detector as unknown as InstanceType<typeof PonyfillDetector>).options).toEqual({ formats: ['qr_code'] })
  })

  it('con API nativa pero sin soporte de QR usa zxing', async () => {
    ;(globalThis as Record<string, unknown>).BarcodeDetector = class {
      static getSupportedFormats = async () => ['ean_13']
    }
    expect(await createDefaultDetector()).toBeInstanceOf(PonyfillDetector)
  })

  it('si la API nativa falla al consultar formatos usa zxing', async () => {
    ;(globalThis as Record<string, unknown>).BarcodeDetector = class {
      static getSupportedFormats = async () => { throw new Error('nope') }
    }
    expect(await createDefaultDetector()).toBeInstanceOf(PonyfillDetector)
  })

  it('el WASM sale del paquete local (URL de Vite), nunca de un CDN', async () => {
    await createDefaultDetector()

    expect(setZXingModuleOverrides).toHaveBeenCalledTimes(1)
    const { locateFile } = setZXingModuleOverrides.mock.calls[0][0] as {
      locateFile: (path: string, prefix: string) => string
    }
    expect(locateFile('zxing_reader.wasm', 'https://cdn.example/')).toBe('/assets/zxing_reader-LOCAL.wasm')
    // Cualquier otro archivo conserva el comportamiento por omisión del paquete.
    expect(locateFile('otro.js', '/base/')).toBe('/base/otro.js')
  })
})
