import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useContributionsStore } from '../contributions.store'
const mocks = vi.hoisted(() => ({
  origin: {
    accountId: 'account',
    apiBase: 'http://localhost/api/v1',
    memberId: 'actor',
    deviceId: 'device',
  },
  enqueue: vi.fn(),
  snapshot: vi.fn(),
}))
vi.mock('../session.store', () => ({
  useSessionStore: () => ({ member: { role: 'socio' } }),
}))
vi.mock('@/services/queue-origin', () => ({
  currentQueueOrigin: () => mocks.origin,
  canSendDebt: () => true,
}))
vi.mock('@/services/contributions-db', () => ({
  enqueueContribution: mocks.enqueue,
  financeSnapshot: mocks.snapshot,
  mergeContributionHistory: vi.fn(),
  saveFinanceReferences: vi.fn(),
  retryContribution: vi.fn(),
}))
vi.mock('@/services/contributions.service', () => ({
  ContributionsService: { send: vi.fn(), list: vi.fn(), members: vi.fn() },
}))
vi.mock('@/services/contributions-sync', () => ({ syncContributions: vi.fn() }))
beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  mocks.enqueue.mockImplementation(async (origin, operation) => ({
    ...operation,
    origin,
    id: operation.payload.id,
    scope: 'scope',
    key: 'key',
    createdAt: new Date().toISOString(),
    state: 'pending',
    attempts: 0,
    nextAttemptAt: 0,
  }))
  mocks.snapshot.mockRejectedValue(new Error('readback unavailable'))
})
describe('durable contribution store acknowledgement', () => {
  const fields = {
    memberId: 'contributor',
    amountMinor: 800000,
    occurredAt: '2026-10-03T00:00:00-06:00',
    note: null,
  }
  it('keeps a committed creation visible and successful if readback fails', async () => {
    const store = useContributionsStore()
    await expect(store.create(fields)).resolves.toEqual(expect.any(String))
    expect(store.pending).toHaveLength(1)
    expect(store.pending[0]?.payload).toMatchObject({
      ...fields,
      createdByMemberId: 'actor',
      deviceId: 'device',
    })
    expect(store.error).not.toBe('')
  })
  it('keeps a committed reversal visible and successful if readback fails', async () => {
    const store = useContributionsStore()
    await expect(
      store.reverse('original', 'Correction', fields),
    ).resolves.toBeUndefined()
    expect(store.pending[0]).toMatchObject({
      kind: 'reverse',
      contributionId: 'original',
      payload: { reason: 'Correction', replacement: fields },
    })
  })
  it('rejects registration when the durable write fails without adding a fake pending row', async () => {
    mocks.enqueue.mockRejectedValue(new Error('disk full'))
    const store = useContributionsStore()
    await expect(store.create(fields)).rejects.toThrow('disk full')
    expect(store.pending).toEqual([])
  })
})
