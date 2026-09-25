import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useProductsStore } from '../products.store'
import ProductsService from '@/services/products.service'

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

const product = {
  id: 'p-1', name: 'Producto', tipo: 'cantidad', unitPriceMinor: 5000,
  initialStock: 10, stock: 10, category: null, purchaseCostMinor: null,
  supplier: null, notes: null, createdAt: '2026-01-01T00:00:00.000Z',
  active: true, image: null,
}
const listResponse = { items: [product], total: 1, page: 1, limit: 20 }

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('products.store', () => {
  it('fetchProducts actualiza items/total/page/limit desde la respuesta', async () => {
    vi.mocked(ProductsService.listProducts).mockResolvedValue(listResponse)
    const store = useProductsStore()

    const pending = store.fetchProducts()
    expect(store.loading).toBe(true)
    await pending

    expect(store.loading).toBe(false)
    expect(store.items).toEqual([product])
    expect(store.total).toBe(1)
    expect(store.page).toBe(1)
    expect(store.error).toBeNull()
  })

  it('fetchProducts guarda page/search/includeInactive como filtros activos', async () => {
    // El store adopta el `page` normalizado que devuelve el servidor, así que
    // el mock debe ecoar la página pedida como haría la API real.
    vi.mocked(ProductsService.listProducts).mockResolvedValue({ ...listResponse, page: 2 })
    const store = useProductsStore()

    await store.fetchProducts({ page: 2, search: 'ps5', includeInactive: true })

    expect(ProductsService.listProducts).toHaveBeenCalledExactlyOnceWith({
      page: 2, limit: 20, search: 'ps5', includeInactive: true,
    })
    expect(store.page).toBe(2)
    expect(store.search).toBe('ps5')
    expect(store.includeInactive).toBe(true)
  })

  it('fetchProducts expone un error legible y relanza la excepción', async () => {
    vi.mocked(ProductsService.listProducts).mockRejectedValue(new Error('network'))
    const store = useProductsStore()

    await expect(store.fetchProducts()).rejects.toThrow('network')
    expect(store.loading).toBe(false)
    expect(store.error).toBe('No se pudo cargar el catálogo de productos')
  })

  it('totalPages se calcula a partir de total y limit (mínimo 1)', async () => {
    vi.mocked(ProductsService.listProducts).mockResolvedValue({ ...listResponse, total: 45, limit: 20 })
    const store = useProductsStore()
    await store.fetchProducts()
    expect(store.totalPages).toBe(3)
  })

  it('createProduct crea el producto y refresca el listado', async () => {
    vi.mocked(ProductsService.createProduct).mockResolvedValue(product)
    vi.mocked(ProductsService.listProducts).mockResolvedValue(listResponse)
    const store = useProductsStore()

    const created = await store.createProduct({ name: 'Producto', tipo: 'cantidad', unitPriceMinor: 5000, initialStock: 10 })

    expect(created).toEqual(product)
    expect(ProductsService.listProducts).toHaveBeenCalledOnce()
  })

  it('updateProduct edita y refresca el listado', async () => {
    vi.mocked(ProductsService.updateProduct).mockResolvedValue({ ...product, name: 'Editado' })
    vi.mocked(ProductsService.listProducts).mockResolvedValue(listResponse)
    const store = useProductsStore()

    const updated = await store.updateProduct('p-1', { name: 'Editado' })

    expect(updated.name).toBe('Editado')
    expect(ProductsService.updateProduct).toHaveBeenCalledExactlyOnceWith('p-1', { name: 'Editado' })
  })

  it('uploadProductImage sube la imagen y refresca el listado', async () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    vi.mocked(ProductsService.uploadProductImage).mockResolvedValue({ ...product, image: '/uploads/products/a.png' })
    vi.mocked(ProductsService.listProducts).mockResolvedValue(listResponse)
    const store = useProductsStore()

    const updated = await store.uploadProductImage('p-1', file)

    expect(updated.image).toBe('/uploads/products/a.png')
    expect(ProductsService.uploadProductImage).toHaveBeenCalledExactlyOnceWith('p-1', file)
  })

  it('deactivateProduct desactiva y refresca el listado', async () => {
    vi.mocked(ProductsService.deactivateProduct).mockResolvedValue({ ...product, active: false })
    vi.mocked(ProductsService.listProducts).mockResolvedValue(listResponse)
    const store = useProductsStore()

    const deactivated = await store.deactivateProduct('p-1')

    expect(deactivated.active).toBe(false)
    expect(ProductsService.deactivateProduct).toHaveBeenCalledExactlyOnceWith('p-1')
  })

  it('reactivateProduct reactiva y refresca el listado', async () => {
    vi.mocked(ProductsService.reactivateProduct).mockResolvedValue({ ...product, active: true })
    vi.mocked(ProductsService.listProducts).mockResolvedValue(listResponse)
    const store = useProductsStore()

    const reactivated = await store.reactivateProduct('p-1')

    expect(reactivated.active).toBe(true)
    expect(ProductsService.reactivateProduct).toHaveBeenCalledExactlyOnceWith('p-1')
  })
})
