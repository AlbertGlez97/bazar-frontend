import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/api', () => ({
  default: {
    get:    vi.fn(),
    post:   vi.fn(),
    delete: vi.fn(),
  },
}))

import api from '@/services/api'
import CategoryService from '@/services/category.service'
import type { CategoryItem } from '@/services/category.service'

const mockGet    = vi.mocked(api.get)
const mockPost   = vi.mocked(api.post)
const mockDelete = vi.mocked(api.delete)

const mkCat = (overrides: Partial<CategoryItem> = {}): CategoryItem => ({
  id: 'c-1', key: 'mercado', label: 'Mercado',
  type: 'necesidad', isGlobal: true, userId: null, ...overrides,
})

describe('CategoryService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getAll() GET /categories', async () => {
    const cats = [mkCat()]
    mockGet.mockResolvedValue({ data: cats })
    const result = await CategoryService.getAll()
    expect(mockGet).toHaveBeenCalledWith('/categories')
    expect(result).toEqual(cats)
  })

  it('create() POST /categories con label y type', async () => {
    const nueva = mkCat({ label: 'Gym', key: 'gym', isGlobal: false, userId: 'u-1' })
    mockPost.mockResolvedValue({ data: nueva })
    const result = await CategoryService.create('Gym', 'deseo')
    expect(mockPost).toHaveBeenCalledWith('/categories', { label: 'Gym', type: 'deseo' })
    expect(result).toEqual(nueva)
  })

  it('remove() DELETE /categories/:id', async () => {
    mockDelete.mockResolvedValue({ data: undefined })
    await CategoryService.remove('c-1')
    expect(mockDelete).toHaveBeenCalledWith('/categories/c-1')
  })
})
