import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { openDB } from 'idb'
import { beforeEach, afterEach, describe, it, expect } from 'vitest'
import { DB_NAME, closeLocalDb, openLocalDb } from '../local-db'
const real = globalThis.indexedDB
beforeEach(() => {
  closeLocalDb()
  globalThis.indexedDB = new IDBFactory()
})
afterEach(() => {
  closeLocalDb()
  globalThis.indexedDB = real
})
describe('finance database upgrade', () => {
  it('adds separate finance stores', async () => {
    const db = await openLocalDb()
    expect(db.version).toBe(3)
    expect([...db.objectStoreNames]).toContain('pending-contributions')
    expect([...db.objectStoreNames]).toContain('contribution-history')
    expect([...db.objectStoreNames]).toContain('finance-references')
  })
  it('retains actual legacy cash/debt operations and catalog from version 1', async () => {
    const old = await openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore('pending-sales', { keyPath: 'id' })
        db.createObjectStore('catalog-snapshot', { keyPath: 'key' })
      },
    })
    const cash = {
      id: 'cash',
      payload: { memberId: 'original' },
      state: 'pending',
    }
    const debt = {
      id: 'debt',
      kind: 'debt',
      origin: { accountId: 'a' },
      state: 'needs_review',
    }
    await old.put('pending-sales', cash)
    await old.put('pending-sales', debt)
    await old.put('catalog-snapshot', { key: 'current', items: [{ id: 'p' }] })
    old.close()
    const db = await openLocalDb()
    expect(db.version).toBe(3)
    expect(await db.getAll('pending-sales')).toEqual([cash, debt])
    expect(await db.get('catalog-snapshot', 'current')).toEqual({
      key: 'current',
      items: [{ id: 'p' }],
    })
  })
})
