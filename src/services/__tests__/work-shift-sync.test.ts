import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { v7 } from 'uuid'
import { closeLocalDb } from '../local-db'
import {
  enqueueWorkShift,
  retryWorkShift,
  workShiftSnapshot,
} from '../work-shift-db'
import {
  isWorkShift,
  syncWorkShifts,
  validWorkShiftPage,
  validWorkShiftSummary,
} from '../work-shift-sync'
import type { FinanceOrigin } from '../contributions-records'
import type { WorkShiftPayload } from '@/types/work-shift.types'

const origin: FinanceOrigin = {
  accountId: 'account',
  apiBase: '/api/v1',
  memberId: v7(),
  deviceId: v7(),
}
const payload = (over: Partial<WorkShiftPayload> = {}): WorkShiftPayload => ({
  id: v7(),
  memberId: v7(),
  workDate: '2026-10-03',
  minutes: 510,
  note: 'Turno completo',
  createdByMemberId: origin.memberId,
  deviceId: origin.deviceId,
  ...over,
})
const receipt = (p: WorkShiftPayload, over: object = {}) => ({
  ...p,
  contextId: 'business',
  createdByAccountId: origin.accountId,
  receivedAt: '2026-10-03T12:00:00.000Z',
  warnings: [],
  ...over,
})
const state = async (id: string) =>
  (await workShiftSnapshot(origin)).pending.find((r) => r.id === id)

beforeEach(() => {
  closeLocalDb()
  globalThis.indexedDB = new IDBFactory()
})

