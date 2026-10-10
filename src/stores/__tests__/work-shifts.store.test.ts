import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkShiftsStore } from '../work-shifts.store'
import type { WorkShiftFields } from '@/types/work-shift.types'

const mocks = vi.hoisted(() => ({
  origin: {
    accountId: 'account',
    apiBase: 'http://localhost/api/v1',
    memberId: 'actor',
    deviceId: 'device',
  } as Record<string, string>,
  role: 'socio',
  enqueue: vi.fn(),
  snapshot: vi.fn(),
  summary: vi.fn(),
  list: vi.fn(),
  members: vi.fn(),
  merge: vi.fn(),
  saveRefs: vi.fn(),
  sync: vi.fn(),
  send: vi.fn(),
}))
vi.mock('../session.store', () => ({
  useSessionStore: () => ({ member: { role: mocks.role } }),
}))
vi.mock('@/services/queue-origin', () => ({
  currentQueueOrigin: () => mocks.origin,
  canSendDebt: () => true,
}))
vi.mock('@/services/work-shift-db', () => ({
  enqueueWorkShift: mocks.enqueue,
  workShiftSnapshot: mocks.snapshot,
  mergeWorkShiftHistory: mocks.merge,
  retryWorkShift: vi.fn(),
}))
vi.mock('@/services/contributions-db', () => ({
  saveFinanceReferences: mocks.saveRefs,
}))
vi.mock('@/services/work-shifts.service', () => ({
  WorkShiftsService: { send: mocks.send, list: mocks.list, summary: mocks.summary },
}))
vi.mock('@/services/contributions.service', () => ({
  ContributionsService: { members: mocks.members },
}))
vi.mock('@/services/work-shift-sync', () => ({ syncWorkShifts: mocks.sync }))

const fields: WorkShiftFields = {
  memberId: 'worker',
  workDate: '2026-10-03',
  minutes: 510,
  note: 'Turno completo',
}
const emptySummary = { totals: { shiftCount: 0, knownMinutes: 0, unknownDurationCount: 0 }, members: [] }
const online = (value: boolean) =>
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  mocks.role = 'socio'
  mocks.origin = { accountId: 'account', apiBase: 'http://localhost/api/v1', memberId: 'actor', deviceId: 'device' }
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
  online(true)
})

