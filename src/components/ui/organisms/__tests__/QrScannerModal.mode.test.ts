// Control "Agregar a la venta | Ver ficha" del escáner.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const { startQrScanner, getScanSupport } = vi.hoisted(() => ({ startQrScanner: vi.fn(), getScanSupport: vi.fn(() => 'ok') }))
vi.mock('@/services/qr-scanner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/qr-scanner')>()),
  startQrScanner,
  getScanSupport,
}))
import QrScannerModal from '../QrScannerModal.vue'

beforeEach(() => {
  startQrScanner.mockReset()
  startQrScanner.mockResolvedValue({ stop: vi.fn() })
})

const mountModal = (props: Record<string, unknown> = {}) =>
  mount(QrScannerModal, { props: { modelValue: true, ...props }, global: { stubs: { teleport: true } } })
const options = (w: ReturnType<typeof mountModal>) => w.findAll('.segmented-control button')

describe('QrScannerModal — modo de lectura', () => {
  it('sin pedirlo no hay control (el escáner de siempre)', () => {
    expect(mountModal().find('.segmented-control').exists()).toBe(false)
  })

  it('con showModeControl: dos opciones, "Agregar a la venta" y "Ver ficha"', () => {
    const w = mountModal({ showModeControl: true })
    expect(options(w).map((b) => b.text())).toEqual(['Agregar a la venta', 'Ver ficha'])
  })

  it('por defecto está activo "Agregar a la venta"', () => {
    const w = mountModal({ showModeControl: true })
    expect(options(w)[0].attributes('aria-pressed')).toBe('true')
    expect(options(w)[1].attributes('aria-pressed')).toBe('false')
  })

  it('tocar "Ver ficha" emite update:mode con sheet', async () => {
    const w = mountModal({ showModeControl: true })
    await options(w)[1].trigger('click')
    expect(w.emitted('update:mode')).toEqual([['sheet']])
  })

  it('el control tiene nombre accesible', () => {
    const w = mountModal({ showModeControl: true })
    expect(w.get('.segmented-control').attributes('aria-label')).toBe('Qué hacer al escanear')
  })

  it('la pista cambia con el modo', async () => {
    const w = mountModal({ showModeControl: true, mode: 'sheet' })
    await flushPromises()
    expect(w.text()).toContain('ver su ficha')
  })

  it('en modo ficha fijo (Productos) la pista habla de la ficha y no hay control', async () => {
    const w = mountModal({ mode: 'sheet' })
    await flushPromises()
    expect(w.find('.segmented-control').exists()).toBe(false)
    expect(w.text()).toContain('ver su ficha')
  })

  it('el título sigue siendo "Escanear producto"', () => {
    expect(mountModal({ showModeControl: true }).text()).toContain('Escanear producto')
  })
})
