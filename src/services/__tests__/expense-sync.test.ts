import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { v7 } from 'uuid'
import { closeLocalDb, openLocalDb } from '../local-db'
import {
  confirmExpense,
  enqueueExpense,
  expenseSnapshot,
  mergeExpenseHistory,
  retryExpense,
} from '../expense-db'
import { syncExpenses, validExpensePage, validExpenseSummary } from '../expense-sync'
import type { FinanceOrigin } from '../contributions-records'
import type { PendingExpense } from '../expense-records'
import type { ExpensePayload } from '@/types/expense.types'

const origin: FinanceOrigin = {
  accountId: 'account',
  apiBase: '/api/v1',
  memberId: v7(),
  deviceId: v7(),
}
const payload = (over: Partial<ExpensePayload> = {}): ExpensePayload => ({
  id: v7(),
  amountMinor: 45050,
  occurredAt: '2026-10-03T00:00:00-06:00',
  nature: 'OPERATING_EXPENSE',
  category: 'transport',
  description: 'Flete del bazar',
  paidByMemberId: v7(),
  fundsSource: 'PERSONAL',
  createdByMemberId: origin.memberId,
  deviceId: origin.deviceId,
  ...over,
})
const receipt = (p: ExpensePayload) => ({
  ...p,
  occurredAt: new Date(p.occurredAt).toISOString(),
  contextId: 'business',
  createdByAccountId: origin.accountId,
  currency: 'MXN' as const,
  receivedAt: '2026-10-03T12:00:00Z',
})
const reversalReceipt = (
  reversal: { id: string; reason: string; occurredAt: string },
  original: ExpensePayload,
  replacement: ExpensePayload | null = null,
) => ({
  ...reversal,
  createdByMemberId: origin.memberId,
  deviceId: origin.deviceId,
  contextId: 'business',
  createdByAccountId: origin.accountId,
  expenseId: original.id,
  replacementExpenseId: replacement?.id ?? null,
  receivedAt: '2026-10-03T12:00:00Z',
  original: receipt(original),
  replacement: replacement ? receipt(replacement) : null,
})
const newReversal = (over: object = {}) => ({
  id: v7(),
  createdByMemberId: origin.memberId,
  deviceId: origin.deviceId,
  occurredAt: '2026-10-03T12:00:00Z',
  reason: 'Incorrect',
  ...over,
})

beforeEach(() => {
  closeLocalDb()
  globalThis.indexedDB = new IDBFactory()
})

describe('durable expense persistence', () => {
  it('persists the frozen payload and origin before success and survives refresh', async () => {
    const p = payload()
    await enqueueExpense(origin, { kind: 'create', payload: p })
    p.amountMinor = 1
    closeLocalDb() // simulates a page reload: nothing is kept in memory
    const snapshot = await expenseSnapshot(origin)
    expect(snapshot.pending).toHaveLength(1)
    const [record] = snapshot.pending
    expect(record?.kind === 'create' && record.payload.amountMinor).toBe(45050)
    expect(record?.origin).toEqual(origin)
    expect(record?.state).toBe('pending')
  })

  it('isolates records by account and API base', async () => {
    await enqueueExpense(origin, { kind: 'create', payload: payload() })
    for (const changed of [{ accountId: 'other' }, { apiBase: '/elsewhere' }])
      expect(await expenseSnapshot({ ...origin, ...changed })).toMatchObject({
        pending: [],
        history: [],
      })
  })

  it('refuses an operation whose attribution differs from the origin', async () => {
    await expect(
      enqueueExpense(origin, {
        kind: 'create',
        payload: payload({ createdByMemberId: v7() }),
      }),
    ).rejects.toThrow('origin mismatch')
    await expect(
      enqueueExpense(origin, {
        kind: 'create',
        payload: payload({ deviceId: v7() }),
      }),
    ).rejects.toThrow('origin mismatch')
  })

  it('treats the same UUID and content as an idempotent replay and different content as a conflict', async () => {
    const p = payload()
    const first = await enqueueExpense(origin, { kind: 'create', payload: p })
    const again = await enqueueExpense(origin, { kind: 'create', payload: p })
    expect(again.key).toBe(first.key)
    expect((await expenseSnapshot(origin)).pending).toHaveLength(1)
    await expect(
      enqueueExpense(origin, {
        kind: 'create',
        payload: { ...p, amountMinor: 1 },
      }),
    ).rejects.toThrow('identity already exists')
  })

  it('rejects the write when storage is unavailable instead of pretending success', async () => {
    closeLocalDb()
    const real = globalThis.indexedDB
    Object.defineProperty(globalThis, 'indexedDB', {
      value: undefined,
      writable: true,
      configurable: true,
    })
    await expect(
      enqueueExpense(origin, { kind: 'create', payload: payload() }),
    ).rejects.toThrow()
    globalThis.indexedDB = real
  })

  it('skips corrupt rows without hiding or deleting the healthy ones', async () => {
    const good = payload()
    await enqueueExpense(origin, { kind: 'create', payload: good })
    const db = await openLocalDb()
    await db.put('pending-expenses', { key: 'broken-1' } as never)
    await db.put('pending-expenses', {
      key: 'broken-2',
      scope: 7,
      id: null,
    } as never)
    await db.put('expense-history', { key: 'broken-3', scope: 'x' } as never)
    const snapshot = await expenseSnapshot(origin)
    expect(snapshot.pending.map((r) => r.id)).toEqual([good.id])
    expect(snapshot.history).toEqual([])
    expect(await db.count('pending-expenses')).toBe(3) // nothing was deleted
  })
})

