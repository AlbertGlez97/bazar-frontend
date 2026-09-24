// Tests de ProductsService — wrappers delgados sobre api.ts, contrato real
// de doc/api-contract-for-frontend.md §5.
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
})