describe('work shift synchronization', () => {
  it('moves a pending shift to history in one step without a duplicate', async () => {
    const p = payload()
    await enqueueWorkShift(origin, { kind: 'create', payload: p })
    const send = vi.fn().mockResolvedValue(receipt(p))
    expect(await syncWorkShifts(origin, send)).toBe(1)
    expect(send).toHaveBeenCalledOnce()
    const snapshot = await workShiftSnapshot(origin)
    expect(snapshot.pending).toEqual([])
    expect(snapshot.history).toHaveLength(1)
    expect(snapshot.history[0]).toMatchObject({ id: p.id, minutes: 510, workDate: '2026-10-03' })
    expect(await syncWorkShifts(origin, send)).toBe(0)
  })

  it('confirms an unknown duration without inventing minutes', async () => {
    const p = payload({ minutes: null, note: null })
    await enqueueWorkShift(origin, { kind: 'create', payload: p })
    expect(await syncWorkShifts(origin, vi.fn().mockResolvedValue(receipt(p)))).toBe(1)
    expect((await workShiftSnapshot(origin)).history[0]?.minutes).toBeNull()
  })

  it('stores the same-day warning frozen in the real receipt', async () => {
    const p = payload()
    await enqueueWorkShift(origin, { kind: 'create', payload: p })
    const warnings = [{ code: 'MULTIPLE_SHIFTS_SAME_DAY', existingActiveShiftCount: 1 }]
    await syncWorkShifts(origin, vi.fn().mockResolvedValue(receipt(p, { warnings })))
    expect((await workShiftSnapshot(origin)).history[0]?.warnings).toEqual(warnings)
  })

  it('a 200 replay of the same identity is accepted and does not duplicate', async () => {
    const p = payload()
    await enqueueWorkShift(origin, { kind: 'create', payload: p })
    await syncWorkShifts(origin, vi.fn().mockRejectedValue({ response: { status: 503 } }), { now: () => 0 })
    // The server had already stored it: the replay returns the frozen receipt.
    expect(await syncWorkShifts(origin, vi.fn().mockResolvedValue(receipt(p)), { now: () => 10 * 60000 })).toBe(1)
    expect((await workShiftSnapshot(origin)).history).toHaveLength(1)
  })

  it('retains a malformed acknowledgement as uncertain and retries the unchanged identity', async () => {
    const p = payload()
    await enqueueWorkShift(origin, { kind: 'create', payload: p })
    await syncWorkShifts(origin, vi.fn().mockResolvedValue(receipt(p, { minutes: 1 })))
    const record = await state(p.id)
    expect(record).toMatchObject({ attempts: 1, state: 'pending', payload: p })
    expect(record?.nextAttemptAt).toBeGreaterThan(0)
  })

  it.each([
    ['member', { memberId: v7() }],
    ['date', { workDate: '2026-10-04' }],
    ['minutes', { minutes: 60 }],
    ['unknown minutes sent as 0', { minutes: 0 }],
    ['note', { note: 'Otra cosa' }],
    ['account', { createdByAccountId: 'someone-else' }],
    ['recorder', { createdByMemberId: v7() }],
    ['device', { deviceId: v7() }],
    ['missing warnings', { warnings: undefined }],
    ['malformed warning', { warnings: [{ code: 'OTHER', existingActiveShiftCount: 1 }] }],
    ['an impossible date', { workDate: '2026-02-30' }],
  ])('does not confirm a receipt that differs in %s', async (_name, change) => {
    const p = payload()
    await enqueueWorkShift(origin, { kind: 'create', payload: p })
    await syncWorkShifts(origin, vi.fn().mockResolvedValue({ ...receipt(p), ...change }))
    const snapshot = await workShiftSnapshot(origin)
    expect(snapshot.history).toEqual([])
    expect(snapshot.pending).toHaveLength(1)
  })

  it('does not confirm a receipt from another business when the context is known', async () => {
    const p = payload()
    await enqueueWorkShift({ ...origin, contextId: 'business' }, { kind: 'create', payload: p })
    await syncWorkShifts(
      { ...origin, contextId: 'business' },
      vi.fn().mockResolvedValue(receipt(p, { contextId: 'other' })),
    )
    expect((await workShiftSnapshot(origin)).history).toEqual([])
  })

  it('does not send another account, API or device origin', async () => {
    await enqueueWorkShift(origin, { kind: 'create', payload: payload() })
    const send = vi.fn()
    for (const changed of [{ accountId: 'different' }, { apiBase: 'elsewhere' }, { deviceId: v7() }])
      await syncWorkShifts({ ...origin, ...changed }, send)
    expect(send).not.toHaveBeenCalled()
  })

  it('preserves the original member when the shared-account selection changes', async () => {
    const p = payload()
    await enqueueWorkShift(origin, { kind: 'create', payload: p })
    const send = vi.fn().mockResolvedValue(receipt(p))
    await syncWorkShifts({ ...origin, memberId: v7() }, send)
    expect(send.mock.calls[0]?.[0].origin).toEqual(origin)
  })

  it('does not call the network while offline or when the origin cannot send', async () => {
    await enqueueWorkShift(origin, { kind: 'create', payload: payload() })
    const send = vi.fn()
    await syncWorkShifts(origin, send, { online: () => false })
    await syncWorkShifts(origin, send, { canSend: () => false })
    expect(send).not.toHaveBeenCalled()
  })

  it('conflicts need review, auth errors pause, transient errors back off and retry', async () => {
    const conflict = payload(),
      denied = payload(),
      flaky = payload()
    await enqueueWorkShift(origin, { kind: 'create', payload: conflict })
    await syncWorkShifts(origin, vi.fn().mockRejectedValue({ response: { status: 409 } }))
    await enqueueWorkShift(origin, { kind: 'create', payload: denied })
    await syncWorkShifts(origin, vi.fn().mockRejectedValue({ response: { status: 403 } }))
    await enqueueWorkShift(origin, { kind: 'create', payload: flaky })
    const now = Date.now()
    await syncWorkShifts(origin, vi.fn().mockRejectedValue({ response: { status: 503 } }), { now: () => now })
    expect((await state(conflict.id))?.state).toBe('needs_review')
    expect((await state(denied.id))?.state).toBe('paused')
    const waiting = await state(flaky.id)
    expect(waiting).toMatchObject({ state: 'pending', nextAttemptAt: now + 30000 })
    const send = vi.fn().mockResolvedValue(receipt(flaky))
    await syncWorkShifts(origin, send, { now: () => now + 1000 })
    expect(send).not.toHaveBeenCalled()
    await syncWorkShifts(origin, send, { now: () => now + 31000 })
    expect(send).toHaveBeenCalledOnce()
  })

  it('a paused shift is only resent after an explicit retry', async () => {
    const p = payload()
    const record = await enqueueWorkShift(origin, { kind: 'create', payload: p })
    await syncWorkShifts(origin, vi.fn().mockRejectedValue({ response: { status: 401 } }))
    const send = vi.fn().mockResolvedValue(receipt(p))
    expect(await syncWorkShifts(origin, send)).toBe(0)
    await retryWorkShift(record)
    expect(await syncWorkShifts(origin, send)).toBe(1)
  })

  it('keeps the pending operation if storage fails after server acceptance', async () => {
    const p = payload()
    await enqueueWorkShift(origin, { kind: 'create', payload: p })
    const real = globalThis.indexedDB
    await expect(
      syncWorkShifts(origin, async () => {
        closeLocalDb()
        Object.defineProperty(globalThis, 'indexedDB', { value: undefined, writable: true, configurable: true })
        return receipt(p)
      }),
    ).rejects.toThrow()
    globalThis.indexedDB = real
    closeLocalDb()
    expect((await workShiftSnapshot(origin)).pending[0]?.payload).toEqual(p)
  })

  it('excludes a concurrent same-tab run and honors an unavailable Web Lock', async () => {
    const p = payload()
    await enqueueWorkShift(origin, { kind: 'create', payload: p })
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const send = vi.fn(async () => {
      await gate
      return receipt(p)
    })
    const first = syncWorkShifts(origin, send)
    await Promise.resolve()
    expect(await syncWorkShifts(origin, send)).toBe(0)
    release()
    await first
    expect(send).toHaveBeenCalledOnce()

    await enqueueWorkShift(origin, { kind: 'create', payload: payload() })
    const other = vi.fn()
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request: vi.fn(async (_n, _o, cb) => cb(null)) },
    })
    try {
      expect(await syncWorkShifts(origin, other)).toBe(0)
      expect(other).not.toHaveBeenCalled()
    } finally {
      Reflect.deleteProperty(navigator, 'locks')
    }
  })
})

