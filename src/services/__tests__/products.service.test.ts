// Tests de ProductsService — wrappers delgados sobre api.ts, contrato real
// de doc/api-contract-for-frontend.md §5.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ProductsService from '../products.service'
import api from '../api'

vi.mock('../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const product = {
  id: 'p-1',
  name: 'Marvel’s Spider-Man 2 — PS5',
  tipo: 'unica',
  unitPriceMinor: 125000,
  initialStock: 1,
  stock: 1,
  category: 'PS5 physical games',
  purchaseCostMinor: 90000,
  supplier: 'Local trade-in',
  notes: null,
  createdAt: '2026-09-23T12:00:00.000Z',
  active: true,
  image: null,
}

describe('ProductsService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('listProducts hace GET /products con los params dados', async () => {
    const response = { items: [product], total: 1, page: 1, limit: 20 }
    vi.mocked(api.get).mockResolvedValue({ data: response })

    const result = await ProductsService.listProducts({ page: 1, search: 'PS5' })

    expect(result).toEqual(response)
    expect(api.get).toHaveBeenCalledExactlyOnceWith('/products', { params: { page: 1, search: 'PS5' } })
  })

  it('listProducts funciona sin params', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { items: [], total: 0, page: 1, limit: 20 } })
    await ProductsService.listProducts()
    expect(api.get).toHaveBeenCalledExactlyOnceWith('/products', { params: {} })
  })

  it('getProduct hace GET /products/:id', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: product })
    expect(await ProductsService.getProduct('p-1')).toEqual(product)
    expect(api.get).toHaveBeenCalledExactlyOnceWith('/products/p-1')
  })

  it('createProduct hace POST /products con el payload', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: product })
    const payload = { name: 'Nuevo', tipo: 'unica' as const, unitPriceMinor: 1000 }

    expect(await ProductsService.createProduct(payload)).toEqual(product)
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/products', payload)
  })

  it('updateProduct hace PATCH /products/:id con el payload', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: product })
    const payload = { unitPriceMinor: 120000 }

    expect(await ProductsService.updateProduct('p-1', payload)).toEqual(product)
    expect(api.patch).toHaveBeenCalledExactlyOnceWith('/products/p-1', payload)
  })

  it('uploadProductImage envía un FormData con el campo "image" y anula el Content-Type por defecto', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ...product, image: '/uploads/products/x.png' } })
    const file = new File(['data'], 'foto.png', { type: 'image/png' })

    const result = await ProductsService.uploadProductImage('p-1', file)

    expect(result.image).toBe('/uploads/products/x.png')
    expect(api.post).toHaveBeenCalledOnce()
    const [url, body, config] = vi.mocked(api.post).mock.calls[0]
    expect(url).toBe('/products/p-1/image')
    expect(body).toBeInstanceOf(FormData)
    expect((body as FormData).get('image')).toBe(file)
    expect(config?.headers).toEqual({ 'Content-Type': undefined })
  })

  it('deactivateProduct hace DELETE /products/:id', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: { ...product, active: false } })
    const result = await ProductsService.deactivateProduct('p-1')
    expect(result.active).toBe(false)
    expect(api.delete).toHaveBeenCalledExactlyOnceWith('/products/p-1')
  })

  it('reactivateProduct hace PATCH /products/:id/reactivate', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { ...product, active: true } })
    const result = await ProductsService.reactivateProduct('p-1')
    expect(result.active).toBe(true)
    expect(api.patch).toHaveBeenCalledExactlyOnceWith('/products/p-1/reactivate')
  })

  describe('restockProduct', () => {
    const movement = {
      id: 'm-1', productId: 'p-1', memberId: 'u-1', type: 'REPOSICION', quantity: 5,
      stockBefore: 1, stockAfter: 6, unitCostMinor: 1100, note: null,
      createdAt: '2026-10-15T12:00:00.000Z', contextId: 'ctx',
    }

    it('hace POST /products/:id/restock con el cuerpo dado y devuelve producto y movimiento', async () => {
      const response = { product: { ...product, stock: 6 }, movement }
      vi.mocked(api.post).mockResolvedValue({ data: response })

      const result = await ProductsService.restockProduct('p-1', { quantity: 5, unitCostMinor: 1100, note: 'Sábado' })

      expect(result).toEqual(response)
      expect(api.post).toHaveBeenCalledExactlyOnceWith('/products/p-1/restock', {
        quantity: 5, unitCostMinor: 1100, note: 'Sábado',
      })
    })

    it('solo manda lo que se le dio (sin costo ni nota no inventa claves)', async () => {
      vi.mocked(api.post).mockResolvedValue({ data: { product, movement } })

      await ProductsService.restockProduct('p-1', { quantity: 2 })

      expect(vi.mocked(api.post).mock.calls[0]![1]).toStrictEqual({ quantity: 2 })
    })

    it('deja pasar el error del servidor para que quien llama lo explique', async () => {
      const failure = Object.assign(new Error('Bad Request'), { response: { status: 400 } })
      vi.mocked(api.post).mockRejectedValue(failure)

      await expect(ProductsService.restockProduct('p-1', { quantity: 2 })).rejects.toBe(failure)
    })
  })
})

