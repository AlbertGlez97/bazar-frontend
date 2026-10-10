import { reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFinancePaymentsStore } from '../finance-payments.store'
import { AGREEMENT_ID, agreementOrigin } from '@/services/__tests__/finance-agreements.fixture'
import { ALBERTO_ID } from '@/services/__tests__/finance-distribution.fixture'
import { PAYMENT_ID, paymentFixture, paymentReceiptFixture, paymentSummaryFixture, partialSummaryFixture, voidedPaymentFixture } from '@/services/__tests__/finance-payments.fixture'
import { FinancePaymentContractError } from '@/utils/finance-payments'

const mocks = vi.hoisted(() => ({ create: vi.fn(), list: vi.fn(), get: vi.fn(), reverse: vi.fn() }))
vi.mock('@/services/finance-payments.service', () => ({ FinancePaymentsService: mocks }))
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
const http = (status: number, code = '', extra: object = {}) => ({ response: { status, data: { code, ...extra } } })
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
const fields = { participantMemberId: ALBERTO_ID, amountMinor: 100000, occurredAt: '2026-10-09T15:00:00.000Z', note: 'Transferencia' }
beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  state.auth.token = 'token-a'
  state.session.owner = { accountId: agreementOrigin.accountId, apiBase: '/api/v1' }
  state.session.memberId = agreementOrigin.memberId
  state.session.deviceId = agreementOrigin.deviceId
  state.session.deviceToken = 'device-token'
  state.session.member = { role: 'socio', active: true }
  mocks.list.mockResolvedValue({ items: [], paymentSummary: paymentSummaryFixture() })
  mocks.create.mockResolvedValue(paymentReceiptFixture({ note: 'Transferencia' }))
  mocks.reverse.mockResolvedValue(voidedPaymentFixture({ paymentSummary: paymentSummaryFixture() }))
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('loading payments', () => {
  it('shows the server summary and history for the requested agreement only', async () => {
    mocks.list.mockResolvedValue({ items: [paymentFixture()], paymentSummary: partialSummaryFixture() })
    const store = useFinancePaymentsStore()
    await store.load(AGREEMENT_ID)
    expect(store.agreementId).toBe(AGREEMENT_ID)
    expect(store.items).toHaveLength(1)
    expect(store.summary?.status).toBe('PARTIALLY_PAID')
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ memberId: agreementOrigin.memberId }), AGREEMENT_ID)
  })
  it('drops another agreement snapshot immediately and explains a forbidden or offline read', async () => {
    const store = useFinancePaymentsStore()
    await store.load(AGREEMENT_ID)
    mocks.list.mockRejectedValueOnce(http(403))
    await store.load('0190aaaa-0000-7000-8000-000000000099')
    expect(store.summary).toBeNull()
    expect(store.items).toEqual([])
    expect(store.error).toContain('personas socias')
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await store.load(AGREEMENT_ID)
    expect(mocks.list).toHaveBeenCalledTimes(2)
    expect(store.error).toContain('Necesitas conexión')
  })
  it('keeps the last confirmed history of the same agreement when a refresh fails', async () => {
    mocks.list.mockResolvedValueOnce({ items: [paymentFixture()], paymentSummary: partialSummaryFixture() })
    const store = useFinancePaymentsStore()
    await store.load(AGREEMENT_ID)
    mocks.list.mockRejectedValueOnce(new Error('Network Error'))
    await store.load(AGREEMENT_ID)
    expect(store.items).toHaveLength(1)
    expect(store.error).not.toBe('')
  })
  it('refuses to read for a collaborator', async () => {
    state.session.member = { role: 'colaborador', active: true }
    const store = useFinancePaymentsStore()
    await store.load(AGREEMENT_ID)
    expect(mocks.list).not.toHaveBeenCalled()
    expect(store.error).not.toBe('')
  })
})

