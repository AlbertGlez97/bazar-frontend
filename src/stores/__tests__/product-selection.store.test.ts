import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useProductSelectionStore } from '../product-selection.store'
import ProductsService from '@/services/products.service'
import type { Product } from '@/types/product.types'

vi.mock('@/services/products.service', () => ({ default: { listProducts: vi.fn() } }))

function product(n: number, overrides: Partial<Product> = {}): Product {
  return {
    id: `01a0ddd7-7f00-744a-8b23-${String(n).padStart(12, '0')}`, name: `Producto ${n}`, tipo: 'cantidad',
    unitPriceMinor: 1000, initialStock: 5, stock: 5, category: null, purchaseCostMinor: null, supplier: null,
    notes: null, createdAt: '2026-09-01T00:00:00.000Z', active: true, image: null, ...overrides,
  }
}
const many = (from: number, to: number, overrides: Partial<Product> = {}) => Array.from({ length: to - from }, (_, i) => product(from + i, overrides))

/** El servidor simulado: pagina como GET /products (limit máx 100) y oculta lo inactivo salvo includeInactive. */
function serverWith(all: Product[]) {
  vi.mocked(ProductsService.listProducts).mockImplementation(async (params = {}) => {
    const visible = all.filter((p) => (params.includeInactive ? true : p.active)
      && (!params.search || p.name.toLowerCase().includes(params.search.toLowerCase())))
    const page = params.page ?? 1
    const limit = params.limit ?? 20
    return { items: visible.slice((page - 1) * limit, page * limit), total: visible.length, page, limit }
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(ProductsService.listProducts).mockReset()
})

describe('product selection store', () => {
  it('starts off, empty', () => {
    const store = useProductSelectionStore()
    expect(store.active).toBe(false)
    expect(store.count).toBe(0)
    expect(store.items).toEqual([])
  })

  it('toggle adds and removes a product, keeping id and name', () => {
    const store = useProductSelectionStore()
    store.enter()
    store.toggle(product(1))
    store.toggle(product(2))
    expect(store.count).toBe(2)
    expect(store.has(product(1).id)).toBe(true)
    expect(store.items).toEqual([{ id: product(1).id, name: 'Producto 1' }, { id: product(2).id, name: 'Producto 2' }])
    store.toggle(product(1))
    expect(store.has(product(1).id)).toBe(false)
    expect(store.count).toBe(1)
  })

  it('never selects an inactive product (its label would be useless)', () => {
    const store = useProductSelectionStore()
    store.toggle(product(1, { active: false }))
    expect(store.count).toBe(0)
  })

  it('keeps the order in which products were selected (that is the order on the sheet)', () => {
    const store = useProductSelectionStore()
    store.toggle(product(3))
    store.toggle(product(1))
    store.toggle(product(2))
    expect(store.items.map((i) => i.name)).toEqual(['Producto 3', 'Producto 1', 'Producto 2'])
  })

  it('clear empties the selection but stays in selection mode', () => {
    const store = useProductSelectionStore()
    store.enter()
    store.toggle(product(1))
    store.clear()
    expect(store.count).toBe(0)
    expect(store.active).toBe(true)
  })

  it('exit leaves selection mode AND clears the selection', () => {
    const store = useProductSelectionStore()
    store.enter()
    store.toggle(product(1))
    store.exit()
    expect(store.active).toBe(false)
    expect(store.count).toBe(0)
  })

  it('the selection survives what the catalog does around it (it is independent of any list)', () => {
    const store = useProductSelectionStore()
    store.toggle(product(1))
    // A different page/search shows other products; the selection does not care.
    store.toggle(product(50))
    expect(store.count).toBe(2)
    expect(store.has(product(1).id)).toBe(true)
  })
})

describe('selectAllMatching', () => {
  it('fetches every page (100 at a time) and selects only the ACTIVE products', async () => {
    serverWith([...many(0, 230), ...many(230, 260, { active: false })])
    const store = useProductSelectionStore()
    const added = await store.selectAllMatching('')
    expect(added).toBe(230)
    expect(store.count).toBe(230)
    const calls = vi.mocked(ProductsService.listProducts).mock.calls.map(([params]) => params)
    expect(calls).toEqual([
      { page: 1, limit: 100, search: undefined },
      { page: 2, limit: 100, search: undefined },
      { page: 3, limit: 100, search: undefined },
    ])
  })

  it('never asks for inactive products', async () => {
    serverWith(many(0, 5))
    await useProductSelectionStore().selectAllMatching('')
    for (const [params] of vi.mocked(ProductsService.listProducts).mock.calls) {
      expect(params).not.toHaveProperty('includeInactive')
    }
  })

  it('respects the current search', async () => {
    serverWith([product(1, { name: 'Taza azul' }), product(2, { name: 'Maceta' }), product(3, { name: 'Taza roja' })])
    const store = useProductSelectionStore()
    expect(await store.selectAllMatching('taza')).toBe(2)
    expect(store.items.map((i) => i.name)).toEqual(['Taza azul', 'Taza roja'])
    expect(vi.mocked(ProductsService.listProducts).mock.calls[0]![0]).toMatchObject({ search: 'taza' })
  })

  it('does not duplicate what was already selected and reports only the new ones', async () => {
    serverWith(many(0, 10))
    const store = useProductSelectionStore()
    store.toggle(product(2))
    store.toggle(product(4))
    expect(await store.selectAllMatching('')).toBe(8)
    expect(store.count).toBe(10)
  })

  it('an exact multiple of 100 does not ask for an extra empty page', async () => {
    serverWith(many(0, 200))
    await useProductSelectionStore().selectAllMatching('')
    expect(vi.mocked(ProductsService.listProducts)).toHaveBeenCalledTimes(2)
  })

  it('an empty catalog selects nothing', async () => {
    serverWith([])
    const store = useProductSelectionStore()
    expect(await store.selectAllMatching('')).toBe(0)
    expect(store.count).toBe(0)
  })

  it('exposes progress and a busy flag while it loads, and resets both at the end', async () => {
    serverWith(many(0, 250))
    const store = useProductSelectionStore()
    const seen: (number | undefined)[] = []
    vi.mocked(ProductsService.listProducts).mockImplementation(async (params = {}) => {
      seen.push(store.progress?.loaded)
      expect(store.selectingAll).toBe(true)
      const page = params.page ?? 1
      const all = many(0, 250)
      return { items: all.slice((page - 1) * 100, page * 100), total: 250, page, limit: 100 }
    })
    await store.selectAllMatching('')
    expect(seen).toEqual([0, 100, 200])
    expect(store.selectingAll).toBe(false)
    expect(store.progress).toBeNull()
  })

  it('is all or nothing: a failing page adds NOTHING, resets the busy flag and rethrows', async () => {
    const all = many(0, 250)
    vi.mocked(ProductsService.listProducts).mockImplementation(async (params = {}) => {
      if ((params.page ?? 1) === 3) throw new Error('boom')
      const page = params.page ?? 1
      return { items: all.slice((page - 1) * 100, page * 100), total: 250, page, limit: 100 }
    })
    const store = useProductSelectionStore()
    store.toggle(product(1))
    await expect(store.selectAllMatching('')).rejects.toThrow('boom')
    expect(store.count).toBe(1)
    expect(store.selectingAll).toBe(false)
    expect(store.progress).toBeNull()
  })

  it('ignores a second call while one is running', async () => {
    serverWith(many(0, 5))
    const store = useProductSelectionStore()
    const first = store.selectAllMatching('')
    expect(await store.selectAllMatching('')).toBe(0)
    expect(await first).toBe(5)
    expect(vi.mocked(ProductsService.listProducts)).toHaveBeenCalledTimes(1)
  })
})