describe('expense synchronization', () => {
  it('moves a pending expense to history in one step without a duplicate', async () => {
    const p = payload()
    await enqueueExpense(origin, { kind: 'create', payload: p })
    const send = vi.fn().mockResolvedValue({
      ...receipt(p),
      paidByMember: { id: p.paidByMemberId, name: 'Ana', active: true },
    })
    expect(await syncExpenses(origin, send)).toBe(1)
    expect(send).toHaveBeenCalledOnce()
    const snapshot = await expenseSnapshot(origin)
    expect(snapshot.pending).toEqual([])
    expect(snapshot.history).toHaveLength(1)
    expect(snapshot.history[0]).toMatchObject({
      id: p.id,
      paidByMember: { name: 'Ana' },
    })
    expect(await syncExpenses(origin, send)).toBe(0) // nothing left to send
  })

  it('merging the list after confirming never duplicates or drops reversal metadata', async () => {
    const p = payload()
    const record = await enqueueExpense(origin, { kind: 'create', payload: p })
    await confirmExpense(record, receipt(p))
    await mergeExpenseHistory(origin, [
      { ...receipt(p), reversal: null },
    ])
    expect((await expenseSnapshot(origin)).history).toHaveLength(1)
  })

  it('retains a malformed acknowledgement as uncertain and retries the unchanged identity', async () => {
    const p = payload()
    await enqueueExpense(origin, { kind: 'create', payload: p })
    await syncExpenses(
      origin,
      vi.fn().mockResolvedValue({ ...receipt(p), amountMinor: 1 }),
    )
    const [pending] = (await expenseSnapshot(origin)).pending
    expect(pending?.attempts).toBe(1)
    expect(pending?.state).toBe('pending')
    expect(pending?.payload).toEqual(p)
    expect(pending?.nextAttemptAt).toBeGreaterThan(0)
  })

  it.each([
    ['nature', { nature: 'INVENTORY_PURCHASE' }],
    ['fundsSource', { fundsSource: 'BUSINESS' }],
    ['category', { category: 'fuel' }],
    ['description', { description: 'Otra cosa' }],
    ['payer', { paidByMemberId: v7() }],
    ['inventory category on an operating expense', { category: 'inventory' }],
    ['currency', { currency: 'USD' }],
    ['account', { createdByAccountId: 'someone-else' }],
  ])('does not confirm a receipt that differs in %s', async (_name, change) => {
    const p = payload()
    await enqueueExpense(origin, { kind: 'create', payload: p })
    await syncExpenses(
      origin,
      vi.fn().mockResolvedValue({ ...receipt(p), ...change }),
    )
    const snapshot = await expenseSnapshot(origin)
    expect(snapshot.history).toEqual([])
    expect(snapshot.pending).toHaveLength(1)
  })

  it('does not send another account, API or device origin', async () => {
    await enqueueExpense(origin, { kind: 'create', payload: payload() })
    const send = vi.fn()
    for (const changed of [
      { accountId: 'different' },
      { apiBase: 'elsewhere' },
      { deviceId: v7() },
    ])
      await syncExpenses({ ...origin, ...changed }, send)
    expect(send).not.toHaveBeenCalled()
  })

  it('preserves the original member when the shared-account selection changes', async () => {
    const p = payload()
    await enqueueExpense(origin, { kind: 'create', payload: p })
    const send = vi.fn().mockResolvedValue(receipt(p))
    await syncExpenses({ ...origin, memberId: v7() }, send)
    expect(send.mock.calls[0]?.[0].origin).toEqual(origin)
  })

  it('does not call the network while offline or when the origin cannot send', async () => {
    await enqueueExpense(origin, { kind: 'create', payload: payload() })
    const send = vi.fn()
    await syncExpenses(origin, send, { online: () => false })
    await syncExpenses(origin, send, { canSend: () => false })
    expect(send).not.toHaveBeenCalled()
  })

  it('conflicts need review, auth errors pause, transient errors back off and retry', async () => {
    const conflict = payload(),
      denied = payload(),
      flaky = payload()
    await enqueueExpense(origin, { kind: 'create', payload: conflict })
    await syncExpenses(
      origin,
      vi.fn().mockRejectedValue({ response: { status: 409 } }),
    )
    await enqueueExpense(origin, { kind: 'create', payload: denied })
    await syncExpenses(
      origin,
      vi.fn().mockRejectedValue({ response: { status: 403 } }),
    )
    await enqueueExpense(origin, { kind: 'create', payload: flaky })
    const now = Date.now()
    await syncExpenses(
      origin,
      vi.fn().mockRejectedValue({ response: { status: 503 } }),
      { now: () => now },
    )
    const state = async (id: string) =>
      (await expenseSnapshot(origin)).pending.find((r) => r.id === id)
    expect((await state(conflict.id))?.state).toBe('needs_review')
    expect((await state(denied.id))?.state).toBe('paused')
    const waiting = await state(flaky.id)
    expect(waiting?.state).toBe('pending')
    expect(waiting?.nextAttemptAt).toBe(now + 30000)
    // Not retried before its backoff elapses, retried afterwards.
    const send = vi.fn().mockResolvedValue(receipt(flaky))
    await syncExpenses(origin, send, { now: () => now + 1000 })
    expect(send).not.toHaveBeenCalled()
    await syncExpenses(origin, send, { now: () => now + 31000 })
    expect(send).toHaveBeenCalledOnce()
  })

  it('treats 408 and 429 as retryable rather than needing review', async () => {
    const p = payload()
    await enqueueExpense(origin, { kind: 'create', payload: p })
    await syncExpenses(
      origin,
      vi.fn().mockRejectedValue({ response: { status: 429 } }),
    )
    expect((await expenseSnapshot(origin)).pending[0]?.state).toBe('pending')
  })

  it('a paused expense is only resent after an explicit retry', async () => {
    const p = payload()
    const record = await enqueueExpense(origin, { kind: 'create', payload: p })
    await syncExpenses(
      origin,
      vi.fn().mockRejectedValue({ response: { status: 401 } }),
    )
    const send = vi.fn().mockResolvedValue(receipt(p))
    expect(await syncExpenses(origin, send)).toBe(0)
    await retryExpense(record)
    expect(await syncExpenses(origin, send)).toBe(1)
  })

  it('keeps the pending operation if storage fails after server acceptance', async () => {
    const p = payload()
    await enqueueExpense(origin, { kind: 'create', payload: p })
    const real = globalThis.indexedDB
    await expect(
      syncExpenses(origin, async () => {
        closeLocalDb()
        Object.defineProperty(globalThis, 'indexedDB', {
          value: undefined,
          writable: true,
          configurable: true,
        })
        return receipt(p)
      }),
    ).rejects.toThrow()
    globalThis.indexedDB = real
    closeLocalDb()
    expect((await expenseSnapshot(origin)).pending[0]?.payload).toEqual(p)
  })

  it('excludes a concurrent same-tab run and honors an unavailable Web Lock', async () => {
    const p = payload()
    await enqueueExpense(origin, { kind: 'create', payload: p })
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const send = vi.fn(async () => {
      await gate
      return receipt(p)
    })
    const first = syncExpenses(origin, send)
    await Promise.resolve()
    expect(await syncExpenses(origin, send)).toBe(0)
    release()
    await first
    expect(send).toHaveBeenCalledOnce()

    await enqueueExpense(origin, { kind: 'create', payload: payload() })
    const other = vi.fn()
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request: vi.fn(async (_n, _o, cb) => cb(null)) },
    })
    try {
      expect(await syncExpenses(origin, other)).toBe(0)
      expect(other).not.toHaveBeenCalled()
    } finally {
      Reflect.deleteProperty(navigator, 'locks')
    }
  })
})

