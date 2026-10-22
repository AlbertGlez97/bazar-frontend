import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ProductCatalogView from '../ProductCatalogView.vue'
import ProductsService from '@/services/products.service'
import { useSessionStore } from '@/stores/session.store'
import { useUiModeStore } from '@/stores/uiMode.store'
import { useCatalogExportStore } from '@/stores/catalog-export.store'
import { CATALOG_SETTINGS_STORAGE_KEY } from '@/utils/catalog-export-settings'
import { VOICE } from '@/config/voice'
import { makeProduct } from '@/test/factories'
import { saveBlob } from '@/utils/report-files'

vi.mock('@/services/products.service', () => ({
  default: { listProducts: vi.fn(), getSuggestions: vi.fn() },
}))
vi.mock('@/utils/report-files', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/utils/report-files')>()), saveBlob: vi.fn() }))

// jsdom no tiene canvas: el marcador y la reducción de fotos se prueban aparte (catalog-images.test.ts).
vi.mock('@/services/catalog-images', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/catalog-images')>()),
  processCatalogImages: vi.fn(async () => new Map()),
  makePlaceholder: vi.fn(async () => ({ bytes: new Uint8Array([1]), width: 400, height: 300, placeholder: true })),
}))

const docx = vi.hoisted(() => ({ generateCatalogDocx: vi.fn() }))
vi.mock('@/services/catalog-docx', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/catalog-docx')>()),
  generateCatalogDocx: docx.generateCatalogDocx,
}))

const mountOptions = { global: { stubs: { teleport: true } } }
const setMember = (role: 'socio' | 'colaborador') => useSessionStore().setMember({ id: 'm-1', name: 'Ana', role, active: true })
const button = (wrapper: ReturnType<typeof mount>, label: string) => wrapper.findAll('button').find((b) => b.text().includes(label))
const setOnline = (value: boolean) => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value })

const products = [
  makeProduct({ name: 'Playera', category: 'Ropa', presentation: 'S', purchaseCostMinor: 5000, supplier: 'Secreto SA' }),
  makeProduct({ name: 'Playera', category: 'Ropa', presentation: 'M', purchaseCostMinor: 5000, supplier: 'Secreto SA' }),
  makeProduct({ name: 'Taza', category: null }),
]

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.clearAllMocks()
  setOnline(true)
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock')
  globalThis.URL.revokeObjectURL = vi.fn()
  vi.mocked(ProductsService.listProducts).mockResolvedValue({ items: products, total: 3, page: 1, limit: 20 })
  vi.mocked(ProductsService.getSuggestions).mockResolvedValue({ brands: [], presentations: [], categories: ['Ropa'] })
  docx.generateCatalogDocx.mockResolvedValue({ blob: new Blob(['docx']), bytes: new Uint8Array([1]) })
})
afterEach(() => setOnline(true))

async function mountView(role: 'socio' | 'colaborador' = 'socio') {
  setMember(role)
  const wrapper = mount(ProductCatalogView, mountOptions)
  await vi.waitFor(() => expect(wrapper.text()).toContain('Playera'))
  return wrapper
}

describe('ProductCatalogView — Generar catálogo: acceso', () => {
  it('un socio en Gestión ve el botón', async () => {
    expect(button(await mountView('socio'), VOICE.catalogExport.open)).toBeTruthy()
  })

  it('un colaborador no ve el botón ni el diálogo, y no se baja nada para el catálogo', async () => {
    const wrapper = await mountView('colaborador')
    expect(button(wrapper, VOICE.catalogExport.open)).toBeUndefined()
    expect(wrapper.text()).not.toContain(VOICE.catalogExport.title)
    expect(wrapper.findComponent({ name: 'CatalogExportDialog' }).exists()).toBe(false)
  })

  it('en Modo Venta no se ofrece, ni siquiera a un socio', async () => {
    useUiModeStore().setMode('venta')
    const wrapper = await mountView('socio')
    expect(button(wrapper, VOICE.catalogExport.open)).toBeUndefined()
    expect(wrapper.findComponent({ name: 'CatalogExportDialog' }).exists()).toBe(false)
  })
})