describe('registering a payment', () => {
  it('sends a UUIDv7 once, then refreshes totals from the server instead of computing them', async () => {
    mocks.list.mockResolvedValue({ items: [paymentFixture()], paymentSummary: partialSummaryFixture() })
    const store = useFinancePaymentsStore()
    const result = await store.register(AGREEMENT_ID, fields)
    expect(result?.id).toBe(PAYMENT_ID)
    const [origin, agreementId, payload] = mocks.create.mock.calls[0]!
    expect(origin.memberId).toBe(agreementOrigin.memberId)
    expect(agreementId).toBe(AGREEMENT_ID)
    expect(payload.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/)
    expect(payload).toMatchObject({ ...fields, createdByMemberId: agreementOrigin.memberId, deviceId: agreementOrigin.deviceId })
    expect(Object.keys(payload).sort()).toEqual(['amountMinor', 'createdByMemberId', 'deviceId', 'id', 'note', 'occurredAt', 'participantMemberId'])
    expect(mocks.list).toHaveBeenCalledTimes(1)
    expect(store.summary?.paidMinor).toBe(100000)
    expect(store.registered?.id).toBe(PAYMENT_ID)
    expect(store.pendingPayment).toBeNull()
    expect(store.saveError).toBe('')
  })
  it('treats the 200 replay of an identical payment exactly like the first success', async () => {
    const store = useFinancePaymentsStore()
    mocks.create.mockRejectedValueOnce(new Error('lost response'))
    await store.register(AGREEMENT_ID, fields)
    mocks.create.mockResolvedValueOnce(paymentReceiptFixture({ note: 'Transferencia' }))
    expect((await store.retryRegister())?.id).toBe(PAYMENT_ID)
    expect(store.pendingPayment).toBeNull()
  })
  it.each([new Error('Network Error'), http(503), http(429), http(408), new FinancePaymentContractError()])(
    'keeps the exact uncertain id and body for a manual retry and never auto-sends %#', async (failure) => {
      const store = useFinancePaymentsStore()
      mocks.create.mockRejectedValueOnce(failure)
      expect(await store.register(AGREEMENT_ID, fields)).toBeNull()
      expect(mocks.create).toHaveBeenCalledTimes(1)
      const first = mocks.create.mock.calls[0]!
      const pending = store.pendingPayment!
      expect(pending.agreementId).toBe(AGREEMENT_ID)
      pending.payload.amountMinor = 1
      expect(await store.register(AGREEMENT_ID, { ...fields, amountMinor: 5 })).toBeNull()
      expect(store.saveError).toContain('sin confirmar')
      expect(mocks.create).toHaveBeenCalledTimes(1)
      expect(await store.register(AGREEMENT_ID, fields)).not.toBeNull()
      expect(mocks.create.mock.calls[1]).toEqual(first)
      expect(store.pendingPayment).toBeNull()
    },
  )
  it.each([http(400), http(404), http(409, 'FINANCE_PAYMENT_ID_CONFLICT'), http(422, 'FINANCE_PAYMENT_TIME_INVALID'), http(403)])(
    'discards the attempt on a definitive rejection so the next try gets a new id %#', async (failure) => {
      const store = useFinancePaymentsStore()
      mocks.create.mockRejectedValueOnce(failure)
      expect(await store.register(AGREEMENT_ID, fields)).toBeNull()
      expect(store.pendingPayment).toBeNull()
      expect(store.saveError).not.toBe('')
      await store.register(AGREEMENT_ID, fields)
      expect(mocks.create.mock.calls[1]![2].id).not.toBe(mocks.create.mock.calls[0]![2].id)
    },
  )
  it('shows the exact backend overpayment numbers and the voided-agreement conflict', async () => {
    const store = useFinancePaymentsStore()
    mocks.create.mockRejectedValueOnce(http(422, 'FINANCE_PAYMENT_EXCEEDS_PENDING', { agreedMinor: 270000, paidMinor: 100000, pendingMinor: 170000 }))
    await store.register(AGREEMENT_ID, { ...fields, amountMinor: 200000 })
    expect(store.saveError).toContain('$2,700.00')
    expect(store.saveError).toContain('$1,000.00')
    expect(store.saveError).toContain('$1,700.00')
    mocks.create.mockRejectedValueOnce(http(409, 'FINANCE_PAYMENT_AGREEMENT_VOIDED'))
    await store.register(AGREEMENT_ID, fields)
    expect(store.saveError).toContain('anulado')
  })
  it.each([
    [{ amountMinor: 0 }, 'monto'], [{ amountMinor: 1.5 }, 'monto'], [{ amountMinor: 2147483648 }, 'monto'],
    [{ occurredAt: 'garbage' }, 'fecha'], [{ note: 'x'.repeat(1001) }, 'nota'],
    [{ occurredAt: '2999-01-01T00:00:00.000Z' }, 'futuro'],
  ])('validates %j before sending anything', async (over, word) => {
    const store = useFinancePaymentsStore()
    expect(await store.register(AGREEMENT_ID, { ...fields, ...over })).toBeNull()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(store.saveError.toLowerCase()).toContain(word)
    expect(store.pendingPayment).toBeNull()
  })
  it('prevents a double submit while one request is in flight', async () => {
    const pending = deferred<ReturnType<typeof paymentReceiptFixture>>()
    mocks.create.mockReturnValueOnce(pending.promise)
    const store = useFinancePaymentsStore()
    const run = store.register(AGREEMENT_ID, fields)
    expect(await store.register(AGREEMENT_ID, fields)).toBeNull()
    expect(await store.reverse(PAYMENT_ID, 'Motivo')).toBeNull()
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.reverse).not.toHaveBeenCalled()
    pending.resolve(paymentReceiptFixture({ note: 'Transferencia' }))
    await run
  })
  it('reports a successful payment even when the follow-up refresh fails, without inventing totals', async () => {
    mocks.list.mockRejectedValueOnce(new Error('Network Error'))
    const store = useFinancePaymentsStore()
    expect(await store.register(AGREEMENT_ID, fields)).not.toBeNull()
    expect(store.registered).not.toBeNull()
    expect(store.summary).toBeNull()
    expect(store.error).not.toBe('')
  })
})

