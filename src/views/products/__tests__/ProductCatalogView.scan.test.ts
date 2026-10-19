// Productos (socios): "Escanear QR" abre el escáner en modo ficha fijo.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ProductCatalogView from '../ProductCatalogView.vue'
import ProductsService from '@/services/products.service'
import { useSessionStore } from '@/stores/session.store'
import { useUiModeStore } from '@/stores/uiMode.store'
import { makeProduct } from '@/test/factories'

const { startQrScanner, getScanSupport } = vi.hoisted(() => ({ startQrScanner: vi.fn(), getScanSupport: vi.fn(() => 'ok') }))
vi.mock('@/services/qr-scanner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/qr-scanner')>()),
  startQrScanner,
  getScanSupport,
}))
vi.mock('@/services/products.service', () => ({
  default: {
    listProducts: vi.fn(), getSuggestions: vi.fn(), getProduct: vi.fn(), createProduct: vi.fn(), updateProduct: vi.fn(),
    uploadProductImage: vi.fn(), deactivateProduct: vi.fn(), reactivateProduct: vi.fn(), restockProduct: vi.fn(),
  },
}))

const ID = '0190a5f0-7c3e-7000-8000-00000000000a'
const scanned = makeProduct({ id: ID, name: 'Playera lisa', brand: 'Nike', presentation: 'XL', purchaseCostMinor: 9000, stock: 4 })

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.clearAllMocks()
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock')
  globalThis.URL.revokeObjectURL = vi.fn()
  vi.mocked(ProductsService.listProducts).mockResolvedValue({ items: [makeProduct()], total: 1, page: 1, limit: 20 })
  vi.mocked(ProductsService.getSuggestions).mockResolvedValue({ brands: [], presentations: [] })
  vi.mocked(ProductsService.getProduct).mockResolvedValue(scanned)
})

async function mountView(role: 'socio' | 'colaborador' = 'socio', venta = false) {
  useSessionStore().setMember({ id: 'm-1', name: 'Ana', role, active: true })
  if (venta) useUiModeStore().setMode('venta')
  const wrapper = mount(ProductCatalogView, { global: { stubs: { teleport: true } } })
  await flushPromises()
  return wrapper
}
async function openScanner(wrapper: Awaited<ReturnType<typeof mountView>>) {
  let onDecode: (text: string) => void = () => undefined
  startQrScanner.mockImplementation(async (_v: HTMLVideoElement, cb: (text: string) => void) => {
    onDecode = cb
    return { stop: vi.fn() }
  })
  await wrapper.findAll('button').find((b) => b.text() === 'Escanear QR')!.trigger('click')
  await flushPromises()
  return { read: async (text: string) => { onDecode(text); await flushPromises() } }
}
const hasScanButton = (w: Awaited<ReturnType<typeof mountView>>) => w.findAll('button').some((b) => b.text() === 'Escanear QR')

describe('Productos — Escanear QR', () => {
  it('un socio ve el botón; un colaborador no; en Modo Venta tampoco', async () => {
    expect(hasScanButton(await mountView('socio'))).toBe(true)
    expect(hasScanButton(await mountView('colaborador'))).toBe(false)
    expect(hasScanButton(await mountView('socio', true))).toBe(false)
  })

  it('abre el escáner en modo ficha fijo: sin control de modo y con la pista de la ficha', async () => {
    const wrapper = await mountView()
    await openScanner(wrapper)

    expect(wrapper.text()).toContain('Escanear producto')
    expect(wrapper.find('.segmented-control').exists()).toBe(false)
    expect(wrapper.text()).toContain('ver su ficha')
  })

  it('al leer un QR pide el producto y abre su ficha con costo, Editar y Reponer, sin Agregar', async () => {
    const wrapper = await mountView()
    const scanner = await openScanner(wrapper)

    await scanner.read(ID)

    expect(ProductsService.getProduct).toHaveBeenCalledWith(ID)
    const sheet = wrapper.get('.product-sheet')
    expect(sheet.text()).toContain('Playera lisa')
    expect(sheet.text()).toContain('$90.00')
    const buttons = wrapper.findAll('.product-sheet__actions button').map((b) => b.text())
    expect(buttons).toEqual(expect.arrayContaining(['Editar', 'Reponer']))
    expect(buttons).not.toContain('Agregar a la venta')
  })

  it('un código que no es de un producto: aviso rojo y no pide nada al servidor', async () => {
    const wrapper = await mountView()
    const scanner = await openScanner(wrapper)

    await scanner.read('https://cualquier-cosa.example/qr')

    expect(ProductsService.getProduct).not.toHaveBeenCalled()
    expect(wrapper.find('.product-sheet').exists()).toBe(false)
    expect(wrapper.get('.scan-toast .scan-toast__text').text()).toContain('No encontré este producto')
  })

  it('un producto que el servidor no encuentra (404): el mismo aviso rojo', async () => {
    vi.mocked(ProductsService.getProduct).mockRejectedValue({ response: { status: 404 } })
    const wrapper = await mountView()
    const scanner = await openScanner(wrapper)

    await scanner.read(ID)

    expect(wrapper.find('.product-sheet').exists()).toBe(false)
    expect(wrapper.get('.scan-toast .scan-toast__text').text()).toContain('No encontré este producto')
  })

  it('Editar abre el formulario de edición con ese producto', async () => {
    const wrapper = await mountView()
    const scanner = await openScanner(wrapper)
    await scanner.read(ID)

    await wrapper.findAll('.product-sheet__actions button').find((b) => b.text() === 'Editar')!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Editar producto')
  })

  it('Reponer abre el modal de reposición de ese producto', async () => {
    const wrapper = await mountView()
    const scanner = await openScanner(wrapper)
    await scanner.read(ID)

    await wrapper.findAll('.product-sheet__actions button').find((b) => b.text() === 'Reponer')!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Reponer existencia')
  })
})
