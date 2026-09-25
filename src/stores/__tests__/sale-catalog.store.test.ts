import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSaleCatalogStore } from '../sale-catalog.store'
import { closeLocalDb, loadCatalogSnapshot, saveCatalogSnapshot } from '@/services/local-db'
import ProductsService from '@/services/products.service'
import { VOICE } from '@/config/voice'
import type { Product } from '@/types/product.types'

vi.mock('@/services/products.service', () => ({ default: { listProducts: vi.fn() } }))

const realIndexedDb = globalThis.indexedDB

const UUID_A = '0190a5f0-7c3e-7000-8000-00000000000a'
const UUID_B = '0190a5f0-7c3e-7000-8000-00000000000b'

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p-1', name: 'Taza de barro', tipo: 'cantidad', unitPriceMinor: 1999, initialStock: 10, stock: 10,
    category: 'Cocina', purchaseCostMinor: null, supplier: null, notes: null,
    createdAt: '2026-09-01T00:00:00.000Z', active: true, image: null, ...overrides,
  }
}

function many(from: number, to: number): Product[] {
  return Array.from({ length: to - from }, (_, i) => product({ id: `p-${from + i}`, name: `Producto ${from + i}` }))
}

/** listProducts simulado con un catálogo completo, paginado como el servidor. */
function serverWith(all: Product[]) {
  vi.mocked(ProductsService.listProducts).mockImplementation(async (params = {}) => {
    const page = params.page ?? 1
    const limit = params.limit ?? 20
    return { items: all.slice((page - 1) * limit, page * limit), total: all.length, page, limit }
  })
}

beforeEach(() => {
  closeLocalDb()
  globalThis.indexedDB = new IDBFactory()
  setActivePinia(createPinia())
  vi.mocked(ProductsService.listProducts).mockReset()
})
afterEach(() => {
  closeLocalDb()
  globalThis.indexedDB = realIndexedDb
})

describe('sale-catalog.store — carga por páginas', () => {
  it('pagina con limit=100 hasta traer todo el catálogo (3 páginas)', async () => {
    serverWith(many(0, 250))
    const store = useSaleCatalogStore()

    const pending = store.load()
    expect(store.loading).toBe(true)
    await pending

    expect(store.loading).toBe(false)
    expect(store.products).toHaveLength(250)
    expect(vi.mocked(ProductsService.listProducts).mock.calls.map(([params]) => params)).toEqual([
      { page: 1, limit: 100 },
      { page: 2, limit: 100 },
      { page: 3, limit: 100 },
    ])
    expect(store.error).toBeNull()
    expect(store.isFromSnapshot).toBe(false)
    expect(store.lastLoadedAt).not.toBeNull()
  })

  it('un catálogo de exactamente 100 pide una sola página', async () => {
    serverWith(many(0, 100))
    const store = useSaleCatalogStore()
    await store.load()
    expect(ProductsService.listProducts).toHaveBeenCalledTimes(1)
    expect(store.products).toHaveLength(100)
  })

  it('catálogo vacío: sin productos y sin error', async () => {
    serverWith([])
    const store = useSaleCatalogStore()
    await store.load()
    expect(store.products).toEqual([])
    expect(store.error).toBeNull()
    expect(ProductsService.listProducts).toHaveBeenCalledTimes(1)
  })

  it('si una página llega vacía antes de completar el total, se detiene (sin ciclo infinito)', async () => {
    vi.mocked(ProductsService.listProducts).mockImplementation(async (params = {}) => ({
      items: params.page === 1 ? many(0, 100) : [],
      total: 500, page: params.page ?? 1, limit: 100,
    }))
    const store = useSaleCatalogStore()

    await store.load()

    expect(store.products).toHaveLength(100)
    expect(ProductsService.listProducts).toHaveBeenCalledTimes(2)
  })

  it('descarta duplicados entre páginas (la paginación por offset no es un snapshot)', async () => {
    vi.mocked(ProductsService.listProducts).mockImplementation(async (params = {}) => ({
      items: params.page === 1 ? many(0, 100) : many(99, 150), // p-99 se repite
      total: 150, page: params.page ?? 1, limit: 100,
    }))
    const store = useSaleCatalogStore()

    await store.load()

    expect(store.products).toHaveLength(150)
    expect(new Set(store.products.map((p) => p.id)).size).toBe(150)
  })

  it('guarda un snapshot en IndexedDB tras una carga exitosa', async () => {
    serverWith(many(0, 3))
    const store = useSaleCatalogStore()

    await store.load()

    const snapshot = await loadCatalogSnapshot()
    expect(snapshot?.items.map((p) => p.id)).toEqual(['p-0', 'p-1', 'p-2'])
    expect(snapshot?.savedAt).toBe(store.lastLoadedAt)
  })

  it('cargas simultáneas comparten la misma petición', async () => {
    serverWith(many(0, 5))
    const store = useSaleCatalogStore()

    await Promise.all([store.load(), store.load()])

    expect(ProductsService.listProducts).toHaveBeenCalledTimes(1)
  })
})

