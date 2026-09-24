import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/stores/toast.store', () => ({
  useToastStore: () => ({ success: vi.fn(), error: vi.fn() }),
}))

vi.mock('@/services/category.service', () => ({
  default: {
    getAll:  vi.fn(),
    create:  vi.fn(),
    remove:  vi.fn(),
  },
}))

import { useCategoryStore } from '@/stores/category.store'
import CategoryService, { type CategoryItem } from '@/services/category.service'

const mkCat = (overrides: Partial<CategoryItem> = {}): CategoryItem => ({
  id: 'c-1', key: 'mercado', label: 'Mercado',
  type: 'necesidad', isGlobal: true, userId: null,
  ...overrides,
})

describe('useCategoryStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  // ── fetchIfNeeded ────────────────────────────────────────────────────────

  it('carga las categorías en el primer fetchIfNeeded', async () => {
    const cats = [mkCat(), mkCat({ id: 'c-2', key: 'restaurante', label: 'Restaurante', isGlobal: false, userId: 'u-1' })]
    vi.mocked(CategoryService.getAll).mockResolvedValue(cats)

    const store = useCategoryStore()
    await store.fetchIfNeeded()

    expect(store.items).toHaveLength(2)
    expect(store.loaded).toBe(true)
    expect(store.loading).toBe(false)
  })

  it('no vuelve a llamar al servicio si ya está cargado', async () => {
    vi.mocked(CategoryService.getAll).mockResolvedValue([mkCat()])
    const store = useCategoryStore()
    await store.fetchIfNeeded()
    await store.fetchIfNeeded()

    expect(CategoryService.getAll).toHaveBeenCalledTimes(1)
  })

  it('pone loading=false aunque el servicio falle', async () => {
    vi.mocked(CategoryService.getAll).mockRejectedValue(new Error('fail'))
    const store = useCategoryStore()

    await expect(store.fetchIfNeeded()).rejects.toThrow('fail')
    expect(store.loading).toBe(false)
  })

  // ── computed globals / custom ────────────────────────────────────────────

  it('globals solo incluye las globales', async () => {
    vi.mocked(CategoryService.getAll).mockResolvedValue([
      mkCat({ id: 'c-1', isGlobal: true }),
      mkCat({ id: 'c-2', isGlobal: false, userId: 'u-1' }),
    ])
    const store = useCategoryStore()
    await store.fetchIfNeeded()

    expect(store.globals).toHaveLength(1)
    expect(store.globals[0].isGlobal).toBe(true)
  })

  it('custom solo incluye las personalizadas', async () => {
    vi.mocked(CategoryService.getAll).mockResolvedValue([
      mkCat({ id: 'c-1', isGlobal: true }),
      mkCat({ id: 'c-2', isGlobal: false, userId: 'u-1' }),
    ])
    const store = useCategoryStore()
    await store.fetchIfNeeded()

    expect(store.custom).toHaveLength(1)
    expect(store.custom[0].isGlobal).toBe(false)
  })

  // ── create ───────────────────────────────────────────────────────────────

  it('agrega la nueva categoría a items y muestra toast success', async () => {
    const nueva = mkCat({ id: 'c-new', label: 'Gym', key: 'gym', isGlobal: false, userId: 'u-1' })
    vi.mocked(CategoryService.create).mockResolvedValue(nueva)

    const store = useCategoryStore()
    const result = await store.create('Gym', 'deseo')

    expect(store.items).toContainEqual(nueva)
    expect(result).toEqual(nueva)
  })

  it('devuelve null y muestra toast error si create falla', async () => {
    vi.mocked(CategoryService.create).mockRejectedValue(new Error('fail'))

    const store  = useCategoryStore()
    const result = await store.create('Gym', 'deseo')

    expect(result).toBeNull()
    expect(store.items).toHaveLength(0)
  })

  // ── remove ───────────────────────────────────────────────────────────────

  it('elimina la categoría de items y muestra toast success', async () => {
    vi.mocked(CategoryService.getAll).mockResolvedValue([mkCat({ id: 'c-1' }), mkCat({ id: 'c-2', key: 'gym' })])
    vi.mocked(CategoryService.remove).mockResolvedValue()

    const store = useCategoryStore()
    await store.fetchIfNeeded()
    await store.remove('c-1')

    expect(store.items.find(c => c.id === 'c-1')).toBeUndefined()
    expect(store.items).toHaveLength(1)
  })

  it('muestra toast error si remove falla y no modifica items', async () => {
    vi.mocked(CategoryService.getAll).mockResolvedValue([mkCat({ id: 'c-1' })])
    vi.mocked(CategoryService.remove).mockRejectedValue(new Error('fail'))

    const store = useCategoryStore()
    await store.fetchIfNeeded()
    await store.remove('c-1')

    expect(store.items).toHaveLength(1)
  })

  // ── labelByKey ───────────────────────────────────────────────────────────

  it('labelByKey devuelve el label de la categoría con ese key', async () => {
    vi.mocked(CategoryService.getAll).mockResolvedValue([mkCat({ key: 'mercado', label: 'Supermercado' })])
    const store = useCategoryStore()
    await store.fetchIfNeeded()

    expect(store.labelByKey('mercado')).toBe('Supermercado')
  })

  it('labelByKey devuelve el key si no se encuentra ninguna categoría', async () => {
    const store = useCategoryStore()
    expect(store.labelByKey('desconocido')).toBe('desconocido')
  })
})