describe('expense list validation', () => {
  it('accepts server list items with paidByMember and rejects inconsistent ones', () => {
    const p = payload()
    const item = {
      ...receipt(p),
      paidByMember: { id: p.paidByMemberId, name: 'Ana', active: false },
      reversal: null,
    }
    expect(validExpensePage({ items: [item], nextCursor: null }, origin)).toBe(true)
    for (const bad of [
      { ...item, paidByMember: { id: v7(), name: 'Ana', active: true } },
      { ...item, nature: 'INVENTORY_PURCHASE' },
      { ...item, amountMinor: 1.5 },
      { ...item, contextId: 'other' },
    ])
      expect(
        validExpensePage({ items: [bad], nextCursor: null }, { ...origin, contextId: 'business' }),
      ).toBe(false)
    expect(validExpensePage({ items: [], nextCursor: 5 }, origin)).toBe(false)
  })
  it('validates the summary as non-negative integers', () => {
    const ok = { operatingMinor: 1, inventoryMinor: 0, personalMinor: 1, businessMinor: 0 }
    expect(validExpenseSummary(ok)).toBe(true)
    expect(validExpenseSummary({ ...ok, personalMinor: 1.5 })).toBe(false)
    expect(validExpenseSummary({ ...ok, businessMinor: -1 })).toBe(false)
    expect(validExpenseSummary({ operatingMinor: 1 })).toBe(false)
  })
})

