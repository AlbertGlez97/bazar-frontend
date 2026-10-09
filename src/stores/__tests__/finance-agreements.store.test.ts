import { reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFinanceAgreementsStore } from '../finance-agreements.store'
import { AGREEMENT_ID, agreementFixture, agreementItemFixture, agreementOrigin, reversalFixture } from '@/services/__tests__/finance-agreements.fixture'
import { FinanceAgreementContractError } from '@/utils/finance-agreements'
import type { AgreementFields } from '@/types/finance-agreement.types'
const mocks = vi.hoisted(() => ({ create: vi.fn(), list: vi.fn(), get: vi.fn(), reverse: vi.fn() }))
vi.mock('@/services/finance-agreements.service', () => ({ FinanceAgreementsService: mocks }))
const state = reactive({ auth: { token: 'token-a' }, session: {
  owner: { accountId: agreementOrigin.accountId, apiBase: '/api/v1' },
  memberId: agreementOrigin.memberId, deviceId: agreementOrigin.deviceId, deviceToken: 'device-token',
  member: { role: 'socio', active: true },
} })
vi.mock('../auth.store', () => ({ useAuthStore: () => state.auth }))
vi.mock('../session.store', () => ({ useSessionStore: () => state.session }))
vi.mock('@/services/queue-origin', () => ({ currentQueueOrigin: () => ({
  ...state.session.owner, memberId: state.session.memberId, deviceId: state.session.deviceId,
}) }))
const fields: AgreementFields = {
  from: '2026-10-01', to: '2026-11-01', requestedAmountMinor: 600000, partnerShareBps: 5000,
  workShareBps: 5000, workBasis: 'WORK_SHIFTS', title: 'October agreement', simulationFingerprint: 'sim1:' + 'a'.repeat(64),
}
const http = (status: number, code = '') => ({ response: { status, data: { code } } })
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  state.auth.token = 'token-a'
  state.session.owner = { accountId: agreementOrigin.accountId, apiBase: '/api/v1' }
  state.session.memberId = agreementOrigin.memberId
  state.session.deviceId = agreementOrigin.deviceId
  state.session.deviceToken = 'device-token'
  state.session.member = { role: 'socio', active: true }
  mocks.create.mockResolvedValue(agreementFixture())
  mocks.reverse.mockResolvedValue(reversalFixture())
  mocks.list.mockResolvedValue({ items: [agreementItemFixture()], nextCursor: null })
  mocks.get.mockResolvedValue(agreementFixture())
})
describe('exact agreement attempts', () => {
  it.each([new Error('Network Error'), http(503, 'FINANCE_AGREEMENT_BUSY'), new FinanceAgreementContractError()])(
    'keeps the entire uncertain body, UUIDv7, time and origin for manual replay', async (failure) => {
      const store = useFinanceAgreementsStore()
      mocks.create.mockRejectedValueOnce(failure)
      expect(await store.create(fields)).toBeNull()
      const first = mocks.create.mock.calls[0]!
      const pending = store.pendingCreate!
      expect(pending.id).toMatch(/^[0-9a-f-]{14}7/)
      expect(pending.createdByMemberId).toBe(agreementOrigin.memberId)
      expect(await store.create({ ...fields, title: 'Changed' })).toBeNull()
      expect(mocks.create).toHaveBeenCalledTimes(1)
      pending.title = 'Mutated exposed copy'
      store.clearMessages()
      await store.retryCreate()
      expect(mocks.create.mock.calls[1]).toEqual(first)
      expect(store.pendingCreate).toBeNull()
      expect(store.created?.folio).toBe('AC-2026-00001')
    },
  )
  it('does not replay drift until a newly confirmed fingerprint is supplied', async () => {
    const store = useFinanceAgreementsStore()
    mocks.create.mockRejectedValueOnce(http(409, 'FINANCE_AGREEMENT_SIMULATION_CHANGED'))
    await store.create(fields)
    store.clearMessages()
    expect(store.simulationChanged).toBe(true)
    expect(store.pendingCreate).toBeNull()
    await store.retryCreate()
    await store.create(fields)
    expect(mocks.create).toHaveBeenCalledTimes(1)
    await store.create({ ...fields, simulationFingerprint: 'sim1:' + 'c'.repeat(64) })
    expect(mocks.create).toHaveBeenCalledTimes(2)
    expect(store.simulationChanged).toBe(false)
  })
  it('prevents simultaneous/double create and reversal mutations', async () => {
    const pending = deferred<ReturnType<typeof agreementFixture>>()
    mocks.create.mockReturnValueOnce(pending.promise)
    const store = useFinanceAgreementsStore()
    const run = store.create(fields)
    await store.create(fields)
    await store.reverse(AGREEMENT_ID, 'Correction')
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.reverse).not.toHaveBeenCalled()
    pending.resolve(agreementFixture())
    await run
  })
  it('retains reversal reason/body and rejects changing target or reason during uncertain recovery', async () => {
    const store = useFinanceAgreementsStore()
    mocks.reverse.mockRejectedValueOnce(new Error('lost response'))
    await store.reverse(AGREEMENT_ID, '  Correction  ')
    const first = mocks.reverse.mock.calls[0]
    await store.reverse(AGREEMENT_ID, 'Different reason')
    expect(mocks.reverse).toHaveBeenCalledTimes(1)
    await store.reverse(AGREEMENT_ID, 'Correction')
    expect(mocks.reverse.mock.calls[1]).toEqual(first)
    expect(store.pendingReversal).toBeNull()
    expect(store.reversed?.original.status).toBe('active')
    expect(store.detail).toBeNull()
  })
})
describe('session and connection isolation', () => {
  it.each(['token', 'member', 'device', 'account', 'api', 'deviceToken', 'role', 'active'])('ignores late responses and wipes memory on %s changes', async (field) => {
    const pending = deferred<ReturnType<typeof agreementFixture>>()
    const store = useFinanceAgreementsStore()
    await store.load()
    await store.loadDetail(AGREEMENT_ID)
    mocks.create.mockReturnValueOnce(pending.promise)
    const run = store.create(fields)
    if (field === 'token') state.auth.token = 'token-b'
    if (field === 'member') state.session.memberId = AGREEMENT_ID
    if (field === 'device') state.session.deviceId = AGREEMENT_ID
    if (field === 'account') state.session.owner.accountId = AGREEMENT_ID
    if (field === 'api') state.session.owner.apiBase = '/another/api'
    if (field === 'deviceToken') state.session.deviceToken = 'new-device-token'
    if (field === 'role') state.session.member.role = 'colaborador'
    if (field === 'active') state.session.member.active = false
    expect(store.items).toEqual([])
    expect(store.detail).toBeNull()
    expect(store.pendingCreate).toBeNull()
    pending.resolve(agreementFixture())
    expect(await run).toBeNull()
    expect(store.created).toBeNull()
    expect(store.saving).toBe(false)
  })
  it('never sends offline or without socio access and persists no attempts', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const persisted = vi.spyOn(Storage.prototype, 'setItem')
    const store = useFinanceAgreementsStore()
    await store.create(fields)
    await store.reverse(AGREEMENT_ID, 'Correction')
    await store.load()
    await store.loadDetail(AGREEMENT_ID)
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.reverse).not.toHaveBeenCalled()
    expect(mocks.list).not.toHaveBeenCalled()
    expect(mocks.get).not.toHaveBeenCalled()
    online.mockRestore()
    state.session.member.role = 'colaborador'
    await store.create(fields)
    expect(mocks.create).not.toHaveBeenCalled()
    expect(persisted).not.toHaveBeenCalled()
    persisted.mockRestore()
  })
})
describe('history and detail sequencing', () => {
  it('drops slow old pages and preserves exact filters/cursor for pagination', async () => {
    const pending = deferred<{ items: ReturnType<typeof agreementItemFixture>[]; nextCursor: string | null }>()
    mocks.list.mockReturnValueOnce(pending.promise)
    mocks.list.mockResolvedValueOnce({ items: [agreementItemFixture()], nextCursor: 'opaque' })
    const store = useFinanceAgreementsStore()
    const old = store.load({ status: 'active' })
    await store.load({ status: 'voided', folio: 'AC-2026-00001' })
    pending.resolve({ items: [], nextCursor: 'old' })
    await old
    expect(store.nextCursor).toBe('opaque')
    mocks.list.mockResolvedValueOnce({ items: [agreementItemFixture()], nextCursor: null })
    await store.loadMore()
    expect(mocks.list.mock.calls.at(-1)?.[1]).toEqual({ status: 'voided', folio: 'AC-2026-00001', cursor: 'opaque' })
    expect(store.items).toHaveLength(1)
  })
  it('does not repopulate detail or history after reset', async () => {
    const pending = deferred<ReturnType<typeof agreementFixture>>()
    mocks.get.mockReturnValueOnce(pending.promise)
    const store = useFinanceAgreementsStore()
    const old = store.loadDetail(AGREEMENT_ID)
    store.reset()
    pending.resolve(agreementFixture())
    expect(await old).toBeNull()
    expect(store.detail).toBeNull()
    expect(store.detailLoading).toBe(false)
  })
})


