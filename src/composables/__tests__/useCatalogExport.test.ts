import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCatalogExport } from '../useCatalogExport'
import ProductsService from '@/services/products.service'
import { useCatalogExportStore } from '@/stores/catalog-export.store'
import { VOICE } from '@/config/voice'
import { saveBlob } from '@/utils/report-files'
import { makeProduct } from '@/test/factories'
import type { ReducedImage } from '@/services/catalog-images'

vi.mock('@/services/products.service', () => ({ default: { listProducts: vi.fn() } }))
vi.mock('@/utils/report-files', () => ({ saveBlob: vi.fn() }))

const images = vi.hoisted(() => ({
  processCatalogImages: vi.fn(),
  makePlaceholder: vi.fn(),
}))
vi.mock('@/services/catalog-images', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/catalog-images')>()),
  processCatalogImages: images.processCatalogImages,
  makePlaceholder: images.makePlaceholder,
}))

const docx = vi.hoisted(() => ({ generateCatalogDocx: vi.fn() }))
vi.mock('@/services/catalog-docx', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/catalog-docx')>()),
  generateCatalogDocx: docx.generateCatalogDocx,
}))

const photo = (): ReducedImage => ({ bytes: new Uint8Array([1]), width: 400, height: 300, placeholder: false })
const SECRET = { purchaseCostMinor: 987654, supplier: 'Proveedor Secreto SA', notes: 'nota interna' }

const products = [
  makeProduct({ name: 'Playera', category: 'Ropa', presentation: 'S', image: '/uploads/products/a.png', ...SECRET }),
  makeProduct({ name: 'Playera', category: 'Ropa', presentation: 'M', ...SECRET }),
  makeProduct({ name: 'Taza', category: null, ...SECRET }),
]

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.mocked(ProductsService.listProducts).mockResolvedValue({ items: products, total: 3, page: 1, limit: 100 })
  images.processCatalogImages.mockImplementation(async (urls: string[], options: { onProgress?: (d: number, t: number) => void }) => {
    options.onProgress?.(urls.length, urls.length)
    return new Map(urls.map((url) => [url, photo()]))
  })
  images.makePlaceholder.mockResolvedValue({ ...photo(), placeholder: true })
  docx.generateCatalogDocx.mockResolvedValue({ blob: new Blob(['docx']), bytes: new Uint8Array([1, 2]) })
})

