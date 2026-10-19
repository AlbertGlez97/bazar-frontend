import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { LOW_STOCK_UMBRAL, useProductsStore } from '../products.store'
import ProductsService from '@/services/products.service'
import type { Product } from '@/types/product.types'

vi.mock('@/services/products.service', () => ({
  default: {
    listProducts: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    uploadProductImage: vi.fn(),
    deactivateProduct: vi.fn(),
    reactivateProduct: vi.fn(),
    restockProduct: vi.fn(),
    getSuggestions: vi.fn(),
    fetchImageFile: vi.fn(),
    getProduct: vi.fn(),
  },
}))

const product: Product = {
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

  it('fetchProducts guarda agotados/sinCosto/tipo y los manda al servidor (el catálogo pagina allá)', async () => {
    const store = useProductsStore()

    await store.fetchProducts({ page: 1, agotados: true, sinCosto: true, tipo: 'unica' })

    expect(ProductsService.listProducts).toHaveBeenLastCalledWith(
      expect.objectContaining({ agotados: true, sinCosto: true, tipo: 'unica' }),
    )
    expect(store.agotados).toBe(true)
    expect(store.sinCosto).toBe(true)
    expect(store.tipo).toBe('unica')
  })

  it('los filtros nuevos se conservan al paginar o buscar sin repetirlos', async () => {
    const store = useProductsStore()
    await store.fetchProducts({ agotados: true, sinCosto: true, tipo: 'cantidad' })

    await store.fetchProducts({ page: 2 })

    expect(ProductsService.listProducts).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, agotados: true, sinCosto: true, tipo: 'cantidad' }),
    )
  })

  it('pasar undefined explícito apaga cada filtro nuevo (y no manda `false`)', async () => {
    const store = useProductsStore()
    await store.fetchProducts({ agotados: true, sinCosto: true, tipo: 'unica' })

    await store.fetchProducts({ agotados: undefined, sinCosto: undefined, tipo: undefined })

    const sent = vi.mocked(ProductsService.listProducts).mock.calls.at(-1)![0]!
    expect(sent.agotados).toBeUndefined()
    expect(sent.sinCosto).toBeUndefined()
    expect(sent.tipo).toBeUndefined()
    expect(store.agotados).toBe(false)
    expect(store.sinCosto).toBe(false)
    expect(store.tipo).toBeUndefined()
  })

  it('fetchProducts expone un error legible y relanza la excepción', async () => {
    vi.mocked(ProductsService.listProducts).mockRejectedValue(new Error('network'))
    const store = useProductsStore()

    await expect(store.fetchProducts()).rejects.toThrow('network')
    expect(store.loading).toBe(false)
    expect(store.error).toBe('No pudimos cargar tu catálogo. Intenta de nuevo.')
  })

  it('totalPages se calcula a partir de total y limit (mínimo 1)', async () => {
    vi.mocked(ProductsService.listProducts).mockResolvedValue({ ...listResponse, total: 45, limit: 20 })
    const store = useProductsStore()
    await store.fetchProducts()
    expect(store.totalPages).toBe(3)
  })

  it('si la página pedida quedó fuera de rango (se vació la última), reposiciona en la última existente', async () => {
    // Página 2 de 21 productos activos; se desactiva el único de la página 2:
    // la API responde página 2 vacía con total 20 (=1 sola página).
    vi.mocked(ProductsService.listProducts)
      .mockResolvedValueOnce({ items: [], total: 20, page: 2, limit: 20 })
      .mockResolvedValueOnce({ items: [product], total: 20, page: 1, limit: 20 })
    const store = useProductsStore()

    await store.fetchProducts({ page: 2 })

    expect(ProductsService.listProducts).toHaveBeenCalledTimes(2)
    expect(vi.mocked(ProductsService.listProducts).mock.calls[1][0]).toMatchObject({ page: 1 })
    expect(store.page).toBe(1)
    expect(store.items).toEqual([product])
    expect(store.totalPages).toBe(1)
  })

  it('una búsqueda sin resultados (total 0) no dispara un segundo request', async () => {
    vi.mocked(ProductsService.listProducts).mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 })
    const store = useProductsStore()

    await store.fetchProducts({ search: 'nada' })

    expect(ProductsService.listProducts).toHaveBeenCalledTimes(1)
    expect(store.items).toEqual([])
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

  describe('restockProduct', () => {
    const result = {
      product: { ...product, stock: 15 },
      movement: {
        id: 'm-1', productId: 'p-1', memberId: 'u-1', type: 'REPOSICION' as const, quantity: 5,
        stockBefore: 10, stockAfter: 15, unitCostMinor: null, note: null,
        createdAt: '2026-10-15T12:00:00.000Z', contextId: 'ctx',
      },
    }

    it('repone, refresca el listado con los filtros vigentes y devuelve producto y movimiento', async () => {
      vi.mocked(ProductsService.restockProduct).mockResolvedValue(result)
      vi.mocked(ProductsService.listProducts).mockResolvedValue(listResponse)
      const store = useProductsStore()
      await store.fetchProducts({ agotados: true, search: 'lám' })
      vi.mocked(ProductsService.listProducts).mockClear()

      const restocked = await store.restockProduct('p-1', { quantity: 5 })

      expect(restocked).toEqual(result)
      expect(ProductsService.restockProduct).toHaveBeenCalledExactlyOnceWith('p-1', { quantity: 5 })
      expect(ProductsService.listProducts).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ agotados: true, search: 'lám' }),
      )
    })

    it('si la reposición salió bien pero el refresco del listado falla, igual devuelve el resultado', async () => {
      // La reposición no es idempotente: decir "falló" por un refresco caído
      // invitaría a reintentar y a duplicar las piezas.
      vi.mocked(ProductsService.restockProduct).mockResolvedValue(result)
      vi.mocked(ProductsService.listProducts).mockRejectedValue(new Error('network'))
      const store = useProductsStore()

      await expect(store.restockProduct('p-1', { quantity: 5 })).resolves.toEqual(result)

      expect(store.error).toBe('No pudimos cargar tu catálogo. Intenta de nuevo.')
    })

    it('si el servidor rechaza, no refresca y relanza el error', async () => {
      const failure = new Error('400')
      vi.mocked(ProductsService.restockProduct).mockRejectedValue(failure)
      const store = useProductsStore()

      await expect(store.restockProduct('p-1', { quantity: 5 })).rejects.toBe(failure)

      expect(ProductsService.listProducts).not.toHaveBeenCalled()
    })
  })

  describe('filtro de poca existencia (umbral)', () => {
    it('sin pedirlo nunca manda "umbral" al backend', async () => {
      vi.mocked(ProductsService.listProducts).mockResolvedValue(listResponse)
      const store = useProductsStore()

      await store.fetchProducts()

      expect(ProductsService.listProducts).toHaveBeenCalledExactlyOnceWith({ page: 1, limit: 20 })
      expect(store.umbral).toBeUndefined()
    })

    it('fetchProducts con umbral lo guarda como filtro activo y lo manda al backend', async () => {
      vi.mocked(ProductsService.listProducts).mockResolvedValue(listResponse)
      const store = useProductsStore()

      await store.fetchProducts({ page: 1, umbral: LOW_STOCK_UMBRAL })

      expect(ProductsService.listProducts).toHaveBeenCalledExactlyOnceWith({ page: 1, limit: 20, umbral: 2 })
      expect(store.umbral).toBe(2)
    })

    it('paginar con el filtro activo lo sigue mandando (se guardó como filtro)', async () => {
      vi.mocked(ProductsService.listProducts).mockResolvedValue(listResponse)
      const store = useProductsStore()
      await store.fetchProducts({ umbral: LOW_STOCK_UMBRAL })
      vi.mocked(ProductsService.listProducts).mockClear()

      await store.fetchProducts({ page: 2 })

      expect(ProductsService.listProducts).toHaveBeenCalledExactlyOnceWith({ page: 2, limit: 20, umbral: 2 })
    })

    it('apagar el filtro (umbral: undefined explícito) deja de mandarlo', async () => {
      vi.mocked(ProductsService.listProducts).mockResolvedValue(listResponse)
      const store = useProductsStore()
      await store.fetchProducts({ umbral: LOW_STOCK_UMBRAL })
      vi.mocked(ProductsService.listProducts).mockClear()

      await store.fetchProducts({ page: 1, umbral: undefined })

      expect(ProductsService.listProducts).toHaveBeenCalledExactlyOnceWith({ page: 1, limit: 20 })
      expect(store.umbral).toBeUndefined()
    })
  })
})