describe('fresh confirmation after reverted financial drift', () => {
  it('permits the same fingerprint only after an explicit successful recalculation acknowledgement', async () => {
    const store = useFinanceAgreementsStore()
    mocks.create.mockRejectedValueOnce(http(409, 'FINANCE_AGREEMENT_SIMULATION_CHANGED'))
    await store.create(fields)
    await store.create(fields)
    expect(mocks.create).toHaveBeenCalledTimes(1)
    store.acceptSimulation(fields.simulationFingerprint)
    expect(store.simulationChanged).toBe(false)
    await store.create(fields)
    expect(mocks.create).toHaveBeenCalledTimes(2)
  })
})


describe('uncertain cross-operation sequencing', () => {
  it('blocks reversal after an uncertain create has settled until that exact create is resolved', async () => {
    const store = useFinanceAgreementsStore()
    mocks.create.mockRejectedValueOnce(new Error('lost response'))
    await store.create(fields)
    await store.reverse(AGREEMENT_ID, 'Correction')
    expect(mocks.reverse).not.toHaveBeenCalled()
    await store.retryCreate()
    await store.reverse(AGREEMENT_ID, 'Correction')
    expect(mocks.reverse).toHaveBeenCalledTimes(1)
  })
  it('blocks new creation after an uncertain reversal has settled until that exact reversal is resolved', async () => {
    const store = useFinanceAgreementsStore()
    mocks.reverse.mockRejectedValueOnce(new Error('lost response'))
    await store.reverse(AGREEMENT_ID, 'Correction')
    await store.create(fields)
    await store.retryCreate()
    expect(mocks.create).not.toHaveBeenCalled()
    await store.reverse(AGREEMENT_ID, 'Correction')
    await store.create(fields)
    expect(mocks.create).toHaveBeenCalledTimes(1)
  })
})