describe('ProductsService — marca, presentación y descripción', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getSuggestions hace GET /products/suggestions', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { brands: ['Nike'], presentations: ['XL'] } })

    expect(await ProductsService.getSuggestions()).toEqual({ brands: ['Nike'], presentations: ['XL'] })
    expect(api.get).toHaveBeenCalledExactlyOnceWith('/products/suggestions')
  })

  it('listProducts manda `brand`', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { items: [], total: 0, page: 1, limit: 20 } })

    await ProductsService.listProducts({ brand: 'Nike' })

    expect(api.get).toHaveBeenCalledExactlyOnceWith('/products', { params: { brand: 'Nike' } })
  })
})

describe('ProductsService.fetchImageFile — copiar la foto de otro producto', () => {
  const realFetch = globalThis.fetch
  afterEach(() => { globalThis.fetch = realFetch })

  const answer = (init: { ok?: boolean; type?: string; body?: string }) =>
    vi.fn().mockResolvedValue({
      ok: init.ok ?? true,
      status: init.ok === false ? 404 : 200,
      headers: new Headers({ 'content-type': init.type ?? 'image/png' }),
      blob: async () => new Blob([init.body ?? 'png-bytes'], { type: init.type ?? 'image/png' }),
    })

  it('baja la imagen de su ruta y la entrega como un archivo nuevo', async () => {
    const fetchMock = answer({})
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const file = await ProductsService.fetchImageFile('/uploads/products/abc.png', 'Playera lisa')

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/uploads/products/abc.png')
    expect(file).toBeInstanceOf(File)
    expect(file.type).toBe('image/png')
    expect(file.name).toBe('Playera lisa.png')
    expect(file.size).toBe('png-bytes'.length)
  })

  it('el nombre del archivo no puede traer barras ni saltos de línea', async () => {
    globalThis.fetch = answer({}) as unknown as typeof fetch

    const file = await ProductsService.fetchImageFile('/uploads/products/abc.png', 'a/b\c\nd')

    expect(file.name).not.toMatch(/[\/\n]/)
    expect(file.name.endsWith('.png')).toBe(true)
  })

  it('si el servidor responde error, lanza (quien llama avisa "No pudimos copiar la foto")', async () => {
    globalThis.fetch = answer({ ok: false }) as unknown as typeof fetch

    await expect(ProductsService.fetchImageFile('/uploads/products/abc.png', 'x')).rejects.toThrow()
  })

  it('si lo que llega no es una imagen, lanza', async () => {
    globalThis.fetch = answer({ type: 'text/html', body: '<html>' }) as unknown as typeof fetch

    await expect(ProductsService.fetchImageFile('/uploads/products/abc.png', 'x')).rejects.toThrow()
  })

  it('si no hay red, lanza', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch

    await expect(ProductsService.fetchImageFile('/uploads/products/abc.png', 'x')).rejects.toThrow()
  })
})
