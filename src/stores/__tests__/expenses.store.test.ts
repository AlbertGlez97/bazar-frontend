import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useExpensesStore } from '../expenses.store'
import type { ExpenseFields } from '@/types/expense.types'

const mocks = vi.hoisted(() => ({
  origin: {
    accountId: 'account',
    apiBase: 'http://localhost/api/v1',
    memberId: 'actor',
    deviceId: 'device',
  },
  role: 'socio',
  enqueue: vi.fn(),
  snapshot: vi.fn(),
  summary: vi.fn(),
  list: vi.fn(),
  members: vi.fn(),
  merge: vi.fn(),
  saveRefs: vi.fn(),
}))
vi.mock('../session.store', () => ({
  useSessionStore: () => ({ member: { role: mocks.role } }),
}))
vi.mock('@/services/queue-origin', () => ({
  currentQueueOrigin: () => mocks.origin,
  canSendDebt: () => true,
}))
vi.mock('@/services/expense-db', () => ({
  enqueueExpense: mocks.enqueue,
  expenseSnapshot: mocks.snapshot,
  mergeExpenseHistory: mocks.merge,
  retryExpense: vi.fn(),
}))
vi.mock('@/services/contributions-db', () => ({
  saveFinanceReferences: mocks.saveRefs,
}))
vi.mock('@/services/expenses.service', () => ({
  ExpensesService: {
    send: vi.fn(),
    list: mocks.list,
    summary: mocks.summary,
  },
}))
vi.mock('@/services/contributions.service', () => ({
  ContributionsService: { members: mocks.members },
}))
vi.mock('@/services/expense-sync', () => ({ syncExpenses: vi.fn() }))

const fields: ExpenseFields = {
  amountMinor: 45050,
  occurredAt: '2026-10-03T00:00:00-06:00',
  nature: 'OPERATING_EXPENSE',
  category: 'fuel',
  description: 'Gasolina',
  paidByMemberId: 'payer',
  fundsSource: 'PERSONAL',
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  mocks.role = 'socio'
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

describe('durable expense store', () => {
  it('stamps the actor, device and a UUID v7 on the saved operation', async () => {
    const store = useExpensesStore()
    const id = await store.create(fields)
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/)
    expect(mocks.enqueue.mock.calls[0]?.[1]).toMatchObject({
      kind: 'create',
      payload: { ...fields, id, createdByMemberId: 'actor', deviceId: 'device' },
    })
  })

  it('keeps a committed creation visible and successful if the readback fails', async () => {
    const store = useExpensesStore()
    await expect(store.create(fields)).resolves.toEqual(expect.any(String))
    expect(store.pending).toHaveLength(1)
    expect(store.error).not.toBe('')
  })

  it('rejects when the durable write fails and shows no fake pending row', async () => {
    mocks.enqueue.mockRejectedValue(new Error('disk full'))
    const store = useExpensesStore()
    await expect(store.create(fields)).rejects.toThrow('disk full')
    expect(store.pending).toEqual([])
  })

  it('queues a reversal with its own replacement UUID', async () => {
    const store = useExpensesStore()
    await store.reverse('original', 'Wrong amount', fields)
    const operation = mocks.enqueue.mock.calls[0]?.[1]
    expect(operation).toMatchObject({
      kind: 'reverse',
      expenseId: 'original',
      payload: { reason: 'Wrong amount', replacement: fields },
    })
    expect(operation.payload.replacement.id).not.toBe(operation.payload.id)
  })

  it('refuses to operate for a collaborator', async () => {
    mocks.role = 'colaborador'
    const store = useExpensesStore()
    await expect(store.create(fields)).rejects.toThrow('Solo socios')
    expect(mocks.enqueue).not.toHaveBeenCalled()
  })

  it('exposes active members as payers and every member for history', async () => {
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
    const store = useExpensesStore()
    await store.load()
    expect(store.payers.map((m) => m.id)).toEqual(['a', 'b'])
    expect(store.allMembers.map((m) => m.id)).toEqual(['a', 'b', 'c'])
  })

  it('stores a validated summary only for the requested period, and drops it on failure', async () => {
    const value = {
      operatingMinor: 1,
      inventoryMinor: 2,
      personalMinor: 3,
      businessMinor: 0,
    }
    const range = { from: 'a', to: 'b' }
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    mocks.summary.mockResolvedValueOnce(value)
    const store = useExpensesStore()
    await store.refreshSummary(range)
    expect(store.summary?.value).toEqual(value)
    mocks.summary.mockRejectedValueOnce(new Error('offline'))
    await store.refreshSummary(range)
    expect(store.summary).toBeNull()
  })

  it('does not call the server for the summary while offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    const store = useExpensesStore()
    expect(await store.refreshSummary({ from: 'a', to: 'b' })).toBeNull()
    expect(mocks.summary).not.toHaveBeenCalled()
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  it('re-reads the shown server summary after a sync so confirmed expenses are counted', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    const empty = { operatingMinor: 0, inventoryMinor: 0, personalMinor: 0, businessMinor: 0 }
    const counted = { ...empty, operatingMinor: 25000 }
    const range = { from: 'a', to: 'b' }
    mocks.snapshot.mockResolvedValue({ pending: [], history: [], references: undefined })
    mocks.summary.mockResolvedValueOnce(empty).mockResolvedValueOnce(counted)
    const store = useExpensesStore()
    await store.load() // the view loads the scope before asking for the summary
    await store.refreshSummary(range)
    await store.sync()
    expect(mocks.summary).toHaveBeenCalledTimes(2)
    expect(store.summary).toMatchObject({ ...range, value: counted })
  })

  it('does not fetch a summary after a sync when none was being shown', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    mocks.snapshot.mockResolvedValue({ pending: [], history: [], references: undefined })
    const store = useExpensesStore()
    await store.sync()
    expect(mocks.summary).not.toHaveBeenCalled()
  })

  it('refresh merges the page and member references into durable storage', async () => {
    mocks.list.mockResolvedValue({ items: [], nextCursor: 'next' })
    mocks.members.mockResolvedValue([
      { id: 'a', name: 'Ana', role: 'socio', active: true },
    ])
    mocks.snapshot.mockResolvedValue({ pending: [], history: [], references: undefined })
    const store = useExpensesStore()
    await store.refresh({ limit: 50 })
    expect(mocks.merge).toHaveBeenCalledOnce()
    expect(mocks.saveRefs).toHaveBeenCalledOnce()
    expect(store.nextCursor).toBe('next')
  })

  it('rejects an invalid member list instead of caching it', async () => {
    mocks.list.mockResolvedValue({ items: [], nextCursor: null })
    mocks.members.mockResolvedValue([{ nope: true }])
    const store = useExpensesStore()
    await expect(store.refresh()).rejects.toThrow('equipo')
    expect(mocks.saveRefs).not.toHaveBeenCalled()
  })
})
