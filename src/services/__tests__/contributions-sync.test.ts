import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { v7 } from 'uuid'
import { closeLocalDb } from '../local-db'
import {
  enqueueContribution,
  financeSnapshot,
  confirmContribution,
} from '../contributions-db'
import { syncContributions } from '../contributions-sync'
import type {
  FinanceOrigin,
  PendingContribution,
} from '../contributions-records'
import type { ContributionPayload } from '@/types/contribution.types'
const origin: FinanceOrigin = {
  accountId: 'account',
  apiBase: '/api/v1',
  memberId: v7(),
  deviceId: v7(),
}
const payload = (): ContributionPayload => ({
  id: v7(),
  memberId: v7(),
  createdByMemberId: origin.memberId,
  deviceId: origin.deviceId,
  amountMinor: 800000,
  occurredAt: '2026-10-03T00:00:00-06:00',
  note: 'Initial',
})
const receipt = (p: ContributionPayload) => ({
  ...p,
  note: p.note ?? null,
  occurredAt: new Date(p.occurredAt).toISOString(),
  contextId: 'business',
  createdByAccountId: origin.accountId,
  currency: 'MXN' as const,
  receivedAt: '2026-10-03T12:00:00Z',
})
beforeEach(() => {
  closeLocalDb()
  globalThis.indexedDB = new IDBFactory()
})
describe('durable finance synchronization', () => {
  it('persists immutable origin before success and survives refresh', async () => {
    const p = payload()
    await enqueueContribution(origin, { kind: 'create', payload: p })
    p.amountMinor = 1
    closeLocalDb()
    const snapshot = await financeSnapshot(origin)
    expect(
      snapshot.pending[0]?.kind === 'create'
        ? snapshot.pending[0].payload.amountMinor
        : null,
    ).toBe(800000)
    expect(snapshot.pending[0]?.origin).toEqual(origin)
    expect(
      await financeSnapshot({ ...origin, accountId: 'other' }),
    ).toMatchObject({ pending: [], history: [] })
  })
  it('reconciles later into history without pending plus confirmed duplicates', async () => {
    const p = payload()
    await enqueueContribution(origin, { kind: 'create', payload: p })
    const send = vi.fn().mockResolvedValue(receipt(p))
    expect(await syncContributions(origin, send)).toBe(1)
    expect(send).toHaveBeenCalledOnce()
    expect(await financeSnapshot(origin)).toMatchObject({
      pending: [],
      history: [{ id: p.id }],
    })
  })
  it('retains malformed acknowledgement as uncertain and retries unchanged identity', async () => {
    const p = payload()
    await enqueueContribution(origin, { kind: 'create', payload: p })
    await syncContributions(
      origin,
      vi.fn().mockResolvedValue({ ...receipt(p), amountMinor: 1 }),
    )
    const pending = (await financeSnapshot(origin)).pending
    expect(pending).toHaveLength(1)
    expect(pending[0]?.attempts).toBe(1)
    expect(pending[0]?.payload).toEqual(p)
  })
  it('does not send another account/API/device origin', async () => {
    await enqueueContribution(origin, { kind: 'create', payload: payload() })
    const send = vi.fn()
    for (const changed of [
      { accountId: 'different' },
      { apiBase: 'elsewhere' },
      { deviceId: v7() },
    ])
      await syncContributions({ ...origin, ...changed }, send)
    expect(send).not.toHaveBeenCalled()
  })
  it('conflicts require review and auth errors pause rather than loop', async () => {
    const p = payload()
    await enqueueContribution(origin, { kind: 'create', payload: p })
    await syncContributions(
      origin,
      vi.fn().mockRejectedValue({ response: { status: 409 } }),
    )
    expect((await financeSnapshot(origin)).pending[0]?.state).toBe(
      'needs_review',
    )
    const q = payload()
    await enqueueContribution(origin, { kind: 'create', payload: q })
    await syncContributions(
      origin,
      vi.fn().mockRejectedValue({ response: { status: 401 } }),
    )
    expect(
      (await financeSnapshot(origin)).pending.find((r) => r.id === q.id)?.state,
    ).toBe('paused')
  })
  it('waits for original confirmation before transmitting dependent reversal', async () => {
    const p = payload()
    await enqueueContribution(origin, { kind: 'create', payload: p })
    const reversal = {
      id: v7(),
      createdByMemberId: origin.memberId,
      deviceId: origin.deviceId,
      occurredAt: '2026-10-03T12:00:00Z',
      reason: 'Incorrect',
    }
    await enqueueContribution(origin, {
      kind: 'reverse',
      contributionId: p.id,
      payload: reversal,
    })
    const calls: string[] = []
    const send = vi.fn(async (r: PendingContribution) => {
      calls.push(r.kind)
      return r.kind === 'create'
        ? receipt(p)
        : {
            ...reversal,
            contextId: 'business',
            createdByAccountId: origin.accountId,
            contributionId: p.id,
            replacementContributionId: null,
            receivedAt: '2026-10-03T12:00:00Z',
            original: receipt(p),
            replacement: null,
          }
    })
    expect(await syncContributions(origin, send)).toBe(2)
    expect(calls).toEqual(['create', 'reverse'])
    expect((await financeSnapshot(origin)).history[0]?.reversal?.id).toBe(
      reversal.id,
    )
  })
  it('rejects storage failure without returning a success', async () => {
    closeLocalDb()
    const db = globalThis.indexedDB
    Object.defineProperty(globalThis, 'indexedDB', {
      value: undefined,
      writable: true,
      configurable: true,
    })
    await expect(
      enqueueContribution(origin, { kind: 'create', payload: payload() }),
    ).rejects.toThrow()
    globalThis.indexedDB = db
  })
  it('keeps reversal knowledge if an immutable old creation receipt replays', async () => {
    const p = payload()
    const r = await enqueueContribution(origin, { kind: 'create', payload: p })
    await confirmContribution(r, receipt(p))
    expect((await financeSnapshot(origin)).history).toHaveLength(1)
  })
  it('preserves the original member on a shared-account selection change', async () => {
    const p = payload()
    await enqueueContribution(origin, { kind: 'create', payload: p })
    const send = vi.fn().mockResolvedValue(receipt(p))
    await syncContributions({ ...origin, memberId: v7() }, send)
    expect(send.mock.calls[0]?.[0].origin).toEqual(origin)
  })
  it('does not call the network while offline', async () => {
    await enqueueContribution(origin, { kind: 'create', payload: payload() })
    const send = vi.fn()
    await syncContributions(origin, send, { online: () => false })
    expect(send).not.toHaveBeenCalled()
  })
  it('one same-tab run excludes concurrent duplicate transmission without Web Locks', async () => {
    const p = payload()
    await enqueueContribution(origin, { kind: 'create', payload: p })
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const send = vi.fn(async () => {
      await gate
      return receipt(p)
    })
    const first = syncContributions(origin, send)
    await Promise.resolve()
    expect(await syncContributions(origin, send)).toBe(0)
    release()
    await first
    expect(send).toHaveBeenCalledOnce()
  })
  it('honors an unavailable cross-tab Web Lock', async () => {
    await enqueueContribution(origin, { kind: 'create', payload: payload() })
    const send = vi.fn()
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: vi.fn(async (_name, _options, callback) => callback(null)),
      },
    })
    try {
      expect(await syncContributions(origin, send)).toBe(0)
      expect(send).not.toHaveBeenCalled()
    } finally {
      Reflect.deleteProperty(navigator, 'locks')
    }
  })
  it('keeps the pending operation if storage fails after server acceptance', async () => {
    const p = payload()
    await enqueueContribution(origin, { kind: 'create', payload: p })
    const db = globalThis.indexedDB
    await expect(
      syncContributions(origin, async () => {
        closeLocalDb()
        Object.defineProperty(globalThis, 'indexedDB', {
          value: undefined,
          writable: true,
          configurable: true,
        })
        return receipt(p)
      }),
    ).rejects.toThrow()
    globalThis.indexedDB = db
    closeLocalDb()
    expect((await financeSnapshot(origin)).pending[0]?.payload).toEqual(p)
  })
  it('records an atomic correction replacement only through its reversal operation', async () => {
    const p = payload(),
      replacement = payload()
    const original = await enqueueContribution(origin, {
      kind: 'create',
      payload: p,
    })
    await confirmContribution(original, receipt(p))
    const reversal = {
      id: v7(),
      createdByMemberId: origin.memberId,
      deviceId: origin.deviceId,
      occurredAt: '2026-10-03T12:00:00Z',
      reason: 'Wrong',
      replacement,
    }
    const correction = await enqueueContribution(origin, {
      kind: 'reverse',
      contributionId: p.id,
      payload: reversal,
    })
    const send = vi.fn().mockResolvedValue({
      ...reversal,
      contextId: 'business',
      createdByAccountId: origin.accountId,
      contributionId: p.id,
      replacementContributionId: replacement.id,
      receivedAt: '2026-10-03T12:00:00Z',
      original: receipt(p),
      replacement: receipt(replacement),
    })
    expect(await syncContributions(origin, send)).toBe(1)
    await confirmContribution(original, receipt(p))
    const result = await financeSnapshot(origin)
    expect(result.history).toHaveLength(2)
    expect(result.history.find((r) => r.id === p.id)?.reversal?.id).toBe(
      reversal.id,
    )
    expect(result.pending).toEqual([])
    expect(send.mock.calls[0]?.[0].kind).toBe('reverse')
    const annul = {
      id: v7(),
      createdByMemberId: origin.memberId,
      deviceId: origin.deviceId,
      occurredAt: '2026-10-03T13:00:00Z',
      reason: 'Replacement was incorrect',
    }
    const annulRecord = await enqueueContribution(origin, {
      kind: 'reverse',
      contributionId: replacement.id,
      payload: annul,
    })
    await confirmContribution(annulRecord, {
      ...annul,
      contextId: 'business',
      createdByAccountId: origin.accountId,
      contributionId: replacement.id,
      replacementContributionId: null,
      receivedAt: annul.occurredAt,
      original: receipt(replacement),
      replacement: null,
    })
    // Another tab can acknowledge an old frozen correction receipt after the replacement was reversed.
    await confirmContribution(correction, await send.mock.results[0]!.value)
    const late = await financeSnapshot(origin)
    expect(
      late.history.find((r) => r.id === replacement.id)?.reversal?.id,
    ).toBe(annul.id)
    expect(late.history.find((r) => r.id === p.id)?.reversal?.id).toBe(
      reversal.id,
    )
    expect(late.pending).toEqual([])
  })
})