describe('durable work shift store', () => {
  it('stamps the actor, device and a UUID v7 on the saved operation', async () => {
    const store = useWorkShiftsStore()
    const id = await store.create(fields)
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/)
    expect(mocks.enqueue.mock.calls[0]?.[1]).toEqual({
      kind: 'create',
      payload: { ...fields, id, createdByMemberId: 'actor', deviceId: 'device' },
    })
  })

  it('keeps an unknown duration and an empty note as null', async () => {
    const store = useWorkShiftsStore()
    await store.create({ ...fields, minutes: null, note: null })
    expect(mocks.enqueue.mock.calls[0]?.[1].payload).toMatchObject({ minutes: null, note: null })
  })

  it('keeps a committed creation visible and successful if the readback fails', async () => {
    const store = useWorkShiftsStore()
    await expect(store.create(fields)).resolves.toEqual(expect.any(String))
    expect(store.pending).toHaveLength(1)
    expect(store.error).not.toBe('')
  })

  it('rejects when the durable write fails and shows no fake pending row', async () => {
    mocks.enqueue.mockRejectedValue(new Error('disk full'))
    const store = useWorkShiftsStore()
    await expect(store.create(fields)).rejects.toThrow('disk full')
    expect(store.pending).toEqual([])
  })

  it('queues an annulment with a trimmed reason and no replacement', async () => {
    const store = useWorkShiftsStore()
    await store.reverse('original', '  Registrada dos veces  ')
    const operation = mocks.enqueue.mock.calls[0]?.[1]
    expect(operation).toMatchObject({
      kind: 'reverse',
      workShiftId: 'original',
      payload: {
        reason: 'Registrada dos veces',
        createdByMemberId: 'actor',
        deviceId: 'device',
      },
    })
    expect(operation.payload.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/)
    expect(operation.payload.replacement).toBeUndefined()
    expect(new Date(operation.payload.occurredAt).toISOString()).toBe(operation.payload.occurredAt)
  })

  it('queues a correction whose replacement has its own UUID v7 and origin', async () => {
    const store = useWorkShiftsStore()
    await store.reverse('original', 'Duración incorrecta', { ...fields, minutes: null, note: null })
    const { payload } = mocks.enqueue.mock.calls[0]?.[1]
    expect(payload.replacement).toMatchObject({
      memberId: 'worker',
      workDate: '2026-10-03',
      minutes: null,
      note: null,
      createdByMemberId: 'actor',
      deviceId: 'device',
    })
    expect(payload.replacement.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/)
    expect(payload.replacement.id).not.toBe(payload.id)
    expect(store.pending).toHaveLength(1)
  })

  it.each(['', '   ', 'x'.repeat(1001)])('refuses an invalid reason %#', async (reason) => {
    const store = useWorkShiftsStore()
    await expect(store.reverse('original', reason)).rejects.toThrow('motivo')
    expect(mocks.enqueue).not.toHaveBeenCalled()
  })

  it('rejects a reversal when the durable write fails', async () => {
    mocks.enqueue.mockRejectedValue(new Error('disk full'))
    const store = useWorkShiftsStore()
    await expect(store.reverse('original', 'Motivo')).rejects.toThrow('disk full')
    expect(store.pending).toEqual([])
  })

  it('refuses a reversal for a collaborator', async () => {
    mocks.role = 'colaborador'
    const store = useWorkShiftsStore()
    await expect(store.reverse('original', 'Motivo')).rejects.toThrow('Solo socios')
    expect(mocks.enqueue).not.toHaveBeenCalled()
  })

  it('re-reads the list and the summary period after a sync that confirmed a reversal', async () => {
    const query = { from: '2026-10-01', to: '2026-10-08' }
    mocks.snapshot.mockResolvedValue({ pending: [], history: [], references: undefined })
    mocks.summary.mockResolvedValue(emptySummary)
    mocks.sync.mockResolvedValue(1)
    const store = useWorkShiftsStore()
    await store.load()
    await store.refreshSummary(query)
    mocks.summary.mockClear()
    mocks.snapshot.mockClear()
    await store.sync()
    expect(mocks.snapshot).toHaveBeenCalled()
    expect(mocks.summary).toHaveBeenCalledWith(expect.anything(), query)
  })

  it('refuses to operate for a collaborator', async () => {
    mocks.role = 'colaborador'
    const store = useWorkShiftsStore()
    await expect(store.create(fields)).rejects.toThrow('Solo socios')
    expect(mocks.enqueue).not.toHaveBeenCalled()
    await expect(store.refresh()).rejects.toThrow('Solo socios')
  })

  it('exposes active members as workers and every member for history', async () => {
    mocks.snapshot.mockResolvedValue({
      pending: [],
      history: [],
      references: {
        scope: 's',
        savedAt: 'x',
        members: [
          { id: 'a', name: 'Ana', role: 'socio', active: true },
          { id: 'b', name: 'Beto', role: 'colaborador', active: true },
          { id: 'c', name: 'Cora', role: 'colaborador', active: false },
        ],
      },
    })
    const store = useWorkShiftsStore()
    await store.load()
    expect(store.workers.map((m) => m.id)).toEqual(['a', 'b'])
    expect(store.allMembers.map((m) => m.id)).toEqual(['a', 'b', 'c'])
  })

  it('stores a validated summary only for the requested query, and drops it on failure', async () => {
    const query = { from: '2026-10-01', to: '2026-10-08', memberId: 'worker' }
    mocks.summary.mockResolvedValueOnce(emptySummary)
    const store = useWorkShiftsStore()
    await store.refreshSummary(query)
    expect(mocks.summary).toHaveBeenCalledWith(expect.anything(), query)
    expect(store.summary).toMatchObject({ ...query, value: emptySummary })
    mocks.summary.mockRejectedValueOnce(new Error('offline'))
    await store.refreshSummary(query)
    expect(store.summary).toBeNull()
  })

  it('does not send an empty member filter to the server', async () => {
    mocks.summary.mockResolvedValueOnce(emptySummary)
    const store = useWorkShiftsStore()
    await store.refreshSummary({ from: 'a', to: 'b' })
    expect(mocks.summary.mock.calls[0]?.[1]).toEqual({ from: 'a', to: 'b' })
    expect(store.summary?.memberId).toBe('')
  })

  it('does not call the server for the summary while offline', async () => {
    online(false)
    const store = useWorkShiftsStore()
    expect(await store.refreshSummary({ from: 'a', to: 'b' })).toBeNull()
    expect(mocks.summary).not.toHaveBeenCalled()
  })

  it('re-reads the shown summary after a sync, even when the earlier refresh failed', async () => {
    const counted = { ...emptySummary, totals: { shiftCount: 1, knownMinutes: 60, unknownDurationCount: 0 } }
    const range = { from: 'a', to: 'b' }
    mocks.snapshot.mockResolvedValue({ pending: [], history: [], references: undefined })
    mocks.sync.mockResolvedValue(1)
    mocks.summary.mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce(counted)
    const store = useWorkShiftsStore()
    await store.load()
    await store.refreshSummary(range)
    expect(store.summary).toBeNull()
    await store.sync()
    expect(store.summary).toMatchObject({ ...range, value: counted })
  })

  it('does not fetch a summary after a sync when none was being shown', async () => {
    mocks.snapshot.mockResolvedValue({ pending: [], history: [], references: undefined })
    const store = useWorkShiftsStore()
    await store.sync()
    expect(mocks.summary).not.toHaveBeenCalled()
  })

  it('does not sync while offline', async () => {
    online(false)
    const store = useWorkShiftsStore()
    await store.sync()
    expect(mocks.sync).not.toHaveBeenCalled()
    online(true)
  })

  it('refresh merges the page and member references into durable storage', async () => {
    mocks.list.mockResolvedValue({ items: [], nextCursor: 'next' })
    mocks.members.mockResolvedValue([{ id: 'a', name: 'Ana', role: 'socio', active: true }])
    mocks.snapshot.mockResolvedValue({ pending: [], history: [], references: undefined })
    const store = useWorkShiftsStore()
    await store.refresh({ limit: 50 })
    expect(mocks.merge).toHaveBeenCalledOnce()
    expect(mocks.saveRefs).toHaveBeenCalledOnce()
    expect(store.nextCursor).toBe('next')
  })

  it('rejects an invalid member list or a mixed-business page instead of caching it', async () => {
    mocks.list.mockResolvedValue({ items: [], nextCursor: null })
    mocks.members.mockResolvedValue([{ nope: true }])
    const store = useWorkShiftsStore()
    await expect(store.refresh()).rejects.toThrow('equipo')
    mocks.members.mockResolvedValue([])
    mocks.list.mockResolvedValue({ items: [{ contextId: 'a' }, { contextId: 'b' }], nextCursor: null })
    await expect(store.refresh()).rejects.toThrow('inconsistente')
    expect(mocks.saveRefs).not.toHaveBeenCalled()
  })
})