describe('live status separated from frozen detail', () => {
  it('keeps same-id historical detail through refresh failures but marks status unconfirmed', async () => {
    const store = useFinanceAgreementsStore()
    await store.loadDetail(AGREEMENT_ID)
    expect(store.detailCurrent).toBe(true)
    const before = JSON.stringify(store.detail)
    mocks.get.mockRejectedValueOnce(new Error('Network Error'))
    await store.loadDetail(AGREEMENT_ID)
    expect(JSON.stringify(store.detail)).toBe(before)
    expect(store.detailCurrent).toBe(false)
    mocks.get.mockRejectedValueOnce(new Error('Network Error'))
    await store.loadDetail('0190aaaa-0000-7000-8000-000000000099')
    expect(store.detail).toBeNull()
  })
  it('does not project the reversal receipt as live detail or alter the frozen allocation', async () => {
    const store = useFinanceAgreementsStore()
    await store.loadDetail(AGREEMENT_ID)
    const original = JSON.stringify(store.detail)
    await store.reverse(AGREEMENT_ID, 'Correction')
    expect(JSON.stringify(store.detail)).toBe(original)
    expect(store.detailCurrent).toBe(false)
    expect(store.reversed?.original.status).toBe('active')
    mocks.get.mockResolvedValueOnce(agreementFixture({ status: 'voided', reversal: reversalFixture() }))
    await store.loadDetail(AGREEMENT_ID)
    expect(store.detailCurrent).toBe(true)
    expect(store.detail?.status).toBe('voided')
  })
})