describe('useCatalogExport — cargar y resumir', () => {
  it('baja todos los productos de a 100 y arma el resumen con las opciones', async () => {
    const catalog = useCatalogExport()
    await catalog.load()
    expect(ProductsService.listProducts).toHaveBeenCalledWith({ page: 1, limit: 100 })
    expect(catalog.loaded.value).toBe(true)
    expect(catalog.data.value).toMatchObject({ productCount: 2, recordCount: 3, mergedCount: 1, photoCount: 1 })
    expect(catalog.data.value.categories.map((c) => c.name)).toEqual(['Ropa', 'Otros'])
    expect(catalog.categories.value).toEqual(['Ropa', 'Otros'])
  })

  it('el resumen sigue las opciones: sin agrupar, hay un producto por registro', async () => {
    const catalog = useCatalogExport()
    await catalog.load()
    useCatalogExportStore().set({ groupVariants: false })
    expect(catalog.data.value.productCount).toBe(3)
    useCatalogExportStore().set({ filter: { mode: 'categories', categories: ['Ropa'] } })
    expect(catalog.data.value.productCount).toBe(2)
  })

  it('solo guarda la lista blanca: el costo, el proveedor y las notas no se quedan en memoria', async () => {
    const catalog = useCatalogExport()
    await catalog.load()
    const memory = JSON.stringify([catalog.sources.value, catalog.data.value, catalog.candidates.value])
    for (const forbidden of ['purchaseCost', 'supplier', 'notes', '987654', 'Proveedor Secreto', 'nota interna']) expect(memory).not.toContain(forbidden)
  })

  it('ofrece los productos ordenados por nombre para la selección manual', async () => {
    const catalog = useCatalogExport()
    await catalog.load()
    expect(catalog.candidates.value.map((c) => c.name)).toEqual(['Playera', 'Playera', 'Taza'])
  })

  it('sin red, avisa con el mensaje de conexión de siempre y no se queda cargando', async () => {
    vi.mocked(ProductsService.listProducts).mockRejectedValue(Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' }))
    const catalog = useCatalogExport()
    await catalog.load()
    expect(catalog.error.value).toBe(VOICE.networkError)
    expect(catalog.loaded.value).toBe(false)
    expect(catalog.phase.value).toBe('idle')
  })

  it('otro error muestra el mensaje general', async () => {
    vi.mocked(ProductsService.listProducts).mockRejectedValue({ response: { status: 500 } })
    const catalog = useCatalogExport()
    await catalog.load()
    expect(catalog.error.value).toBe(VOICE.catalogExport.error)
  })
})

describe('useCatalogExport — generar', () => {
  it('reduce las fotos (400 px), arma el documento con las opciones y lo descarga', async () => {
    const catalog = useCatalogExport()
    await catalog.load()
    const done = await catalog.generate()

    expect(done).toBe(true)
    expect(images.processCatalogImages).toHaveBeenCalledWith(['/uploads/products/a.png'], expect.objectContaining({ maxSide: 400 }))
    const [data, photos, placeholder, options] = docx.generateCatalogDocx.mock.calls[0]!
    expect(data.productCount).toBe(2)
    expect(photos.size).toBe(1)
    expect(placeholder.placeholder).toBe(true)
    expect(options).toMatchObject({ columns: 2, businessName: expect.any(String) })
    expect(saveBlob).toHaveBeenCalledTimes(1)
    expect(vi.mocked(saveBlob).mock.calls[0]![1]).toMatch(/^Catalogo - .+ - \d{4}-\d{2}-\d{2}\.docx$/)
    expect(catalog.phase.value).toBe('idle')
  })

  it('con calidad Alta usa 800 px', async () => {
    useCatalogExportStore().set({ photoQuality: 'high' })
    const catalog = useCatalogExport()
    await catalog.load()
    await catalog.generate()
    expect(images.processCatalogImages).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ maxSide: 800 }))
  })

  it('con las fotos apagadas no baja ninguna ni crea marcador', async () => {
    useCatalogExportStore().set({ fields: { photo: false } })
    const catalog = useCatalogExport()
    await catalog.load()
    await catalog.generate()
    expect(images.processCatalogImages).not.toHaveBeenCalled()
    expect(images.makePlaceholder).not.toHaveBeenCalled()
    expect(docx.generateCatalogDocx.mock.calls[0]![2]).toBeNull()
  })

  it('reporta el avance de las fotos y pasa por la fase de documento', async () => {
    const phases: string[] = []
    const catalog = useCatalogExport()
    await catalog.load()
    docx.generateCatalogDocx.mockImplementation(async () => {
      phases.push(catalog.phase.value)
      return { blob: new Blob(['x']), bytes: new Uint8Array([1]) }
    })
    images.processCatalogImages.mockImplementation(async (urls: string[], options: { onProgress?: (d: number, t: number) => void }) => {
      phases.push(catalog.phase.value)
      options.onProgress?.(1, 4)
      expect(catalog.progress.value).toEqual({ done: 1, total: 4 })
      return new Map(urls.map((url) => [url, photo()]))
    })
    await catalog.generate()
    expect(phases).toEqual(['photos', 'document'])
  })

  it('no genera con un catálogo vacío ni mientras ya está ocupado', async () => {
    const catalog = useCatalogExport()
    await catalog.load()
    useCatalogExportStore().set({ filter: { mode: 'manual', ids: [] } })
    expect(await catalog.generate()).toBe(false)
    expect(docx.generateCatalogDocx).not.toHaveBeenCalled()
  })

  it('cancelar a media preparación de fotos no es un error y no descarga nada', async () => {
    const catalog = useCatalogExport()
    await catalog.load()
    images.processCatalogImages.mockImplementation(async (_urls: string[], options: { signal: AbortSignal }) => {
      catalog.cancel()
      options.signal.throwIfAborted()
      return new Map()
    })
    const done = await catalog.generate()
    expect(done).toBe(false)
    expect(catalog.error.value).toBe('')
    expect(saveBlob).not.toHaveBeenCalled()
    expect(catalog.phase.value).toBe('idle')
  })

  it('un fallo al armar el documento muestra el mensaje y vuelve a estar libre', async () => {
    docx.generateCatalogDocx.mockRejectedValue(new Error('boom'))
    const catalog = useCatalogExport()
    await catalog.load()
    expect(await catalog.generate()).toBe(false)
    expect(catalog.error.value).toBe(VOICE.catalogExport.error)
    expect(saveBlob).not.toHaveBeenCalled()
    expect(catalog.busy.value).toBe(false)
  })
})
