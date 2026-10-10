import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { v7 } from 'uuid'
import { closeLocalDb, DB_VERSION } from '../local-db'
import {
  enqueueWorkShift,
  retryWorkShift,
  workShiftSnapshot,
} from '../work-shift-db'
import { syncWorkShifts } from '../work-shift-sync'
import type { FinanceOrigin } from '../contributions-records'
import type { PendingWorkShift } from '../work-shift-records'
import type {
  WorkShiftPayload,
  WorkShiftReversalPayload,
} from '@/types/work-shift.types'

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
const newReversal = (
  over: Partial<WorkShiftReversalPayload> = {},
): WorkShiftReversalPayload => ({
  id: v7(),
  createdByMemberId: origin.memberId,
  deviceId: origin.deviceId,
  occurredAt: '2026-10-05T12:00:00.000Z',
  reason: 'Duración incorrecta',
  ...over,
})
const reversalReceipt = (
  reversal: WorkShiftReversalPayload,
  original: WorkShiftPayload,
  replacement: WorkShiftPayload | null = null,
  over: object = {},
) => ({
  id: reversal.id,
  workShiftId: original.id,
  replacementWorkShiftId: replacement?.id ?? null,
  reason: reversal.reason,
  occurredAt: reversal.occurredAt,
  createdByMemberId: origin.memberId,
  deviceId: origin.deviceId,
  contextId: 'business',
  createdByAccountId: origin.accountId,
  receivedAt: '2026-10-05T12:00:01.000Z',
  original: receipt(original),
  replacement: replacement ? receipt(replacement) : null,
  ...over,
})
const queueReverse = (
  workShiftId: string,
  reversal = newReversal(),
  o: FinanceOrigin = origin,
) =>
  enqueueWorkShift(o, { kind: 'reverse', workShiftId, payload: reversal })

beforeEach(() => {
  closeLocalDb()
  globalThis.indexedDB = new IDBFactory()
})

describe('work shift reversal persistence', () => {
  it('keeps the IndexedDB schema at version 4 (no upgrade is needed)', () => {
    expect(DB_VERSION).toBe(4)
  })

  it('persists a reversal against a pending original and survives a reload', async () => {
    const p = payload()
    await enqueueWorkShift(origin, { kind: 'create', payload: p })
    const reversal = newReversal({ replacement: payload({ minutes: null, note: null }) })
    await queueReverse(p.id, reversal)
    closeLocalDb()
    const { pending } = await workShiftSnapshot(origin)
    expect(pending.map((r) => r.kind).sort()).toEqual(['create', 'reverse'])
    const stored = pending.find((r) => r.kind === 'reverse')
    expect(stored).toMatchObject({
      id: reversal.id,
      workShiftId: p.id,
      state: 'pending',
      origin,
      payload: { reason: 'Duración incorrecta' },
    })
    expect(stored?.payload).toMatchObject({
      replacement: { minutes: null, note: null },
    })
  })

  it('refuses a reversal whose original is unknown to this device', async () => {
    await expect(queueReverse(v7())).rejects.toThrow('available locally')
  })

  it('refuses a second reversal of the same shift but replays the identical one', async () => {
    const p = payload()
    await enqueueWorkShift(origin, { kind: 'create', payload: p })
    const reversal = newReversal()
    await queueReverse(p.id, reversal)
    await expect(queueReverse(p.id, reversal)).resolves.toMatchObject({ id: reversal.id })
    await expect(queueReverse(p.id)).rejects.toThrow('already has a correction')
    expect((await workShiftSnapshot(origin)).pending).toHaveLength(2)
  })

  it('rejects a changed payload under an already used reversal identity', async () => {
    const p = payload()
    await enqueueWorkShift(origin, { kind: 'create', payload: p })
    const reversal = newReversal()
    await queueReverse(p.id, reversal)
    await expect(
      queueReverse(p.id, { ...reversal, reason: 'Otro motivo' }),
    ).rejects.toThrow('identity already exists')
  })

  it('rejects an origin mismatch on the reversal or on its replacement', async () => {
    const p = payload()
    await enqueueWorkShift(origin, { kind: 'create', payload: p })
    await expect(
      queueReverse(p.id, newReversal({ deviceId: v7() })),
    ).rejects.toThrow('origin mismatch')
    await expect(
      queueReverse(
        p.id,
        newReversal({ replacement: payload({ createdByMemberId: v7() }) }),
      ),
    ).rejects.toThrow('origin mismatch')
  })

  it('isolates queued reversals by account and API base', async () => {
    const p = payload()
    await enqueueWorkShift(origin, { kind: 'create', payload: p })
    await queueReverse(p.id)
    expect((await workShiftSnapshot({ ...origin, accountId: 'other' })).pending).toEqual([])
    expect((await workShiftSnapshot({ ...origin, apiBase: '/elsewhere' })).pending).toEqual([])
  })
})