describe('sale-catalog.store — sin conexión y snapshot', () => {
  it('si la carga falla usa el snapshot guardado y lo marca (isFromSnapshot)', async () => {
    await saveCatalogSnapshot([product({ id: 'old-1' })], '2026-09-24T09:00:00.000Z')
    vi.mocked(ProductsService.listProducts).mockRejectedValue({ isAxiosError: true, code: 'ERR_NETWORK' })
    const store = useSaleCatalogStore()

    await store.load()

    expect(store.products.map((p) => p.id)).toEqual(['old-1'])
    expect(store.isFromSnapshot).toBe(true)
    expect(store.lastLoadedAt).toBe('2026-09-24T09:00:00.000Z')
    expect(store.error).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('un fallo a mitad de la paginación NO deja un catálogo a medias: usa el snapshot', async () => {
    await saveCatalogSnapshot(many(0, 250), '2026-09-24T09:00:00.000Z')
    vi.mocked(ProductsService.listProducts).mockImplementation(async (params = {}) => {
      if (params.page === 2) throw { isAxiosError: true, code: 'ERR_NETWORK' }
      return { items: many(0, 100), total: 250, page: 1, limit: 100 }
    })
    const store = useSaleCatalogStore()

    await store.load()

    expect(store.products).toHaveLength(250)
    expect(store.isFromSnapshot).toBe(true)
  })

  it('sin snapshot y sin red: estado de error claro y catálogo vacío', async () => {
    vi.mocked(ProductsService.listProducts).mockRejectedValue({ isAxiosError: true, code: 'ERR_NETWORK' })
    const store = useSaleCatalogStore()

    await store.load()

    expect(store.products).toEqual([])
    expect(store.error).toBe(VOICE.networkError)
    expect(store.isFromSnapshot).toBe(false)
  })

  it('sin snapshot y el servidor falla (5xx): mensaje genérico', async () => {
    vi.mocked(ProductsService.listProducts).mockRejectedValue({ response: { status: 500 } })
    const store = useSaleCatalogStore()

    await store.load()

    expect(store.error).toBe(VOICE.genericError)
  })

  it('sin IndexedDB y sin red: error, sin lanzar', async () => {
    closeLocalDb()
    // @ts-expect-error simulamos un navegador sin IndexedDB
    globalThis.indexedDB = undefined
    vi.mocked(ProductsService.listProducts).mockRejectedValue({ isAxiosError: true, code: 'ERR_NETWORK' })
    const store = useSaleCatalogStore()

    await expect(store.load()).resolves.toBeUndefined()
    expect(store.error).toBe(VOICE.networkError)
  })

  it('si ya había productos en memoria y una recarga falla, los conserva marcados como copia guardada', async () => {
    serverWith(many(0, 3))
    const store = useSaleCatalogStore()
    await store.load()
    closeLocalDb()
    // @ts-expect-error simulamos un navegador sin IndexedDB (no hay snapshot que leer)
    globalThis.indexedDB = undefined
    vi.mocked(ProductsService.listProducts).mockRejectedValue({ isAxiosError: true, code: 'ERR_NETWORK' })

    await store.load()

    expect(store.products).toHaveLength(3)
    expect(store.isFromSnapshot).toBe(true)
    expect(store.error).toBeNull()
  })

  it('una carga exitosa posterior quita la marca de snapshot', async () => {
    await saveCatalogSnapshot([product({ id: 'old-1' })], '2026-09-24T09:00:00.000Z')
    vi.mocked(ProductsService.listProducts).mockRejectedValueOnce({ isAxiosError: true, code: 'ERR_NETWORK' })
    const store = useSaleCatalogStore()
    await store.load()
    expect(store.isFromSnapshot).toBe(true)

    serverWith(many(0, 2))
    await store.load()

    expect(store.isFromSnapshot).toBe(false)
    expect(store.products.map((p) => p.id)).toEqual(['p-0', 'p-1'])
  })
})

describe('sale-catalog.store — filtros en el cliente', () => {
  const catalog = [
    product({ id: 'a', name: 'Café de olla', category: 'Cocina' }),
    product({ id: 'b', name: 'Niño Dios de talavera', category: 'Decoración' }),
    product({ id: 'c', name: 'Taza CAFÉ', category: 'Cocina' }),
    product({ id: 'd', name: 'Sarape', category: null }),
    product({ id: 'e', name: 'Rebozo', category: '  ' }),
    product({ id: 'f', name: 'Jarrón', category: 'Decoración' }),
  ]

  async function loaded() {
    serverWith(catalog)
    const store = useSaleCatalogStore()
    await store.load()
    return store
  }

  it('sin filtros devuelve todo en el orden del servidor', async () => {
    const store = await loaded()
    expect(store.filtered.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })

  it('búsqueda sin distinguir mayúsculas ni acentos', async () => {
    const store = await loaded()

    store.setSearch('cafe')
    expect(store.filtered.map((p) => p.id)).toEqual(['a', 'c'])

    store.setSearch('CAFÉ')
    expect(store.filtered.map((p) => p.id)).toEqual(['a', 'c'])

    store.setSearch('nino')
    expect(store.filtered.map((p) => p.id)).toEqual(['b'])

    store.setSearch('jarron')
    expect(store.filtered.map((p) => p.id)).toEqual(['f'])
  })

  it('la búsqueda es por subcadena y recorta espacios', async () => {
    const store = await loaded()
    store.setSearch('  olla ')
    expect(store.filtered.map((p) => p.id)).toEqual(['a'])
  })

  it('búsqueda vacía o solo espacios no filtra; sin coincidencias devuelve []', async () => {
    const store = await loaded()
    store.setSearch('   ')
    expect(store.filtered).toHaveLength(6)
    store.setSearch('zzz')
    expect(store.filtered).toEqual([])
  })

  it('categorías: distintas, no vacías, ordenadas', async () => {
    const store = await loaded()
    expect(store.categories).toEqual(['Cocina', 'Decoración'])
  })

  it('el orden de categorías respeta el español (acentos, mayúsculas)', async () => {
    serverWith([
      product({ id: '1', category: 'Ropa' }),
      product({ id: '2', category: 'álbumes' }),
      product({ id: '3', category: 'Bebidas' }),
    ])
    const store = useSaleCatalogStore()
    await store.load()
    expect(store.categories).toEqual(['álbumes', 'Bebidas', 'Ropa'])
  })

  it('filtra por categoría exacta; la cadena vacía significa "todas"', async () => {
    const store = await loaded()

    store.setCategory('Decoración')
    expect(store.filtered.map((p) => p.id)).toEqual(['b', 'f'])

    store.setCategory('')
    expect(store.filtered).toHaveLength(6)
    expect(store.category).toBe('')
  })

  it('combina búsqueda y categoría', async () => {
    const store = await loaded()

    store.setCategory('Cocina')
    store.setSearch('taza')
    expect(store.filtered.map((p) => p.id)).toEqual(['c'])

    store.setCategory('Decoración')
    expect(store.filtered).toEqual([])
  })

  it('no toca la red: filtrar es instantáneo y local', async () => {
    const store = await loaded()
    vi.mocked(ProductsService.listProducts).mockClear()

    store.setSearch('cafe')
    store.setCategory('Cocina')
    void store.filtered

    expect(ProductsService.listProducts).not.toHaveBeenCalled()
  })
})

describe('sale-catalog.store — búsqueda por id (QR)', () => {
  async function loaded() {
    serverWith([product({ id: UUID_A, name: 'Sarape' }), product({ id: UUID_B, name: 'Jarrón' })])
    const store = useSaleCatalogStore()
    await store.load()
    return store
  }

  it('getById compara sin distinguir mayúsculas y recorta espacios', async () => {
    const store = await loaded()

    expect(store.getById(UUID_A)?.name).toBe('Sarape')
    expect(store.getById(UUID_A.toUpperCase())?.name).toBe('Sarape')
    expect(store.getById(`  ${UUID_B}\n`)?.name).toBe('Jarrón')
  })

  it('getById devuelve null si no existe o el texto está vacío', async () => {
    const store = await loaded()
    expect(store.getById('0190a5f0-7c3e-7000-8000-0000000000ff')).toBeNull()
    expect(store.getById('')).toBeNull()
    expect(store.getById('   ')).toBeNull()
  })

  it('findByScannedText acepta el id pelado', async () => {
    const store = await loaded()
    expect(store.findByScannedText(`${UUID_B}\r\n`)?.id).toBe(UUID_B)
  })

  it('findByScannedText encuentra el id dentro de una URL o un prefijo', async () => {
    const store = await loaded()
    expect(store.findByScannedText(`https://bazar.example/p/${UUID_A}`)?.id).toBe(UUID_A)
    expect(store.findByScannedText(`bazar:product:${UUID_B.toUpperCase()}`)?.id).toBe(UUID_B)
  })

  it('findByScannedText devuelve null para códigos que no son de un producto de este catálogo', async () => {
    const store = await loaded()
    expect(store.findByScannedText('7501234567890')).toBeNull() // código de barras
    expect(store.findByScannedText('hola')).toBeNull()
    expect(store.findByScannedText('')).toBeNull()
    expect(store.findByScannedText('0190a5f0-7c3e-7000-8000-0000000000ff')).toBeNull() // UUID desconocido
  })
})

describe('sale-catalog.store — applySoldItems', () => {
  async function loaded() {
    serverWith([
      product({ id: 'c', tipo: 'cantidad', stock: 5 }),
      product({ id: 'u', tipo: 'unica', stock: 1 }),
      product({ id: 'z', tipo: 'cantidad', stock: 2 }),
    ])
    const store = useSaleCatalogStore()
    await store.load()
    return store
  }

  it('cantidad resta lo vendido y unica queda en 0', async () => {
    const store = await loaded()

    await store.applySoldItems([{ productId: 'c', quantity: 2 }, { productId: 'u', quantity: 1 }])

    expect(store.getById('c')?.stock).toBe(3)
    expect(store.getById('u')?.stock).toBe(0)
    expect(store.getById('z')?.stock).toBe(2)
  })

  it('nunca baja de 0 (el stock local pudo quedar desactualizado)', async () => {
    const store = await loaded()

    await store.applySoldItems([{ productId: 'z', quantity: 9 }])

    expect(store.getById('z')?.stock).toBe(0)
  })

  it('ignora ids que no están en el catálogo', async () => {
    const store = await loaded()
    await expect(store.applySoldItems([{ productId: 'nope', quantity: 1 }])).resolves.toBeUndefined()
    expect(store.products).toHaveLength(3)
  })

  it('reemplaza los objetos (la UI reactiva se entera) y no muta el original', async () => {
    const store = await loaded()
    const before = store.getById('c')

    await store.applySoldItems([{ productId: 'c', quantity: 1 }])

    expect(store.getById('c')).not.toBe(before)
    expect(before?.stock).toBe(5)
  })

  it('persiste el snapshot con el stock nuevo y conserva la fecha de la última carga real', async () => {
    const store = await loaded()
    const loadedAt = store.lastLoadedAt

    await store.applySoldItems([{ productId: 'c', quantity: 2 }])

    const snapshot = await loadCatalogSnapshot()
    expect(snapshot?.items.find((p) => p.id === 'c')?.stock).toBe(3)
    expect(snapshot?.savedAt).toBe(loadedAt)
  })

  it('el stock descontado sobrevive a un "reload" sin red (se lee del snapshot)', async () => {
    const store = await loaded()
    await store.applySoldItems([{ productId: 'c', quantity: 2 }])

    setActivePinia(createPinia())
    closeLocalDb()
    vi.mocked(ProductsService.listProducts).mockRejectedValue({ isAxiosError: true, code: 'ERR_NETWORK' })
    const reloaded = useSaleCatalogStore()
    await reloaded.load()

    expect(reloaded.isFromSnapshot).toBe(true)
    expect(reloaded.getById('c')?.stock).toBe(3)
  })

  it('sin IndexedDB igual descuenta en memoria y no lanza', async () => {
    const store = await loaded()
    closeLocalDb()
    // @ts-expect-error simulamos un navegador sin IndexedDB
    globalThis.indexedDB = undefined

    await expect(store.applySoldItems([{ productId: 'c', quantity: 1 }])).resolves.toBeUndefined()
    expect(store.getById('c')?.stock).toBe(4)
  })
})
