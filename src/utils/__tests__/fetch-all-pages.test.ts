import { describe, expect, it, vi } from 'vitest'
import { PRODUCTS_PAGE_LIMIT, fetchAllProductPages } from '../fetch-all-pages'

const item = (n: number) => ({ id: `p-${n}` })
const page = (from: number, count: number, total: number) => ({ items: Array.from({ length: count }, (_, i) => item(from + i)), total })

describe('fetchAllProductPages', () => {
  it('pide de a 100 hasta juntar el total', async () => {
    const fetchPage = vi.fn(async (n: number) => (n === 1 ? page(0, 100, 230) : n === 2 ? page(100, 100, 230) : page(200, 30, 230)))
    const all = await fetchAllProductPages(fetchPage)
    expect(all).toHaveLength(230)
    expect(fetchPage.mock.calls).toEqual([[1, PRODUCTS_PAGE_LIMIT], [2, PRODUCTS_PAGE_LIMIT], [3, PRODUCTS_PAGE_LIMIT]])
  })

  it('con menos de una página hace una sola llamada', async () => {
    const fetchPage = vi.fn(async () => page(0, 3, 3))
    expect(await fetchAllProductPages(fetchPage)).toHaveLength(3)
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })

  it('quita lo repetido si la lista cambió entre páginas y se detiene con una página vacía', async () => {
    const fetchPage = vi.fn(async (n: number) => (n === 1 ? page(0, 100, 250) : n === 2 ? page(99, 100, 250) : page(0, 0, 250)))
    const all = await fetchAllProductPages(fetchPage)
    expect(all).toHaveLength(199)
    expect(fetchPage).toHaveBeenCalledTimes(3)
  })

  it('si una página falla, falla todo', async () => {
    const fetchPage = vi.fn(async (n: number) => {
      if (n === 2) throw new Error('sin red')
      return page(0, 100, 250)
    })
    await expect(fetchAllProductPages(fetchPage)).rejects.toThrow('sin red')
  })
})
