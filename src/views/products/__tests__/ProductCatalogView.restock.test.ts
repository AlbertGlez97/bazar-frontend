import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ProductCatalogView from '../ProductCatalogView.vue'
import ProductsService from '@/services/products.service'
import { useSessionStore } from '@/stores/session.store'
import { useToastStore } from '@/stores/toast.store'
import { useUiModeStore } from '@/stores/uiMode.store'
import type { Product, RestockProductResult } from '@/types/product.types'

vi.mock('@/services/products.service', () => ({
  default: {
    listProducts: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    uploadProductImage: vi.fn(),
    deactivateProduct: vi.fn(),
    reactivateProduct: vi.fn(),
    restockProduct: vi.fn(),
  },
}))

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p-1', name: 'Lámpara', tipo: 'cantidad', unitPriceMinor: 5000, initialStock: 10, stock: 10,
  category: null, purchaseCostMinor: 1000, supplier: null, notes: null,
  createdAt: '2026-01-01T00:00:00.000Z', active: true, image: null, ...overrides,
})

const restockResult = (stock = 12): RestockProductResult => ({
  product: product({ stock }),
  movement: {
    id: 'm-1', productId: 'p-1', memberId: 'm-1', type: 'REPOSICION', quantity: 2,
    stockBefore: stock - 2, stockAfter: stock, unitCostMinor: null, note: null,
    createdAt: '2026-10-15T12:00:00.000Z', contextId: 'ctx',
  },
})

const httpError = (status: number, message?: string) => ({
  isAxiosError: true, message: `Request failed with status code ${status}`, response: { status, data: message ? { message } : undefined },
})

type ViewWrapper = ReturnType<typeof mount>

const mountView = () => mount(ProductCatalogView, { global: { stubs: { teleport: true } } })
const setMember = (role: 'socio' | 'colaborador') =>
  useSessionStore().setMember({ id: 'm-1', name: 'Ana', role, active: true })
const toasts = () => useToastStore().toasts.map((t) => t.message)
const restockButtons = (w: ViewWrapper) => w.findAll('button').filter((b) => b.text() === 'Reponer')
const restockDialog = (w: ViewWrapper) => w.findAll('[role="dialog"]').find((d) => d.text().includes('Reponer existencia') && d.find('form').exists() && d.text().includes('Piezas que compraste'))
const submitButton = (w: ViewWrapper) => restockDialog(w)!.get('button[type="submit"]')

async function mountWithProduct(overrides: Partial<Product> = {}) {
  setMember('socio')
  vi.mocked(ProductsService.listProducts).mockResolvedValue({ items: [product(overrides)], total: 1, page: 1, limit: 20 })
  const wrapper = mountView()
  await vi.waitFor(() => expect(wrapper.find('.product-card').exists()).toBe(true))
  return wrapper
}

async function openRestockFromCard(wrapper: ViewWrapper) {
  await restockButtons(wrapper)[0]!.trigger('click')
  await vi.waitFor(() => expect(restockDialog(wrapper)).toBeDefined())
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.clearAllMocks()
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock')
  globalThis.URL.revokeObjectURL = vi.fn()
})

