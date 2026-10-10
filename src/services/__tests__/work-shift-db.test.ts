import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { v7 } from 'uuid'
import { closeLocalDb, openLocalDb } from '../local-db'
import {
  confirmWorkShift,
  enqueueWorkShift,
  mergeWorkShiftHistory,
  retryWorkShift,
  updateWorkShiftAttempt,
  workShiftSnapshot,
} from '../work-shift-db'
import type { FinanceOrigin } from '../contributions-records'
import type { WorkShift, WorkShiftPayload, WorkShiftReceipt } from '@/types/work-shift.types'

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
const receipt = (p: WorkShiftPayload, over: object = {}): WorkShiftReceipt => ({
  ...p,
  contextId: 'business',
  createdByAccountId: origin.accountId,
  receivedAt: '2026-10-03T12:00:00.000Z',
  warnings: [],
  ...over,
})

beforeEach(() => {
  closeLocalDb()
  globalThis.indexedDB = new IDBFactory()
})

describe('durable work shift persistence', () => {
  it('persists the frozen payload and origin and survives a reload', async () => {
    const p = payload()
    await enqueueWorkShift(origin, { kind: 'create', payload: p })
    p.minutes = 1
    closeLocalDb()
    const { pending } = await workShiftSnapshot(origin)
    expect(pending).toHaveLength(1)
    expect(pending[0]?.payload).toMatchObject({ minutes: 510 })
    expect(pending[0]?.origin).toEqual(origin)
    expect(pending[0]?.state).toBe('pending')
  })

  it('keeps an unknown duration as null and never turns it into 0', async () => {
    await enqueueWorkShift(origin, {
      kind: 'create',
      payload: payload({ minutes: null, note: null }),
    })
    const { pending } = await workShiftSnapshot(origin)
    expect(pending[0]?.payload).toMatchObject({ minutes: null })
    expect(pending[0]?.payload).toMatchObject({ note: null })
  })

  it('isolates records by account and API base', async () => {
    await enqueueWorkShift(origin, { kind: 'create', payload: payload() })
    for (const changed of [{ accountId: 'other' }, { apiBase: '/elsewhere' }])
      expect(await workShiftSnapshot({ ...origin, ...changed })).toMatchObject({
        pending: [],
        history: [],
      })
  })

  it('refuses an operation whose attribution differs from the origin', async () => {
    for (const over of [{ createdByMemberId: v7() }, { deviceId: v7() }])
      await expect(
        enqueueWorkShift(origin, { kind: 'create', payload: payload(over) }),
      ).rejects.toThrow('origin mismatch')
  })

  it('replays the same UUID and content idempotently and refuses different content', async () => {
    const p = payload()
    const first = await enqueueWorkShift(origin, { kind: 'create', payload: p })
    const again = await enqueueWorkShift(origin, { kind: 'create', payload: p })
    expect(again.key).toBe(first.key)
    expect((await workShiftSnapshot(origin)).pending).toHaveLength(1)
    await expect(
      enqueueWorkShift(origin, { kind: 'create', payload: { ...p, minutes: 5 } }),
    ).rejects.toThrow('identity already exists')
  })

  it('refuses to re-enqueue an identity that is already confirmed', async () => {
    const p = payload()
    const record = await enqueueWorkShift(origin, { kind: 'create', payload: p })
    await confirmWorkShift(record, receipt(p))
    await expect(
      enqueueWorkShift(origin, { kind: 'create', payload: p }),
    ).rejects.toThrow('already confirmed')
  })

  it('confirming moves the pending record into history in one step and keeps the receipt warning', async () => {
    const p = payload()
    const record = await enqueueWorkShift(origin, { kind: 'create', payload: p })
    const warning = { code: 'MULTIPLE_SHIFTS_SAME_DAY' as const, existingActiveShiftCount: 1 }
    await confirmWorkShift(record, receipt(p, { warnings: [warning] }))
    const snapshot = await workShiftSnapshot(origin)
    expect(snapshot.pending).toEqual([])
    expect(snapshot.history).toHaveLength(1)
    expect(snapshot.history[0]?.warnings).toEqual([warning])
  })

  it('merging the server list never duplicates, drops the warning or forgets a reversal', async () => {
    const p = payload()
    const record = await enqueueWorkShift(origin, { kind: 'create', payload: p })
    const warning = { code: 'MULTIPLE_SHIFTS_SAME_DAY' as const, existingActiveShiftCount: 2 }
    await confirmWorkShift(record, receipt(p, { warnings: [warning] }))
    const listItem: WorkShift = { ...receipt(p) }
    delete listItem.warnings // list items never carry the creation warning
    const member = { id: p.memberId, name: 'Ana', active: true, role: 'colaborador' as const }
    await mergeWorkShiftHistory(origin, [{ ...listItem, member, reversal: null }])
    let history = (await workShiftSnapshot(origin)).history
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({ warnings: [warning], member: { name: 'Ana' } })
    const reversal = { id: v7(), replacementWorkShiftId: null }
    await mergeWorkShiftHistory(origin, [{ ...listItem, member, reversal }])
    await mergeWorkShiftHistory(origin, [{ ...listItem, member, reversal: null }])
    history = (await workShiftSnapshot(origin)).history
    expect(history[0]?.reversal).toEqual(reversal)
  })

  it('records attempts with backoff and an explicit retry resets the state', async () => {
    const record = await enqueueWorkShift(origin, { kind: 'create', payload: payload() })
    await updateWorkShiftAttempt(record, 'paused', 'sin permiso', 1000)
    let [current] = (await workShiftSnapshot(origin)).pending
    expect(current).toMatchObject({ state: 'paused', attempts: 1, nextAttemptAt: 31000, lastError: 'sin permiso' })
    await retryWorkShift(record)
    ;[current] = (await workShiftSnapshot(origin)).pending
    expect(current).toMatchObject({ state: 'pending', nextAttemptAt: 0 })
    expect(current?.lastError).toBeUndefined()
  })

  it('skips corrupt rows without hiding or deleting the healthy ones', async () => {
    const good = payload()
    await enqueueWorkShift(origin, { kind: 'create', payload: good })
    const db = await openLocalDb()
    await db.put('pending-work-shifts', { key: 'broken-1' } as never)
    await db.put('pending-work-shifts', { key: 'broken-2', scope: 7, id: null } as never)
    await db.put('work-shift-history', { key: 'broken-3', scope: 'x' } as never)
    const snapshot = await workShiftSnapshot(origin)
    expect(snapshot.pending.map((r) => r.id)).toEqual([good.id])
    expect(snapshot.history).toEqual([])
    expect(await db.count('pending-work-shifts')).toBe(3)
  })

  it('rejects the write when storage is unavailable instead of pretending success', async () => {
    closeLocalDb()
    const real = globalThis.indexedDB
    Object.defineProperty(globalThis, 'indexedDB', { value: undefined, writable: true, configurable: true })
    await expect(
      enqueueWorkShift(origin, { kind: 'create', payload: payload() }),
    ).rejects.toThrow()
    globalThis.indexedDB = real
  })
})