describe('work shift response validation', () => {
  const item = () => {
    const p = payload()
    const { warnings: _omit, ...rest } = receipt(p)
    void _omit
    return {
      ...rest,
      member: { id: p.memberId, name: 'Ana', active: false, role: 'colaborador' },
      reversal: null,
      replacedByReversal: null,
    }
  }
  it('accepts a real list item (no warnings, member, null reversal) and a reversed one', () => {
    const base = item()
    expect(isWorkShift(base)).toBe(true)
    expect(validWorkShiftPage({ items: [base], nextCursor: null }, origin)).toBe(true)
    const reversed = { ...base, reversal: { id: v7(), replacementWorkShiftId: null } }
    expect(validWorkShiftPage({ items: [reversed], nextCursor: 'abc' }, origin)).toBe(true)
  })
  it('rejects inconsistent list items and a foreign business', () => {
    const base = item()
    for (const bad of [
      { ...base, member: { ...base.member, id: v7() } },
      { ...base, minutes: 0 },
      { ...base, minutes: 1.5 },
      { ...base, minutes: -3 },
      { ...base, workDate: '2026-13-01' },
      { ...base, workDate: '2026-10-03T00:00:00Z' },
      { ...base, note: 'x'.repeat(1001) },
      { ...base, contextId: 'other' },
      { ...base, reversal: { id: 'not-a-uuid' } },
    ])
      expect(
        validWorkShiftPage({ items: [bad], nextCursor: null }, { ...origin, contextId: 'business' }),
      ).toBe(false)
    expect(validWorkShiftPage({ items: [], nextCursor: 5 }, origin)).toBe(false)
  })
  it('validates the summary as non-negative integer counts', () => {
    const member = { memberId: v7(), member: { id: 'x', name: 'Ana', role: 'socio', active: true }, shiftCount: 2, knownMinutes: 90, unknownDurationCount: 1 }
    const ok = { totals: { shiftCount: 2, knownMinutes: 90, unknownDurationCount: 1 }, members: [member] }
    expect(validWorkShiftSummary(ok)).toBe(true)
    expect(validWorkShiftSummary({ totals: ok.totals, members: [] })).toBe(true)
    expect(validWorkShiftSummary({ ...ok, totals: { ...ok.totals, knownMinutes: -1 } })).toBe(false)
    expect(validWorkShiftSummary({ ...ok, totals: { ...ok.totals, shiftCount: 1.5 } })).toBe(false)
    expect(validWorkShiftSummary({ ...ok, totals: { ...ok.totals, unknownDurationCount: 5 } })).toBe(false)
    expect(validWorkShiftSummary({ ...ok, members: [{ ...member, shiftCount: 'x' }] })).toBe(false)
    expect(validWorkShiftSummary({ totals: ok.totals })).toBe(false)
  })
})