describe('offline', () => {
  it('blocks registering and reversing with the exact copy, sends nothing and stores nothing', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const open = vi.fn()
    vi.stubGlobal('indexedDB', { open })
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const store = useFinancePaymentsStore()
    expect(await store.register(AGREEMENT_ID, fields)).toBeNull()
    expect(store.saveError).toBe('Necesitas conexión para registrar un pago.')
    expect(await store.reverse(PAYMENT_ID, 'Motivo')).toBeNull()
    expect(store.reverseError).toBe('Necesitas conexión para anular un pago.')
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.reverse).not.toHaveBeenCalled()
    expect(store.pendingPayment).toBeNull()
    expect(store.pendingReversal).toBeNull()
    expect(setItem).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
  })
  it('does not keep an offline attempt that could be sent later', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const store = useFinancePaymentsStore()
    await store.register(AGREEMENT_ID, fields)
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    expect(await store.retryRegister()).toBeNull()
    expect(mocks.create).not.toHaveBeenCalled()
  })
})

describe('reversing a payment', () => {
  it('sends the trimmed reason once, then refreshes history from the server', async () => {
    mocks.list.mockResolvedValue({ items: [paymentFixture()], paymentSummary: partialSummaryFixture() })
    const store = useFinancePaymentsStore()
    await store.load(AGREEMENT_ID)
    const result = await store.reverse(PAYMENT_ID, '  Monto equivocado ')
    expect(result?.status).toBe('voided')
    const [, paymentId, payload] = mocks.reverse.mock.calls[0]!
    expect(paymentId).toBe(PAYMENT_ID)
    expect(payload).toMatchObject({ reason: 'Monto equivocado', createdByMemberId: agreementOrigin.memberId, deviceId: agreementOrigin.deviceId })
    expect(payload.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/)
    expect(mocks.list).toHaveBeenCalledTimes(2)
    expect(store.pendingReversal).toBeNull()
  })
  it('requires a non-blank reason before sending', async () => {
    const store = useFinancePaymentsStore()
    expect(await store.reverse(PAYMENT_ID, '   ')).toBeNull()
    expect(store.reverseError).toContain('motivo')
    expect(mocks.reverse).not.toHaveBeenCalled()
  })
  it('keeps the exact uncertain reversal and rejects changing the target or reason meanwhile', async () => {
    const store = useFinancePaymentsStore()
    await store.load(AGREEMENT_ID)
    mocks.reverse.mockRejectedValueOnce(new Error('lost response'))
    await store.reverse(PAYMENT_ID, 'Monto equivocado')
    const first = mocks.reverse.mock.calls[0]
    expect(store.pendingReversal?.paymentId).toBe(PAYMENT_ID)
    expect(await store.reverse(PAYMENT_ID, 'Otro motivo')).toBeNull()
    expect(mocks.reverse).toHaveBeenCalledTimes(1)
    await store.reverse(PAYMENT_ID, 'Monto equivocado')
    expect(mocks.reverse.mock.calls[1]).toEqual(first)
    expect(store.pendingReversal).toBeNull()
  })
  it('explains an already voided payment and refreshes without retaining the attempt', async () => {
    const store = useFinancePaymentsStore()
    mocks.reverse.mockRejectedValueOnce(http(409, 'FINANCE_PAYMENT_ALREADY_VOIDED'))
    await store.reverse(PAYMENT_ID, 'Motivo')
    expect(store.reverseError).toContain('ya estaba anulado')
    expect(store.pendingReversal).toBeNull()
  })
  it('does not let a new payment start while a reversal is unconfirmed, and vice versa', async () => {
    const store = useFinancePaymentsStore()
    mocks.reverse.mockRejectedValueOnce(new Error('lost'))
    await store.reverse(PAYMENT_ID, 'Motivo')
    expect(await store.register(AGREEMENT_ID, fields)).toBeNull()
    expect(store.saveError).toContain('sin confirmar')
    expect(mocks.create).not.toHaveBeenCalled()
  })
})

