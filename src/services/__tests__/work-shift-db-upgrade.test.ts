import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { openDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DB_NAME, DB_VERSION, closeLocalDb, openLocalDb } from '../local-db'

const real = globalThis.indexedDB
beforeEach(() => {
  closeLocalDb()
  globalThis.indexedDB = new IDBFactory()
})
afterEach(() => {
  closeLocalDb()
  globalThis.indexedDB = real
})

const V3_STORES = [
  'pending-sales',
  'catalog-snapshot',
  'pending-contributions',
  'contribution-history',
  'finance-references',
  'pending-expenses',
  'expense-history',
]
const NEW_STORES = ['pending-work-shifts', 'work-shift-history'] as const

describe('IndexedDB upgrade v3 -> v4 (work shifts)', () => {
  it('creates the work shift stores with keyPath `key` on a fresh database', async () => {
    const db = await openLocalDb()
    expect(DB_VERSION).toBe(4)
    expect(db.version).toBe(4)
    expect([...db.objectStoreNames].sort()).toEqual(
      [...V3_STORES, ...NEW_STORES].sort(),
    )
    for (const name of NEW_STORES)
      expect(db.transaction(name).store.keyPath).toBe('key')
  })

  it('preserves all seven version 3 stores and their data', async () => {
    const old = await openDB(DB_NAME, 3, {
      upgrade(db) {
        db.createObjectStore('pending-sales', { keyPath: 'id' })
        db.createObjectStore('catalog-snapshot', { keyPath: 'key' })
        db.createObjectStore('pending-contributions', { keyPath: 'key' })
        db.createObjectStore('contribution-history', { keyPath: 'key' })
        db.createObjectStore('finance-references', { keyPath: 'scope' })
        db.createObjectStore('pending-expenses', { keyPath: 'key' })
        db.createObjectStore('expense-history', { keyPath: 'key' })
      },
    })
    const rows = {
      'pending-sales': { id: 'sale', state: 'pending' },
      'catalog-snapshot': { key: 'current', items: [{ id: 'p' }] },
      'pending-contributions': { key: 'k1', id: 'c1', state: 'needs_review' },
      'contribution-history': { key: 'k2', scope: 's', contribution: { id: 'c2' } },
      'finance-references': { scope: 's', members: [], savedAt: 'x' },
      'pending-expenses': { key: 'k3', id: 'e1', state: 'paused' },
      'expense-history': { key: 'k4', scope: 's', expense: { id: 'e2' } },
    } as const
    for (const [store, row] of Object.entries(rows)) await old.put(store, row)
    old.close()

    const db = await openLocalDb()
    expect(db.version).toBe(4)
    expect([...db.objectStoreNames].sort()).toEqual(
      [...V3_STORES, ...NEW_STORES].sort(),
    )
    for (const [store, row] of Object.entries(rows))
      expect(await db.getAll(store as 'pending-sales')).toEqual([row])
    for (const name of NEW_STORES) expect(await db.count(name)).toBe(0)
  })

  it('upgrades from version 1 and from version 2 without errors and keeps their data', async () => {
    const v1 = await openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore('pending-sales', { keyPath: 'id' })
        db.createObjectStore('catalog-snapshot', { keyPath: 'key' })
      },
    })
    await v1.put('pending-sales', { id: 'legacy' })
    v1.close()
    const db = await openLocalDb()
    expect(await db.get('pending-sales', 'legacy')).toEqual({ id: 'legacy' })
    expect([...db.objectStoreNames]).toEqual(expect.arrayContaining([...NEW_STORES]))
    closeLocalDb()
    globalThis.indexedDB = new IDBFactory()
    const v2 = await openDB(DB_NAME, 2, {
      upgrade(d) {
        d.createObjectStore('pending-sales', { keyPath: 'id' })
        d.createObjectStore('finance-references', { keyPath: 'scope' })
      },
    })
    await v2.put('finance-references', { scope: 's', members: [], savedAt: 'x' })
    v2.close()
    const again = await openLocalDb()
    expect(await again.count('finance-references')).toBe(1)
    expect([...again.objectStoreNames]).toEqual(expect.arrayContaining([...NEW_STORES]))
  })

  it('reopening an already-current database is idempotent and keeps work shift data', async () => {
    const db = await openLocalDb()
    await db.put('pending-work-shifts', { key: 'x', id: 'x' } as never)
    await db.put('work-shift-history', { key: 'y', scope: 's' } as never)
    closeLocalDb()
    const again = await openLocalDb()
    expect(again.version).toBe(4)
    expect(await again.get('pending-work-shifts', 'x')).toEqual({ key: 'x', id: 'x' })
    expect(await again.get('work-shift-history', 'y')).toEqual({ key: 'y', scope: 's' })
  })
})