describe('work shift session isolation', () => {
  const stored = (scope: string, id: string) => ({
    pending: [{ id, kind: 'create', state: 'pending', origin: mocks.origin, payload: { id } }],
    history: [{ id: id + '-h' }],
    references: { scope, savedAt: 'x', members: [] },
  })

  it('drops everything from another account/API/device when the session changes', async () => {
    mocks.snapshot.mockResolvedValueOnce(stored('a', 'one'))
    const store = useWorkShiftsStore()
    await store.load()
    expect(store.pending.map((r) => r.id)).toEqual(['one'])
    mocks.origin = { ...mocks.origin, accountId: 'other-account' }
    mocks.snapshot.mockResolvedValueOnce({ pending: [], history: [], references: undefined })
    await store.load()
    expect(store.pending).toEqual([])
    expect(store.history).toEqual([])
    expect(store.references).toBeNull()
    expect(mocks.snapshot.mock.calls[1]?.[0]).toMatchObject({ accountId: 'other-account' })
  })

  it.each([
    ['API', { apiBase: 'http://other/api/v1' }],
    ['device', { deviceId: 'other-device' }],
  ])('queries the snapshot with the new %s origin', async (_name, change) => {
    mocks.snapshot.mockResolvedValue({ pending: [], history: [], references: undefined })
    const store = useWorkShiftsStore()
    await store.load()
    mocks.origin = { ...mocks.origin, ...change }
    await store.load()
    expect(mocks.snapshot.mock.calls[1]?.[0]).toMatchObject(change)
  })

  it('sessionChanged clears the visible state and the shown summary', async () => {
    mocks.snapshot.mockResolvedValue(stored('a', 'one'))
    mocks.summary.mockResolvedValue(emptySummary)
    const store = useWorkShiftsStore()
    await store.load()
    await store.refreshSummary({ from: 'a', to: 'b' })
    expect(store.summary).not.toBeNull()
    mocks.role = 'colaborador'
    await store.sessionChanged()
    expect(store.pending).toEqual([])
    expect(store.history).toEqual([])
    expect(store.summary).toBeNull()
    expect(store.references).toBeNull()
  })

  it('shows nothing and never syncs for a role that is not socio', async () => {
    mocks.role = 'colaborador'
    mocks.snapshot.mockResolvedValue(stored('a', 'one'))
    const store = useWorkShiftsStore()
    await store.load()
    await store.sync()
    expect(store.pending).toEqual([])
    expect(mocks.snapshot).not.toHaveBeenCalled()
    expect(mocks.sync).not.toHaveBeenCalled()
  })

  it('start loads and syncs, stop prevents further scheduling', async () => {
    mocks.snapshot.mockResolvedValue({ pending: [], history: [], references: undefined })
    mocks.sync.mockResolvedValue(0)
    const store = useWorkShiftsStore()
    await store.start()
    expect(mocks.snapshot).toHaveBeenCalled()
    expect(mocks.sync).toHaveBeenCalledOnce()
    await store.start() // already started: no second run
    expect(mocks.sync).toHaveBeenCalledOnce()
    store.stop()
  })
})