describe('ProductCatalogView — Reponer existencia', () => {
  describe('quién la ve', () => {
    it('un socio en Gestión ve "Reponer" en los productos por cantidad', async () => {
      const wrapper = await mountWithProduct()

      expect(restockButtons(wrapper)).toHaveLength(1)
    })

    it('un colaborador no la ve (el servidor respondería 403)', async () => {
      setMember('colaborador')
      vi.mocked(ProductsService.listProducts).mockResolvedValue({ items: [product()], total: 1, page: 1, limit: 20 })
      const wrapper = mountView()
      await vi.waitFor(() => expect(wrapper.find('.product-card').exists()).toBe(true))

      expect(restockButtons(wrapper)).toHaveLength(0)
    })

    it('en Modo Venta no existe', async () => {
      setMember('socio')
      useUiModeStore().setMode('venta')
      vi.mocked(ProductsService.listProducts).mockResolvedValue({ items: [product()], total: 1, page: 1, limit: 20 })
      const wrapper = mountView()
      await vi.waitFor(() => expect(wrapper.find('.product-card').exists()).toBe(true))

      expect(restockButtons(wrapper)).toHaveLength(0)
    })

    it('una pieza única no se repone', async () => {
      const wrapper = await mountWithProduct({ tipo: 'unica', stock: 0 })

      expect(restockButtons(wrapper)).toHaveLength(0)
    })
  })

  describe('desde la tarjeta', () => {
    it('abre el modal con el producto y su existencia', async () => {
      const wrapper = await mountWithProduct({ stock: 10 })

      await openRestockFromCard(wrapper)

      expect(restockDialog(wrapper)!.text()).toContain('Lámpara')
      expect(restockDialog(wrapper)!.text()).toContain('Existencia actual: 10')
    })

    it('repone: manda la cantidad al servidor, avisa y cierra', async () => {
      const wrapper = await mountWithProduct()
      vi.mocked(ProductsService.restockProduct).mockResolvedValue(restockResult(12))
      await openRestockFromCard(wrapper)
      await restockDialog(wrapper)!.get('button[data-action="increment"]').trigger('click')

      await restockDialog(wrapper)!.get('form').trigger('submit')

      await vi.waitFor(() => expect(ProductsService.restockProduct).toHaveBeenCalledExactlyOnceWith('p-1', { quantity: 2 }))
      await vi.waitFor(() => expect(toasts()).toContain('Listo, ahora hay 12 de «Lámpara».'))
      expect(restockDialog(wrapper)).toBeUndefined()
    })

    it('manda también el costo (en centavos) y la nota', async () => {
      const wrapper = await mountWithProduct()
      vi.mocked(ProductsService.restockProduct).mockResolvedValue(restockResult())
      await openRestockFromCard(wrapper)
      await restockDialog(wrapper)!.get('input[inputmode="decimal"]').setValue('11.00')
      await restockDialog(wrapper)!.get('textarea').setValue('Compra del sábado')

      await restockDialog(wrapper)!.get('form').trigger('submit')

      await vi.waitFor(() => expect(ProductsService.restockProduct).toHaveBeenCalledWith('p-1', {
        quantity: 1, unitCostMinor: 1100, note: 'Compra del sábado',
      }))
    })

    it('refresca el catálogo para mostrar la existencia nueva', async () => {
      const wrapper = await mountWithProduct()
      vi.mocked(ProductsService.restockProduct).mockResolvedValue(restockResult())
      vi.mocked(ProductsService.listProducts).mockClear()
      await openRestockFromCard(wrapper)

      await restockDialog(wrapper)!.get('form').trigger('submit')

      await vi.waitFor(() => expect(ProductsService.listProducts).toHaveBeenCalled())
    })

    it('un dato inválido no llega al servidor', async () => {
      const wrapper = await mountWithProduct()
      await openRestockFromCard(wrapper)
      await restockDialog(wrapper)!.get('input[inputmode="decimal"]').setValue('abc')

      await restockDialog(wrapper)!.get('form').trigger('submit')

      expect(ProductsService.restockProduct).not.toHaveBeenCalled()
      expect(restockDialog(wrapper)).toBeDefined()
    })
  })

  describe('mientras se envía (sin doble clic)', () => {
    it('deshabilita el botón y un segundo envío no repite la petición', async () => {
      const wrapper = await mountWithProduct()
      let finish!: (value: RestockProductResult) => void
      vi.mocked(ProductsService.restockProduct).mockReturnValue(new Promise((resolve) => { finish = resolve }))
      await openRestockFromCard(wrapper)

      await restockDialog(wrapper)!.get('form').trigger('submit')
      await vi.waitFor(() => expect(submitButton(wrapper).attributes('disabled')).toBeDefined())
      await restockDialog(wrapper)!.get('form').trigger('submit')
      await restockDialog(wrapper)!.get('form').trigger('submit')

      expect(ProductsService.restockProduct).toHaveBeenCalledTimes(1)

      finish(restockResult())
      await vi.waitFor(() => expect(restockDialog(wrapper)).toBeUndefined())
    })

    it('al terminar con error el botón vuelve a estar disponible para reintentar', async () => {
      const wrapper = await mountWithProduct()
      vi.mocked(ProductsService.restockProduct).mockRejectedValue(httpError(500))
      await openRestockFromCard(wrapper)

      await restockDialog(wrapper)!.get('form').trigger('submit')

      await vi.waitFor(() => expect(submitButton(wrapper).attributes('disabled')).toBeUndefined())
    })
  })

  describe('si el servidor rechaza', () => {
    it('avisa con el motivo y deja el modal abierto para corregir', async () => {
      const wrapper = await mountWithProduct()
      vi.mocked(ProductsService.restockProduct)
        .mockRejectedValue(httpError(400, 'The resulting stock would exceed the maximum allowed'))
      await openRestockFromCard(wrapper)

      await restockDialog(wrapper)!.get('form').trigger('submit')

      await vi.waitFor(() => expect(toasts().at(-1)).toContain('No pudimos reponer la existencia.'))
      expect(toasts().at(-1)).toContain('máximo permitido')
      expect(toasts().at(-1)).toContain('(código 400)')
      expect(restockDialog(wrapper)).toBeDefined()
    })

    it('sin internet lo dice (Gestión necesita conexión; no se encola)', async () => {
      const wrapper = await mountWithProduct()
      vi.mocked(ProductsService.restockProduct).mockRejectedValue({ isAxiosError: true, message: 'Network Error', request: {} })
      await openRestockFromCard(wrapper)

      await restockDialog(wrapper)!.get('form').trigger('submit')

      await vi.waitFor(() => expect(toasts().at(-1)).toContain('No pudimos reponer la existencia.'))
      expect(restockDialog(wrapper)).toBeDefined()
    })

    it('un producto que ya no existe (404) también se avisa', async () => {
      const wrapper = await mountWithProduct()
      vi.mocked(ProductsService.restockProduct).mockRejectedValue(httpError(404, 'Not Found'))
      await openRestockFromCard(wrapper)

      await restockDialog(wrapper)!.get('form').trigger('submit')

      await vi.waitFor(() => expect(toasts().at(-1)).toContain('(código 404)'))
    })
  })

  describe('desde el modal de edición', () => {
    async function openEditThenRestock(wrapper: ViewWrapper) {
      await wrapper.findAll('button').find((b) => b.text() === 'Editar')!.trigger('click')
      await vi.waitFor(() => expect(wrapper.text()).toContain('Editar producto'))
      await wrapper.findAll('button').find((b) => b.text() === 'Reponer existencia')!.trigger('click')
    }

    it('cierra la edición y abre la reposición (no se apilan dos modales)', async () => {
      const wrapper = await mountWithProduct()

      await openEditThenRestock(wrapper)

      await vi.waitFor(() => expect(restockDialog(wrapper)).toBeDefined())
      expect(wrapper.text()).not.toContain('Editar producto')
    })

    it('repone igual que desde la tarjeta', async () => {
      const wrapper = await mountWithProduct()
      vi.mocked(ProductsService.restockProduct).mockResolvedValue(restockResult(15))
      await openEditThenRestock(wrapper)
      await vi.waitFor(() => expect(restockDialog(wrapper)).toBeDefined())

      await restockDialog(wrapper)!.get('form').trigger('submit')

      await vi.waitFor(() => expect(ProductsService.restockProduct).toHaveBeenCalledWith('p-1', { quantity: 1 }))
    })
  })
})
