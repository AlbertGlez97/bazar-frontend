import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  CATALOG_SNAPSHOT_STORE,
  DB_NAME,
  DB_VERSION,
  LocalDbUnavailableError,
  PENDING_SALES_STORE,
  closeLocalDb,
  loadCatalogSnapshot,
  openLocalDb,
  saveCatalogSnapshot,
} from '../local-db'
import type { Product } from '@/types/product.types'

const realIndexedDb = globalThis.indexedDB

function fresh() {
  closeLocalDb()
  globalThis.indexedDB = new IDBFactory()
}

const product: Product = {
  id: 'p-1', name: 'Taza', tipo: 'cantidad', unitPriceMinor: 1999, initialStock: 5, stock: 5,
  category: 'Cocina', purchaseCostMinor: null, supplier: null, notes: null,
  createdAt: '2026-09-01T00:00:00.000Z', active: true, image: null,
}

beforeEach(fresh)
afterEach(() => {
  closeLocalDb()
  globalThis.indexedDB = realIndexedDb
})

describe('openLocalDb', () => {
  it('abre la base "la-marchanta" versión 1 con sus dos almacenes', async () => {
    const db = await openLocalDb()

    expect(DB_NAME).toBe('la-marchanta')
    expect(DB_VERSION).toBe(1)
    expect(db.name).toBe('la-marchanta')
    expect(db.version).toBe(1)
    expect([...db.objectStoreNames].sort()).toEqual([CATALOG_SNAPSHOT_STORE, PENDING_SALES_STORE].sort())
    expect(db.transaction(PENDING_SALES_STORE).store.keyPath).toBe('id')
  })

  it('es perezosa y reutiliza la misma conexión', async () => {
    const first = await openLocalDb()
    const second = await openLocalDb()
    expect(second).toBe(first)
  })

  it('tras closeLocalDb reabre y los datos siguen ahí (como recargar la página)', async () => {
    await saveCatalogSnapshot([product])
    closeLocalDb()

    const snapshot = await loadCatalogSnapshot()
    expect(snapshot?.items).toEqual([product])
  })

  it('sin IndexedDB (undefined) lanza LocalDbUnavailableError', async () => {
    closeLocalDb()
    // @ts-expect-error simulamos un navegador sin IndexedDB
    globalThis.indexedDB = undefined
    await expect(openLocalDb()).rejects.toBeInstanceOf(LocalDbUnavailableError)
  })

  it('si indexedDB.open lanza (modo privado, permisos), lanza LocalDbUnavailableError', async () => {
    closeLocalDb()
    globalThis.indexedDB = {
      open() { throw new DOMException('denied', 'SecurityError') },
    } as unknown as IDBFactory
    await expect(openLocalDb()).rejects.toBeInstanceOf(LocalDbUnavailableError)
  })

  it('un fallo no deja una promesa rota en caché: al volver IndexedDB, reabre', async () => {
    closeLocalDb()
    // @ts-expect-error simulamos un navegador sin IndexedDB
    globalThis.indexedDB = undefined
    await expect(openLocalDb()).rejects.toBeInstanceOf(LocalDbUnavailableError)

    globalThis.indexedDB = new IDBFactory()
    await expect(openLocalDb()).resolves.toBeDefined()
  })
})

describe('snapshot del catálogo', () => {
  it('guarda y carga el último snapshot con su fecha', async () => {
    const saved = await saveCatalogSnapshot([product], '2026-09-25T10:00:00.000Z')
    expect(saved).toBe(true)

    expect(await loadCatalogSnapshot()).toEqual({ savedAt: '2026-09-25T10:00:00.000Z', items: [product] })
  })

  it('guardar de nuevo REEMPLAZA el snapshot (un solo registro)', async () => {
    await saveCatalogSnapshot([product], '2026-09-25T10:00:00.000Z')
    await saveCatalogSnapshot([{ ...product, stock: 2 }], '2026-09-25T11:00:00.000Z')

    const snapshot = await loadCatalogSnapshot()
    expect(snapshot?.items).toHaveLength(1)
    expect(snapshot?.items[0].stock).toBe(2)
    expect(snapshot?.savedAt).toBe('2026-09-25T11:00:00.000Z')
  })

  it('sin snapshot devuelve null', async () => {
    expect(await loadCatalogSnapshot()).toBeNull()
  })

  it('si IndexedDB no está disponible: guardar devuelve false y cargar null (sin lanzar)', async () => {
    closeLocalDb()
    // @ts-expect-error simulamos un navegador sin IndexedDB
    globalThis.indexedDB = undefined

    expect(await saveCatalogSnapshot([product])).toBe(false)
    expect(await loadCatalogSnapshot()).toBeNull()
  })
})
