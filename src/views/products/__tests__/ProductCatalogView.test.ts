import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ProductCatalogView from '../ProductCatalogView.vue'
import ProductsService from '@/services/products.service'
import { useSessionStore } from '@/stores/session.store'
import type { Product } from '@/types/product.types'

vi.mock('@/services/products.service', () => ({
  default: {
    listProducts: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    uploadProductImage: vi.fn(),
    deactivateProduct: vi.fn(),
    reactivateProduct: vi.fn(),
  },
}))

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p-1',
  name: 'Producto',
  tipo: 'unica',
  unitPriceMinor: 1000,
  initialStock: 1,
  stock: 1,
  category: null,
  purchaseCostMinor: null,
  supplier: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  active: true,
  image: null,
  ...overrides,
})

// AppModal usa <Teleport to="body">: se stubea para que el contenido del modal
// quede dentro del wrapper y sea consultable desde el test.
const mountOptions = { global: { stubs: { teleport: true } } }

function setMember(role: 'socio' | 'colaborador') {
  useSessionStore().setMember({ id: 'm-1', name: 'Ana', role, active: true })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock')
  globalThis.URL.revokeObjectURL = vi.fn()
  vi.mocked(ProductsService.listProducts).mockResolvedValue({ items: [product()], total: 1, page: 1, limit: 20 })
})

describe('ProductCatalogView', () => {
  it('carga el catálogo al montar', async () => {
    setMember('socio')
    mount(ProductCatalogView, mountOptions)
    await vi.waitFor(() => expect(ProductsService.listProducts).toHaveBeenCalled())
  })

  it('muestra el botón "Nuevo producto" para socios', async () => {
    setMember('socio')
    const wrapper = mount(ProductCatalogView, mountOptions)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Nuevo producto'))
  })

  it('oculta el botón "Nuevo producto" para colaboradores', async () => {
    setMember('colaborador')
    const wrapper = mount(ProductCatalogView, mountOptions)
    await vi.waitFor(() => expect(ProductsService.listProducts).toHaveBeenCalled())
    expect(wrapper.text()).not.toContain('Nuevo producto')
  })

  it('no muestra acciones de gestión en las tarjetas para colaboradores', async () => {
    setMember('colaborador')
    const wrapper = mount(ProductCatalogView, mountOptions)
    await vi.waitFor(() => expect(ProductsService.listProducts).toHaveBeenCalled())
    expect(wrapper.find('.product-card__footer').exists()).toBe(false)
  })

  it('crea un producto y sube la imagen en una segunda llamada', async () => {
    setMember('socio')
    vi.mocked(ProductsService.createProduct).mockResolvedValue(product({ id: 'p-new' }))
    vi.mocked(ProductsService.uploadProductImage).mockResolvedValue(product({ id: 'p-new', image: '/uploads/x.png' }))

    const wrapper = mount(ProductCatalogView, mountOptions)
    await vi.waitFor(() => expect(ProductsService.listProducts).toHaveBeenCalled())

    const newButton = wrapper.findAll('button').find((b) => b.text().includes('Nuevo producto'))
    await newButton?.trigger('click')

    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const fileInput = wrapper.find('input[type="file"]').element as HTMLInputElement
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
    await wrapper.find('input[type="file"]').trigger('change')

    // El primer <input> de la vista es el buscador del grid, no el nombre.
    await wrapper.find('input[placeholder="Ej. Consola PS5 usada"]').setValue('Producto nuevo')
    const priceInput = wrapper.findAll('input').find((i) => i.attributes('inputmode') === 'decimal')
    await priceInput?.setValue('10.00')

    await wrapper.find('form').trigger('submit')
    await vi.waitFor(() => expect(ProductsService.createProduct).toHaveBeenCalled())
    await vi.waitFor(() => expect(ProductsService.uploadProductImage).toHaveBeenCalledWith('p-new', file))
  })

  it('avisa con un toast si la imagen falla, sin revertir el producto creado', async () => {
    setMember('socio')
    vi.mocked(ProductsService.createProduct).mockResolvedValue(product({ id: 'p-new' }))
    vi.mocked(ProductsService.uploadProductImage).mockRejectedValue(new Error('boom'))

    const wrapper = mount(ProductCatalogView, mountOptions)
    await vi.waitFor(() => expect(ProductsService.listProducts).toHaveBeenCalled())

    const newButton = wrapper.findAll('button').find((b) => b.text().includes('Nuevo producto'))
    await newButton?.trigger('click')

    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const fileInput = wrapper.find('input[type="file"]').element as HTMLInputElement
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
    await wrapper.find('input[type="file"]').trigger('change')

    // El primer <input> de la vista es el buscador del grid, no el nombre.
    await wrapper.find('input[placeholder="Ej. Consola PS5 usada"]').setValue('Producto nuevo')
    const priceInput = wrapper.findAll('input').find((i) => i.attributes('inputmode') === 'decimal')
    await priceInput?.setValue('10.00')

    await wrapper.find('form').trigger('submit')
    await vi.waitFor(() => expect(ProductsService.uploadProductImage).toHaveBeenCalled())
    expect(ProductsService.createProduct).toHaveBeenCalledOnce()
  })

  it('pide confirmación antes de desactivar y llama al servicio al confirmar', async () => {
    setMember('socio')
    vi.mocked(ProductsService.deactivateProduct).mockResolvedValue(product({ active: false }))

    const wrapper = mount(ProductCatalogView, mountOptions)
    // No basta con que listProducts se haya llamado: hay que esperar a que la
    // respuesta se renderice como tarjeta (si no, el botón aún no existe).
    await vi.waitFor(() => expect(wrapper.text()).toContain('Desactivar'))

    const deactivateButton = wrapper.findAll('button').find((b) => b.text() === 'Desactivar')
    await deactivateButton?.trigger('click')
    expect(ProductsService.deactivateProduct).not.toHaveBeenCalled()

    const confirmButton = wrapper.findAll('button').find((b) => b.text() === 'Sí, desactivar')
    await confirmButton?.trigger('click')
    await vi.waitFor(() => expect(ProductsService.deactivateProduct).toHaveBeenCalledWith('p-1'))
  })
})
