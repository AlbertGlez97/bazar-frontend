import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useLabelPrinting } from '../useLabelPrinting'
import { useLabelCalibrationStore } from '@/stores/label-calibration.store'
import { generateQrLabelSheet } from '@/services/qr-label-sheet'
import { saveBlob } from '@/utils/report-files'
import { VOICE } from '@/config/voice'
import source from '../useLabelPrinting.ts?raw'

vi.mock('@/services/qr-label-sheet', () => ({ generateQrLabelSheet: vi.fn() }))
vi.mock('@/utils/report-files', () => ({ saveBlob: vi.fn() }))

const ID = (n: number) => `01a0ddd7-7f00-744a-8b23-${String(n).padStart(12, '0')}`
const products = [{ id: ID(1), name: 'Taza' }, { id: ID(2), name: 'Maceta' }]
const blob = new Blob(['%PDF-fake'], { type: 'application/pdf' })

interface FakeTab { location: { href: string }; close: ReturnType<typeof vi.fn> }
let tab: FakeTab

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.mocked(generateQrLabelSheet).mockReset().mockResolvedValue({ blob, plan: { pages: 1, labels: [] } } as never)
  vi.mocked(saveBlob).mockReset()
  tab = { location: { href: '' }, close: vi.fn() }
  vi.spyOn(window, 'open').mockImplementation(() => tab as unknown as Window)
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview-1')
  globalThis.URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useLabelPrinting — download', () => {
  it('builds the sheet with the SAVED calibration and downloads it as etiquetas-qr-YYYYMMDD.pdf', async () => {
    useLabelCalibrationStore().set({ offsetTopMm: 1.5, offsetLeftMm: -0.8, rowPitchMm: 25 })
    const printing = useLabelPrinting()
    await printing.download(products)
    expect(generateQrLabelSheet).toHaveBeenCalledWith(products, { offsetTopMm: 1.5, offsetLeftMm: -0.8, rowPitchMm: 25 })
    expect(saveBlob).toHaveBeenCalledTimes(1)
    const [saved, filename] = vi.mocked(saveBlob).mock.calls[0]!
    expect(saved).toBe(blob)
    expect(filename).toMatch(/^etiquetas-qr-\d{8}\.pdf$/)
  })

  it('is busy while generating and idle again afterwards, with no error', async () => {
    let release!: () => void
    vi.mocked(generateQrLabelSheet).mockReturnValue(new Promise((resolve) => { release = () => resolve({ blob } as never) }))
    const printing = useLabelPrinting()
    const pending = printing.download(products)
    expect(printing.busy.value).toBe('download')
    release()
    await pending
    expect(printing.busy.value).toBeNull()
    expect(printing.error.value).toBe('')
  })

  it('shows a clear message and saves nothing when the PDF cannot be built', async () => {
    vi.mocked(generateQrLabelSheet).mockRejectedValue(new Error('boom'))
    const printing = useLabelPrinting()
    await printing.download(products)
    expect(saveBlob).not.toHaveBeenCalled()
    expect(printing.error.value).toBe(VOICE.labels.printError)
    expect(printing.busy.value).toBeNull()
  })

  it('a new attempt clears the previous error', async () => {
    vi.mocked(generateQrLabelSheet).mockRejectedValueOnce(new Error('boom'))
    const printing = useLabelPrinting()
    await printing.download(products)
    expect(printing.error.value).not.toBe('')
    await printing.download(products)
    expect(printing.error.value).toBe('')
  })

  it('ignores a second request while one is running', async () => {
    let release!: () => void
    vi.mocked(generateQrLabelSheet).mockReturnValue(new Promise((resolve) => { release = () => resolve({ blob } as never) }))
    const printing = useLabelPrinting()
    const first = printing.download(products)
    await printing.download(products)
    release()
    await first
    expect(generateQrLabelSheet).toHaveBeenCalledTimes(1)
  })

  it('refuses an empty selection without building anything', async () => {
    const printing = useLabelPrinting()
    await printing.download([])
    expect(generateQrLabelSheet).not.toHaveBeenCalled()
    expect(saveBlob).not.toHaveBeenCalled()
  })
})

describe('useLabelPrinting — preview', () => {
  it('opens the tab FIRST (inside the click, so the pop-up is allowed), then points it at the PDF', async () => {
    let release!: () => void
    vi.mocked(generateQrLabelSheet).mockReturnValue(new Promise((resolve) => { release = () => resolve({ blob } as never) }))
    const printing = useLabelPrinting()
    const pending = printing.preview(products)
    expect(window.open).toHaveBeenCalledTimes(1)
    expect(printing.busy.value).toBe('preview')
    expect(tab.location.href).toBe('')
    release()
    await pending
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
    expect(tab.location.href).toBe('blob:preview-1')
    expect(printing.busy.value).toBeNull()
  })

  it('revokes the object URL later, not immediately', async () => {
    vi.useFakeTimers()
    const printing = useLabelPrinting()
    await printing.preview(products)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(10 * 60 * 1000)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1')
  })

  it('tells the person when the browser blocked the pop-up and points to "Descargar"', async () => {
    vi.mocked(window.open).mockReturnValue(null)
    const printing = useLabelPrinting()
    await printing.preview(products)
    expect(printing.error.value).toBe(VOICE.labels.previewBlocked)
    expect(generateQrLabelSheet).not.toHaveBeenCalled()
  })

  it('closes the blank tab and shows a clear message when the PDF cannot be built', async () => {
    vi.mocked(generateQrLabelSheet).mockRejectedValue(new Error('boom'))
    const printing = useLabelPrinting()
    await printing.preview(products)
    expect(tab.close).toHaveBeenCalled()
    expect(printing.error.value).toBe(VOICE.labels.printError)
    expect(printing.busy.value).toBeNull()
  })

  it('does not open a tab for an empty selection', async () => {
    const printing = useLabelPrinting()
    await printing.preview([])
    expect(window.open).not.toHaveBeenCalled()
  })
})

describe('lazy loading', () => {
  it('imports the renderer (jsPDF + qrcode) only through import()', () => {
    expect(source).not.toMatch(/^\s*import\s[^;]*from\s+['"]@\/services\/qr-label-sheet['"]/m)
    expect(source).toMatch(/import\(\s*['"]@\/services\/qr-label-sheet['"]\s*\)/)
  })
})