describe('products.store — marca y sugerencias', () => {
  it('guarda la marca y la manda al servidor; se conserva al paginar', async () => {
    const store = useProductsStore()

    await store.fetchProducts({ brand: 'Nike' })
    await store.fetchProducts({ page: 2 })

    expect(ProductsService.listProducts).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, brand: 'Nike' }))
    expect(store.brand).toBe('Nike')
  })

  it('`brand: undefined` explícito la apaga', async () => {
    const store = useProductsStore()
    await store.fetchProducts({ brand: 'Nike' })

    await store.fetchProducts({ brand: undefined })

    expect(vi.mocked(ProductsService.listProducts).mock.calls.at(-1)![0]!.brand).toBeUndefined()
    expect(store.brand).toBeUndefined()
  })

  it('loadSuggestions guarda marcas y presentaciones', async () => {
    vi.mocked(ProductsService.getSuggestions).mockResolvedValue({ brands: ['Nike'], presentations: ['XL'] })
    const store = useProductsStore()

    await store.loadSuggestions()

    expect(store.brandSuggestions).toEqual(['Nike'])
    expect(store.presentationSuggestions).toEqual(['XL'])
  })

  it('si no se pueden traer, quedan vacías y no se lanza (las sugerencias son un extra)', async () => {
    vi.mocked(ProductsService.getSuggestions).mockRejectedValue(new Error('403'))
    const store = useProductsStore()

    await expect(store.loadSuggestions()).resolves.toBeUndefined()

    expect(store.brandSuggestions).toEqual([])
    expect(store.presentationSuggestions).toEqual([])
  })

  it('una sugerencia nueva (se acaba de crear un producto con otra marca) se ve al recargarlas', async () => {
    vi.mocked(ProductsService.getSuggestions)
      .mockResolvedValueOnce({ brands: ['Nike'], presentations: [] })
      .mockResolvedValueOnce({ brands: ['Nike', 'Puma'], presentations: [] })
    const store = useProductsStore()

    await store.loadSuggestions()
    await store.loadSuggestions()

    expect(store.brandSuggestions).toEqual(['Nike', 'Puma'])
  })
})

