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

const OLD_STORES = [
  'pending-sales',
  'catalog-snapshot',
  'pending-contributions',
  'contribution-history',
  'finance-references',
]

describe('IndexedDB upgrade v2 -> current (expenses)', () => {
  it('creates the expense stores on a fresh database', async () => {
    const db = await openLocalDb()
    expect(DB_VERSION).toBe(4)
    expect(db.version).toBe(DB_VERSION)
    expect([...db.objectStoreNames]).toEqual(
      expect.arrayContaining([...OLD_STORES, 'pending-expenses', 'expense-history']),
    )
    for (const name of ['pending-expenses', 'expense-history'] as const)
      expect(db.transaction(name).store.keyPath).toBe('key')
  })

  it('preserves all five version 2 stores and their data', async () => {
    const old = await openDB(DB_NAME, 2, {
      upgrade(db) {
        db.createObjectStore('pending-sales', { keyPath: 'id' })
        db.createObjectStore('catalog-snapshot', { keyPath: 'key' })
        db.createObjectStore('pending-contributions', { keyPath: 'key' })
        db.createObjectStore('contribution-history', { keyPath: 'key' })
        db.createObjectStore('finance-references', { keyPath: 'scope' })
      },
    })
    const rows = {
      'pending-sales': { id: 'sale', state: 'pending' },
      'catalog-snapshot': { key: 'current', items: [{ id: 'p' }] },
      'pending-contributions': { key: 'k1', id: 'c1', state: 'needs_review' },
      'contribution-history': { key: 'k2', scope: 's', contribution: { id: 'c2' } },
      'finance-references': { scope: 's', members: [], savedAt: 'x' },
    } as const
    for (const [store, row] of Object.entries(rows)) await old.put(store, row)
    old.close()

    const db = await openLocalDb()
    expect(db.version).toBe(DB_VERSION)
    expect([...db.objectStoreNames].sort()).toEqual(
      [
        ...OLD_STORES,
        'pending-expenses',
        'expense-history',
        'pending-work-shifts',
        'work-shift-history',
      ].sort(),
    )
    for (const [store, row] of Object.entries(rows))
      expect(await db.getAll(store as 'pending-sales')).toEqual([row])
    expect(await db.count('pending-expenses')).toBe(0)
    expect(await db.count('expense-history')).toBe(0)
  })

  it('upgrades from version 1 and from a partially-created version 2 without errors', async () => {
    const old = await openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore('pending-sales', { keyPath: 'id' })
        db.createObjectStore('catalog-snapshot', { keyPath: 'key' })
      },
    })
    await old.put('pending-sales', { id: 'legacy' })
    old.close()
    const db = await openLocalDb()
    expect(await db.get('pending-sales', 'legacy')).toEqual({ id: 'legacy' })
    expect([...db.objectStoreNames]).toContain('expense-history')
  })

  it('reopening an already-current database is idempotent and keeps expense data', async () => {
    const db = await openLocalDb()
    await db.put('pending-expenses', { key: 'x', id: 'x' } as never)
    closeLocalDb()
    const again = await openLocalDb()
    expect(again.version).toBe(DB_VERSION)
    expect(await again.get('pending-expenses', 'x')).toEqual({ key: 'x', id: 'x' })
  })
})