describe('session isolation', () => {
  it.each(['token', 'member', 'device', 'account', 'api', 'deviceToken', 'role', 'active'])(
    'ignores late replies and wipes memory on %s changes', async (field) => {
      const pending = deferred<ReturnType<typeof paymentReceiptFixture>>()
      mocks.create.mockReturnValueOnce(pending.promise)
      const store = useFinancePaymentsStore()
      const run = store.register(AGREEMENT_ID, fields)
      if (field === 'token') state.auth.token = 'token-b'
      if (field === 'member') state.session.memberId = '0190aaaa-0000-7000-8000-000000000002'
      if (field === 'device') state.session.deviceId = '0190aaaa-0000-7000-8000-000000000031'
      if (field === 'account') state.session.owner = { ...state.session.owner, accountId: '0190aaaa-0000-7000-8000-000000000021' }
      if (field === 'api') state.session.owner = { ...state.session.owner, apiBase: '/other' }
      if (field === 'deviceToken') state.session.deviceToken = 'device-token-b'
      if (field === 'role') state.session.member = { role: 'colaborador', active: true }
      if (field === 'active') state.session.member = { role: 'socio', active: false }
      await Promise.resolve()
      pending.resolve(paymentReceiptFixture({ note: 'Transferencia' }))
      expect(await run).toBeNull()
      expect(store.registered).toBeNull()
      expect(store.pendingPayment).toBeNull()
      expect(store.summary).toBeNull()
      expect(store.items).toEqual([])
      expect(store.saving).toBe(false)
      expect(mocks.list).not.toHaveBeenCalled()
    },
  )
  it('ignores a late history read after reset()', async () => {
    const pending = deferred<{ items: never[]; paymentSummary: ReturnType<typeof paymentSummaryFixture> }>()
    mocks.list.mockReturnValueOnce(pending.promise)
    const store = useFinancePaymentsStore()
    const run = store.load(AGREEMENT_ID)
    store.reset()
    pending.resolve({ items: [], paymentSummary: paymentSummaryFixture() })
    await run
    expect(store.summary).toBeNull()
    expect(store.loading).toBe(false)
  })
})
