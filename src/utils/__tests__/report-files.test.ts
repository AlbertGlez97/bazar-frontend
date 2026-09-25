import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reportFileName, saveBlob } from '../report-files'

describe('reportFileName', () => {
  it('names a single day ventas-la-marchanta-YYYY-MM-DD.ext', () => {
    expect(reportFileName({ from: '2026-09-24', to: '2026-09-24' }, 'pdf')).toBe('ventas-la-marchanta-2026-09-24.pdf')
    expect(reportFileName({ from: '2026-09-24', to: '2026-09-24' }, 'xlsx')).toBe('ventas-la-marchanta-2026-09-24.xlsx')
  })

  it('names a range ventas-la-marchanta-YYYY-MM-DD_a_YYYY-MM-DD.ext', () => {
    expect(reportFileName({ from: '2026-09-20', to: '2026-09-26' }, 'xlsx')).toBe('ventas-la-marchanta-2026-09-20_a_2026-09-26.xlsx')
  })

  it('never contains characters that break file systems', () => {
    expect(reportFileName({ from: '2026-09-20', to: '2026-09-26' }, 'pdf')).toMatch(/^[a-z0-9_.-]+$/)
  })
})

describe('saveBlob', () => {
  const created: HTMLAnchorElement[] = []
  let clickedWith: { href: string; download: string; inDom: boolean } | null = null

  beforeEach(() => {
    vi.useFakeTimers()
    clickedWith = null
    created.length = 0
    URL.createObjectURL = vi.fn(() => 'blob:fake-url')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clickedWith = { href: this.href, download: this.download, inDom: document.body.contains(this) }
      created.push(this)
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('clicks a temporary link with an object URL and the file name', () => {
    const blob = new Blob(['x'], { type: 'application/pdf' })
    saveBlob(blob, 'ventas-la-marchanta-2026-09-24.pdf')
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
    expect(clickedWith).toEqual({ href: 'blob:fake-url', download: 'ventas-la-marchanta-2026-09-24.pdf', inDom: true })
  })

  it('removes the link right away and revokes the URL a little later (so the download can start)', () => {
    saveBlob(new Blob(['x']), 'a.pdf')
    expect(document.body.contains(created[0])).toBe(false)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(10_000)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url')
  })
})
