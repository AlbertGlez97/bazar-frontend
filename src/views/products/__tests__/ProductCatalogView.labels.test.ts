import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import ProductCatalogView from '../ProductCatalogView.vue'
import ProductsService from '@/services/products.service'
import { useSessionStore } from '@/stores/session.store'
import { useUiModeStore } from '@/stores/uiMode.store'
import { useProductSelectionStore } from '@/stores/product-selection.store'
import { useLabelCalibrationStore } from '@/stores/label-calibration.store'
import { useToastStore } from '@/stores/toast.store'
import { VOICE } from '@/config/voice'
import type { Product } from '@/types/product.types'

vi.mock('@/services/products.service', () => ({
  default: { listProducts: vi.fn(), createProduct: vi.fn(), updateProduct: vi.fn(), uploadProductImage: vi.fn(), deactivateProduct: vi.fn(), reactivateProduct: vi.fn() },
}))

const printing = vi.hoisted(() => ({ preview: vi.fn(), download: vi.fn() }))
vi.mock('@/composables/useLabelPrinting', () => ({
  useLabelPrinting: () => ({ busy: ref(null), error: ref(''), preview: printing.preview, download: printing.download }),
}))

const id = (n: number) => `01a0ddd7-7f00-744a-8b23-${String(n).padStart(12, '0')}`
const product = (n: number, overrides: Partial<Product> = {}): Product => ({
  id: id(n), name: `Producto ${n}`, tipo: 'unica', unitPriceMinor: 1000, initialStock: 1, stock: 1, category: null, purchaseCostMinor: null,
  supplier: null, notes: null, createdAt: '2026-01-01T00:00:00.000Z', active: true, image: null, ...overrides,
})

const mountOptions = { global: { stubs: { teleport: true } } }
const setMember = (role: 'socio' | 'colaborador') => useSessionStore().setMember({ id: 'm-1', name: 'Ana', role, active: true })
const button = (wrapper: ReturnType<typeof mount>, label: string) => wrapper.findAll('button').find((b) => b.text().includes(label))
const boxes = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('.product-card input[type="checkbox"]')

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.clearAllMocks()
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock')
  globalThis.URL.revokeObjectURL = vi.fn()
  vi.mocked(ProductsService.listProducts).mockResolvedValue({ items: [product(1), product(2), product(3)], total: 3, page: 1, limit: 20 })
})

async function mountView(role: 'socio' | 'colaborador' = 'socio') {
  setMember(role)
  const wrapper = mount(ProductCatalogView, mountOptions)
  await vi.waitFor(() => expect(wrapper.text()).toContain('Producto 1'))
  return wrapper
}