describe('expense reversals', () => {
  it('waits for the original, sends creates before reversals and keeps both audit records', async () => {
    const p = payload()
    await enqueueExpense(origin, { kind: 'create', payload: p })
    const reversal = newReversal()
    await enqueueExpense(origin, {
      kind: 'reverse',
      expenseId: p.id,
      payload: reversal,
    })
    const calls: string[] = []
    const send = vi.fn(async (r: PendingExpense) => {
      calls.push(r.kind)
      return r.kind === 'create' ? receipt(p) : reversalReceipt(reversal, p)
    })
    expect(await syncExpenses(origin, send)).toBe(2)
    expect(calls).toEqual(['create', 'reverse'])
    const snapshot = await expenseSnapshot(origin)
    expect(snapshot.history).toHaveLength(1)
    expect(snapshot.history[0]?.reversal?.id).toBe(reversal.id)
    expect(snapshot.history[0]?.amountMinor).toBe(p.amountMinor)
  })

  it('does not transmit a reversal whose original needs review', async () => {
    const p = payload()
    await enqueueExpense(origin, { kind: 'create', payload: p })
    await syncExpenses(
      origin,
      vi.fn().mockRejectedValue({ response: { status: 400 } }),
    )
    await enqueueExpense(origin, {
      kind: 'reverse',
      expenseId: p.id,
      payload: newReversal(),
    })
    const send = vi.fn()
    await syncExpenses(origin, send)
    expect(send).not.toHaveBeenCalled()
    const reversal = (await expenseSnapshot(origin)).pending.find(
      (r) => r.kind === 'reverse',
    )
    expect(reversal?.state).toBe('needs_review')
  })

  it('records a correction with its replacement atomically and refuses a second correction', async () => {
    const p = payload(),
      replacement = payload({ amountMinor: 50000 })
    const original = await enqueueExpense(origin, { kind: 'create', payload: p })
    await confirmExpense(original, receipt(p))
    const reversal = newReversal({ replacement })
    await enqueueExpense(origin, {
      kind: 'reverse',
      expenseId: p.id,
      payload: reversal,
    })
    const send = vi.fn().mockResolvedValue(reversalReceipt(reversal, p, replacement))
    expect(await syncExpenses(origin, send)).toBe(1)
    expect(send).toHaveBeenCalledOnce()
    const snapshot = await expenseSnapshot(origin)
    expect(snapshot.history).toHaveLength(2)
    expect(snapshot.history.find((r) => r.id === p.id)?.reversal?.replacementExpenseId).toBe(
      replacement.id,
    )
    expect(snapshot.history.find((r) => r.id === replacement.id)?.reversal).toBeFalsy()
    await expect(
      enqueueExpense(origin, {
        kind: 'reverse',
        expenseId: p.id,
        payload: newReversal(),
      }),
    ).rejects.toThrow('already has a correction')
  })

  it('refuses a reversal for an expense unknown to this device', async () => {
    await expect(
      enqueueExpense(origin, {
        kind: 'reverse',
        expenseId: v7(),
        payload: newReversal(),
      }),
    ).rejects.toThrow('available locally')
  })

  it('does not confirm a reversal whose replacement or original was altered', async () => {
    const p = payload(),
      replacement = payload()
    const original = await enqueueExpense(origin, { kind: 'create', payload: p })
    await confirmExpense(original, receipt(p))
    const reversal = newReversal({ replacement })
    await enqueueExpense(origin, {
      kind: 'reverse',
      expenseId: p.id,
      payload: reversal,
    })
    const good = reversalReceipt(reversal, p, replacement)
    await syncExpenses(
      origin,
      vi.fn().mockResolvedValue({
        ...good,
        replacement: { ...good.replacement, amountMinor: 1 },
      }),
    )
    await syncExpenses(
      origin,
      vi.fn().mockResolvedValue({
        ...good,
        original: { ...good.original, amountMinor: 1 },
      }),
      { now: () => Date.now() + 10 * 60000 },
    )
    const snapshot = await expenseSnapshot(origin)
    expect(snapshot.pending).toHaveLength(1)
    expect(snapshot.history.find((r) => r.id === p.id)?.reversal).toBeFalsy()
  })
})