describe('work shift reversal synchronization', () => {
  it('sends the create before its reversal and stores both audit records', async () => {
    const p = payload(),
      replacement = payload({ minutes: 600 })
    await enqueueWorkShift(origin, { kind: 'create', payload: p })
    // The reversal is queued after, but even a reversed timestamp order sends creates first.
    const reversal = newReversal({ replacement })
    await queueReverse(p.id, reversal)
    const calls: string[] = []
    const send = vi.fn(async (r: PendingWorkShift) => {
      calls.push(r.kind)
      return r.kind === 'create'
        ? receipt(p)
        : reversalReceipt(reversal, p, replacement)
    })
    expect(await syncWorkShifts(origin, send)).toBe(2)
    expect(calls).toEqual(['create', 'reverse'])
    const snapshot = await workShiftSnapshot(origin)
    expect(snapshot.pending).toEqual([])
    expect(snapshot.history).toHaveLength(2)
    const original = snapshot.history.find((r) => r.id === p.id)
    expect(original?.reversal).toMatchObject({
      id: reversal.id,
      replacementWorkShiftId: replacement.id,
      reason: 'Duración incorrecta',
    })
    expect(original?.minutes).toBe(510)
    const created = snapshot.history.find((r) => r.id === replacement.id)
    expect(created?.minutes).toBe(600)
    expect(created?.reversal).toBeFalsy()
    // Nothing more to send: no duplicate on the next run.
    expect(await syncWorkShifts(origin, send)).toBe(0)
  })

  it('annuls without a replacement', async () => {
    const p = payload()
    await enqueueWorkShift(origin, { kind: 'create', payload: p })
    await syncWorkShifts(origin, vi.fn().mockResolvedValue(receipt(p)))
    const reversal = newReversal()
    await queueReverse(p.id, reversal)
    const send = vi.fn().mockResolvedValue(reversalReceipt(reversal, p))
    expect(await syncWorkShifts(origin, send)).toBe(1)
    expect(send.mock.calls[0]?.[0]).toMatchObject({ kind: 'reverse', workShiftId: p.id })
    const snapshot = await workShiftSnapshot(origin)
    expect(snapshot.history).toHaveLength(1)
    expect(snapshot.history[0]?.reversal?.replacementWorkShiftId).toBeNull()
  })

  it('does not transmit a reversal whose original needs review', async () => {
    const p = payload()
    await enqueueWorkShift(origin, { kind: 'create', payload: p })
    await syncWorkShifts(origin, vi.fn().mockRejectedValue({ response: { status: 400 } }))
    await queueReverse(p.id)
    const send = vi.fn()
    await syncWorkShifts(origin, send)
    expect(send).not.toHaveBeenCalled()
    const record = (await workShiftSnapshot(origin)).pending.find((r) => r.kind === 'reverse')
    expect(record?.state).toBe('needs_review')
  })

  it('keeps the reversal waiting while the create is retried later', async () => {
    const p = payload()
    await enqueueWorkShift(origin, { kind: 'create', payload: p })
    const reversal = newReversal()
    await queueReverse(p.id, reversal)
    // The create fails transiently: the reversal must not be sent in this run.
    const failing = vi.fn().mockRejectedValue({ response: { status: 503 } })
    await syncWorkShifts(origin, failing, { now: () => 0 })
    expect(failing).toHaveBeenCalledOnce()
    const waiting = (await workShiftSnapshot(origin)).pending.find((r) => r.kind === 'reverse')
    expect(waiting).toMatchObject({ state: 'pending', attempts: 0 })
    const send = vi.fn(async (r: PendingWorkShift) =>
      r.kind === 'create' ? receipt(p) : reversalReceipt(reversal, p),
    )
    expect(await syncWorkShifts(origin, send, { now: () => 10 * 60000 })).toBe(2)
  })

  it('accepts the 200 replay of an already stored reversal without duplicating', async () => {
    const p = payload()
    await enqueueWorkShift(origin, { kind: 'create', payload: p })
    await syncWorkShifts(origin, vi.fn().mockResolvedValue(receipt(p)))
    const reversal = newReversal()
    await queueReverse(p.id, reversal)
    await syncWorkShifts(origin, vi.fn().mockRejectedValue({ response: { status: 503 } }), { now: () => 0 })
    expect(
      await syncWorkShifts(origin, vi.fn().mockResolvedValue(reversalReceipt(reversal, p)), { now: () => 10 * 60000 }),
    ).toBe(1)
    expect((await workShiftSnapshot(origin)).history).toHaveLength(1)
  })

  it.each([
    ['reversal id', () => ({ id: v7() })],
    ['original id', () => ({ workShiftId: v7() })],
    ['reason', () => ({ reason: 'Otro' })],
    ['recorder', () => ({ createdByMemberId: v7() })],
    ['device', () => ({ deviceId: v7() })],
    ['account', () => ({ createdByAccountId: 'someone-else' })],
    ['an unexpected replacement', () => ({ replacementWorkShiftId: v7() })],
    ['a blank reason', () => ({ reason: '   ' })],
  ])('does not confirm a reversal receipt that differs in %s', async (_name, change) => {
    const p = payload()
    await enqueueWorkShift(origin, { kind: 'create', payload: p })
    await syncWorkShifts(origin, vi.fn().mockResolvedValue(receipt(p)))
    const reversal = newReversal()
    await queueReverse(p.id, reversal)
    await syncWorkShifts(
      origin,
      vi.fn().mockResolvedValue(reversalReceipt(reversal, p, null, change())),
    )
    const snapshot = await workShiftSnapshot(origin)
    expect(snapshot.pending).toHaveLength(1)
    expect(snapshot.history[0]?.reversal).toBeFalsy()
  })

  it('does not confirm a reversal whose replacement or original was altered', async () => {
    const p = payload(),
      replacement = payload({ minutes: 600 })
    await enqueueWorkShift(origin, { kind: 'create', payload: p })
    await syncWorkShifts(origin, vi.fn().mockResolvedValue(receipt(p)))
    const reversal = newReversal({ replacement })
    await queueReverse(p.id, reversal)
    const good = reversalReceipt(reversal, p, replacement)
    for (const bad of [
      { ...good, replacement: receipt({ ...replacement, minutes: 1 }) },
      { ...good, replacement: null },
      { ...good, replacementWorkShiftId: null },
      { ...good, original: receipt({ ...p, minutes: 1 }) },
      { ...good, original: receipt(p, { contextId: 'other' }) },
      { ...good, original: { ...receipt(p), workDate: '2026-02-30' } },
    ])
      await syncWorkShifts(origin, vi.fn().mockResolvedValue(bad), { now: () => 0 })
    const snapshot = await workShiftSnapshot(origin)
    expect(snapshot.pending).toHaveLength(1)
    expect(snapshot.history).toHaveLength(1)
    expect(snapshot.history[0]?.reversal).toBeFalsy()
  })

  it('does not send another account, API or device origin', async () => {
    const p = payload()
    await enqueueWorkShift(origin, { kind: 'create', payload: p })
    await syncWorkShifts(origin, vi.fn().mockResolvedValue(receipt(p)))
    await queueReverse(p.id)
    const send = vi.fn()
    for (const changed of [{ accountId: 'different' }, { apiBase: 'elsewhere' }, { deviceId: v7() }])
      await syncWorkShifts({ ...origin, ...changed }, send)
    expect(send).not.toHaveBeenCalled()
  })

  it('preserves the original member and does not send offline', async () => {
    const p = payload()
    await enqueueWorkShift(origin, { kind: 'create', payload: p })
    await syncWorkShifts(origin, vi.fn().mockResolvedValue(receipt(p)))
    const reversal = newReversal()
    await queueReverse(p.id, reversal)
    const offline = vi.fn()
    await syncWorkShifts(origin, offline, { online: () => false })
    expect(offline).not.toHaveBeenCalled()
    const send = vi.fn().mockResolvedValue(reversalReceipt(reversal, p))
    await syncWorkShifts({ ...origin, memberId: v7() }, send)
    expect(send.mock.calls[0]?.[0].origin).toEqual(origin)
  })

  it('lets a reversal that needed review be retried with the original origin', async () => {
    const p = payload()
    await enqueueWorkShift(origin, { kind: 'create', payload: p })
    await syncWorkShifts(origin, vi.fn().mockResolvedValue(receipt(p)))
    const reversal = newReversal()
    const record = await queueReverse(p.id, reversal)
    await syncWorkShifts(origin, vi.fn().mockRejectedValue({ response: { status: 409 } }))
    expect((await workShiftSnapshot(origin)).pending[0]?.state).toBe('needs_review')
    await retryWorkShift(record)
    const send = vi.fn().mockResolvedValue(reversalReceipt(reversal, p))
    expect(await syncWorkShifts(origin, send)).toBe(1)
  })
})