describe('ProductCatalogView — selección para imprimir códigos QR', () => {
  it('socio y colaborador ven el botón "Seleccionar" (imprimir es de solo lectura)', async () => {
    for (const role of ['socio', 'colaborador'] as const) {
      const wrapper = await mountView(role)
      expect(button(wrapper, VOICE.labels.select)).toBeTruthy()
    }
  })

  it('en Modo Venta no se ofrece', async () => {
    useUiModeStore().setMode('venta')
    const wrapper = await mountView()
    expect(button(wrapper, VOICE.labels.select)).toBeUndefined()
  })

  it('al entrar en modo selección aparecen las casillas y el contador; sin selección no hay "Imprimir"', async () => {
    const wrapper = await mountView()
    expect(boxes(wrapper)).toHaveLength(0)
    await button(wrapper, VOICE.labels.select)!.trigger('click')
    expect(boxes(wrapper)).toHaveLength(3)
    expect(wrapper.text()).toContain('0 seleccionados')
    expect(button(wrapper, VOICE.labels.print)).toBeUndefined()
  })

  it('marcar productos actualiza el contador y muestra "Imprimir códigos QR"', async () => {
    const wrapper = await mountView()
    await button(wrapper, VOICE.labels.select)!.trigger('click')
    await boxes(wrapper)[0]!.setValue(true)
    await boxes(wrapper)[2]!.setValue(true)
    expect(wrapper.text()).toContain('2 seleccionados')
    expect(button(wrapper, VOICE.labels.print)).toBeTruthy()
    await boxes(wrapper)[0]!.setValue(false)
    expect(wrapper.text()).toContain('1 seleccionado')
  })

  it('la selección se conserva al cambiar de página y de búsqueda', async () => {
    vi.mocked(ProductsService.listProducts).mockImplementation(async (params = {}) => ({
      items: (params.page ?? 1) === 2 ? [product(21), product(22)] : [product(1), product(2), product(3)], total: 25, page: params.page ?? 1, limit: 20,
    }))
    const wrapper = await mountView()
    await button(wrapper, VOICE.labels.select)!.trigger('click')
    await boxes(wrapper)[1]!.setValue(true)
    const store = useProductSelectionStore()
    expect(store.count).toBe(1)

    // Página 2: otros productos en pantalla; lo elegido en la página 1 sigue elegido.
    await wrapper.findComponent({ name: 'ProductCatalogGrid' }).vm.$emit('update:page', 2)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Producto 21'))
    expect(wrapper.text()).toContain('1 seleccionado')
    await boxes(wrapper)[0]!.setValue(true)
    expect(wrapper.text()).toContain('2 seleccionados')

    // Búsqueda nueva: sigue igual.
    await wrapper.findComponent({ name: 'ProductCatalogGrid' }).vm.$emit('search', 'zzz')
    await flushPromises()
    expect(store.count).toBe(2)
    expect(store.items.map((i) => i.id)).toEqual([id(2), id(21)])
  })

  it('"Seleccionar todos" trae todos los activos de todas las páginas y avisa cuántos', async () => {
    const wrapper = await mountView()
    await button(wrapper, VOICE.labels.select)!.trigger('click')
    const all = Array.from({ length: 230 }, (_, i) => product(100 + i))
    vi.mocked(ProductsService.listProducts).mockImplementation(async (params = {}) => {
      const page = params.page ?? 1
      const limit = params.limit ?? 20
      return { items: all.slice((page - 1) * limit, page * limit), total: all.length, page, limit }
    })
    await button(wrapper, VOICE.labels.selectAll)!.trigger('click')
    await vi.waitFor(() => expect(useProductSelectionStore().count).toBe(230))
    expect(wrapper.text()).toContain('230 seleccionados')
    // El aviso llega un tick después de que el store termina.
    await vi.waitFor(() => expect(useToastStore().toasts.some((t) => t.message === VOICE.labels.selectAllDone(230))).toBe(true))
  })

  it('si "Seleccionar todos" falla, muestra el motivo real y no cambia la selección', async () => {
    const wrapper = await mountView()
    await button(wrapper, VOICE.labels.select)!.trigger('click')
    vi.mocked(ProductsService.listProducts).mockRejectedValue({ isAxiosError: true, response: { status: 500, data: { message: 'boom' } } })
    await button(wrapper, VOICE.labels.selectAll)!.trigger('click')
    await vi.waitFor(() => expect(useToastStore().toasts.length).toBeGreaterThan(0))
    expect(useToastStore().toasts.at(-1)!.message).toContain(VOICE.labels.selectAllError)
    expect(useProductSelectionStore().count).toBe(0)
  })

  it('"Limpiar selección" y "Salir de la selección" vacían lo elegido', async () => {
    const wrapper = await mountView()
    await button(wrapper, VOICE.labels.select)!.trigger('click')
    await boxes(wrapper)[0]!.setValue(true)
    await button(wrapper, VOICE.labels.clear)!.trigger('click')
    expect(wrapper.text()).toContain('0 seleccionados')
    await boxes(wrapper)[0]!.setValue(true)
    await button(wrapper, VOICE.labels.exitSelection)!.trigger('click')
    expect(boxes(wrapper)).toHaveLength(0)
    expect(useProductSelectionStore().count).toBe(0)
  })

  it('"Imprimir códigos QR" abre el diálogo con el número de etiquetas', async () => {
    const wrapper = await mountView()
    await button(wrapper, VOICE.labels.select)!.trigger('click')
    for (const box of boxes(wrapper)) await box.setValue(true)
    await button(wrapper, VOICE.labels.print)!.trigger('click')
    expect(wrapper.text()).toContain(VOICE.labels.dialogTitle)
    expect(wrapper.text()).toContain('3 etiquetas')
    expect(wrapper.text()).toContain('1 hoja')
  })

  it('Vista previa y Descargar PDF generan con lo seleccionado, en el orden elegido', async () => {
    const wrapper = await mountView()
    await button(wrapper, VOICE.labels.select)!.trigger('click')
    await boxes(wrapper)[2]!.setValue(true)
    await boxes(wrapper)[0]!.setValue(true)
    await button(wrapper, VOICE.labels.print)!.trigger('click')
    await button(wrapper, VOICE.labels.preview)!.trigger('click')
    await button(wrapper, VOICE.labels.download)!.trigger('click')
    const expected = [{ id: id(3), name: 'Producto 3' }, { id: id(1), name: 'Producto 1' }]
    expect(printing.preview).toHaveBeenCalledWith(expected)
    expect(printing.download).toHaveBeenCalledWith(expected)
  })

  it('los ajustes del diálogo se guardan en la calibración y persisten', async () => {
    const wrapper = await mountView()
    await button(wrapper, VOICE.labels.select)!.trigger('click')
    await boxes(wrapper)[0]!.setValue(true)
    await button(wrapper, VOICE.labels.print)!.trigger('click')
    const input = wrapper.findAll('label').find((l) => l.text().includes(VOICE.labels.offsetTop))!.element.parentElement!.querySelector('input') as HTMLInputElement
    input.value = '1.5'
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(useLabelCalibrationStore().calibration.offsetTopMm).toBe(1.5)
    expect(JSON.parse(localStorage.getItem('la-marchanta-label-calibration')!).offsetTopMm).toBe(1.5)
    await button(wrapper, VOICE.labels.reset)!.trigger('click')
    expect(useLabelCalibrationStore().calibration.offsetTopMm).toBe(0)
  })

  it('al salir de la pantalla se descarta la selección (no queda "colgada" al volver)', async () => {
    const wrapper = await mountView()
    await button(wrapper, VOICE.labels.select)!.trigger('click')
    await boxes(wrapper)[0]!.setValue(true)
    expect(useProductSelectionStore().count).toBe(1)
    wrapper.unmount()
    expect(useProductSelectionStore().count).toBe(0)
    expect(useProductSelectionStore().active).toBe(false)
  })

  it('al cambiar a Modo Venta sale del modo selección (imprimir etiquetas es gestión)', async () => {
    const wrapper = await mountView()
    await button(wrapper, VOICE.labels.select)!.trigger('click')
    await boxes(wrapper)[0]!.setValue(true)
    useUiModeStore().setMode('venta')
    await flushPromises()
    expect(useProductSelectionStore().active).toBe(false)
    expect(useProductSelectionStore().count).toBe(0)
    expect(button(wrapper, VOICE.labels.select)).toBeUndefined()
  })

  it('un colaborador puede imprimir (no toca el catálogo)', async () => {
    const wrapper = await mountView('colaborador')
    await button(wrapper, VOICE.labels.select)!.trigger('click')
    await boxes(wrapper)[0]!.setValue(true)
    await button(wrapper, VOICE.labels.print)!.trigger('click')
    expect(wrapper.text()).toContain(VOICE.labels.dialogTitle)
  })
})