describe('ProductCatalogView — Generar catálogo: flujo', () => {
  async function openDialog() {
    const wrapper = await mountView()
    vi.mocked(ProductsService.listProducts).mockClear()
    await button(wrapper, VOICE.catalogExport.open)!.trigger('click')
    await flushPromises()
    return wrapper
  }

  it('al abrir baja los productos (de a 100) y muestra el resumen', async () => {
    const wrapper = await openDialog()
    expect(ProductsService.listProducts).toHaveBeenCalledWith({ page: 1, limit: 100 })
    expect(wrapper.text()).toContain(VOICE.catalogExport.title)
    expect(wrapper.text()).toContain(VOICE.catalogExport.summary(2, 1, 0, 2))
  })

  it('"Generar catálogo" arma el Word con el nombre del negocio y lo descarga; el diálogo se cierra', async () => {
    const wrapper = await openDialog()
    const generate = wrapper.findAll('.catalog-export__actions button').find((b) => b.text().includes(VOICE.catalogExport.generate))!
    await generate.trigger('click')
    await vi.waitFor(() => expect(saveBlob).toHaveBeenCalledTimes(1))
    expect(docx.generateCatalogDocx).toHaveBeenCalledTimes(1)
    expect(vi.mocked(saveBlob).mock.calls[0]![1]).toMatch(/^Catalogo - .+ - \d{4}-\d{2}-\d{2}\.docx$/)
    await vi.waitFor(() => expect(wrapper.findComponent({ name: 'CatalogExportDialog' }).props('modelValue')).toBe(false))
  })

  it('el costo y el proveedor no llegan al generador', async () => {
    const wrapper = await openDialog()
    await wrapper.findAll('.catalog-export__actions button').find((b) => b.text().includes(VOICE.catalogExport.generate))!.trigger('click')
    await vi.waitFor(() => expect(docx.generateCatalogDocx).toHaveBeenCalled())
    const sent = JSON.stringify(docx.generateCatalogDocx.mock.calls[0])
    for (const forbidden of ['purchaseCost', 'supplier', 'Secreto SA', 'notes']) expect(sent).not.toContain(forbidden)
  })

  it('sin internet avisa, no baja productos y no deja generar', async () => {
    setOnline(false)
    const wrapper = await mountView()
    vi.mocked(ProductsService.listProducts).mockClear()
    await button(wrapper, VOICE.catalogExport.open)!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain(VOICE.catalogExport.offline)
    expect(ProductsService.listProducts).not.toHaveBeenCalled()
    expect(docx.generateCatalogDocx).not.toHaveBeenCalled()
  })
})

describe('ProductCatalogView — Generar catálogo: opciones recordadas', () => {
  it('lo que se elige en el diálogo se guarda y se recupera al recargar', async () => {
    const wrapper = await mountView()
    await button(wrapper, VOICE.catalogExport.open)!.trigger('click')
    await flushPromises()
    await wrapper.get('.catalog-export .segmented-control__btn[data-value="3"]').trigger('click')
    expect(useCatalogExportStore().settings.columns).toBe(3)
    expect(JSON.parse(localStorage.getItem(CATALOG_SETTINGS_STORAGE_KEY)!).settings.columns).toBe(3)

    wrapper.unmount()
    setActivePinia(createPinia()) // recargar: otro Pinia, la misma localStorage
    const again = await mountView()
    await button(again, VOICE.catalogExport.open)!.trigger('click')
    await flushPromises()
    expect(again.get('.catalog-export .segmented-control__btn[data-value="3"]').attributes('aria-pressed')).toBe('true')
  })

  it('"Restaurar sugeridos" vuelve a los valores de fábrica', async () => {
    useCatalogExportStore().set({ columns: 3, tableOfContents: true })
    const wrapper = await mountView()
    await button(wrapper, VOICE.catalogExport.open)!.trigger('click')
    await flushPromises()
    await button(wrapper, VOICE.catalogExport.restore)!.trigger('click')
    expect(useCatalogExportStore().settings.columns).toBe(2)
    expect(useCatalogExportStore().settings.tableOfContents).toBe(false)
  })
})