describe('products.store — copiar la foto de otro producto', () => {
  it('baja la foto como archivo nuevo y la sube al producto NUEVO', async () => {
    const file = new File(['x'], 'copia.png', { type: 'image/png' })
    vi.mocked(ProductsService.fetchImageFile).mockResolvedValue(file)
    vi.mocked(ProductsService.uploadProductImage).mockResolvedValue({ ...product, id: 'nuevo' })
    vi.mocked(ProductsService.listProducts).mockResolvedValue(listResponse)
    const store = useProductsStore()

    await store.copyProductImage('nuevo', '/uploads/products/abc.png', 'Playera')

    expect(ProductsService.fetchImageFile).toHaveBeenCalledExactlyOnceWith('/uploads/products/abc.png', 'Playera')
    expect(ProductsService.uploadProductImage).toHaveBeenCalledExactlyOnceWith('nuevo', file)
  })

  it('si no se puede bajar, no sube nada y lanza', async () => {
    vi.mocked(ProductsService.fetchImageFile).mockRejectedValue(new Error('404'))
    const store = useProductsStore()

    await expect(store.copyProductImage('nuevo', '/uploads/products/abc.png', 'Playera')).rejects.toThrow('404')

    expect(ProductsService.uploadProductImage).not.toHaveBeenCalled()
  })

  it('si la subida falla, lanza', async () => {
    vi.mocked(ProductsService.fetchImageFile).mockResolvedValue(new File(['x'], 'a.png', { type: 'image/png' }))
    vi.mocked(ProductsService.uploadProductImage).mockRejectedValue(new Error('500'))
    const store = useProductsStore()

    await expect(store.copyProductImage('nuevo', '/uploads/products/abc.png', 'Playera')).rejects.toThrow('500')
  })
})

describe('products.store — producto leído por QR', () => {
  it('pide el producto por su id y lo devuelve', async () => {
    vi.mocked(ProductsService.getProduct).mockResolvedValue(product)
    expect(await useProductsStore().findByScannedText('https://x.example/p/0190a5f0-7c3e-7000-8000-00000000000a')).toEqual(product)
    expect(ProductsService.getProduct).toHaveBeenCalledWith('0190a5f0-7c3e-7000-8000-00000000000a')
  })
  it('un texto sin id no pide nada', async () => {
    expect(await useProductsStore().findByScannedText('hola')).toBeNull()
    expect(ProductsService.getProduct).not.toHaveBeenCalled()
  })
  it('404: null; otro error (sin red): se propaga', async () => {
    const store = useProductsStore()
    vi.mocked(ProductsService.getProduct).mockRejectedValueOnce({ response: { status: 404 } })
    expect(await store.findByScannedText('0190a5f0-7c3e-7000-8000-00000000000a')).toBeNull()
    vi.mocked(ProductsService.getProduct).mockRejectedValueOnce(new Error('Network Error'))
    await expect(store.findByScannedText('0190a5f0-7c3e-7000-8000-00000000000a')).rejects.toThrow('Network Error')
  })
})
