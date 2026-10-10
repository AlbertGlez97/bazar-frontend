import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../api'
import { FinancePaymentsService, validPayment, validPaymentList, validPaymentSummary } from '../finance-payments.service'
import { validAgreement } from '../finance-agreements.service'
import { FinancePaymentContractError } from '@/utils/finance-payments'
import { AGREEMENT_ID, agreementFixture, agreementOrigin } from './finance-agreements.fixture'
import { ADID_ID, ALBERTO_ID } from './finance-distribution.fixture'
import { PAYMENT_ID, PAYMENT_REVERSAL_ID, paymentFixture, paymentReceiptFixture, paymentSummaryFixture, partialSummaryFixture, voidedPaymentFixture } from './finance-payments.fixture'
import type { CreatePaymentPayload, ReversePaymentPayload } from '@/types/finance-payment.types'

const selection = vi.hoisted(() => ({ current: {} as typeof agreementOrigin }))
vi.mock('../queue-origin', () => ({ currentQueueOrigin: () => selection.current }))
vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn(), defaults: { transformRequest: [] } } }))
const payload = (): CreatePaymentPayload => ({
  id: PAYMENT_ID, participantMemberId: ALBERTO_ID, amountMinor: 100000, occurredAt: '2026-10-09T15:00:00.000Z',
  note: 'Transferencia', createdByMemberId: agreementOrigin.memberId, deviceId: agreementOrigin.deviceId,
})
const reversal = (): ReversePaymentPayload => ({
  id: PAYMENT_REVERSAL_ID, reason: 'Monto equivocado', occurredAt: '2026-10-09T16:00:00.000Z',
  createdByMemberId: agreementOrigin.memberId, deviceId: agreementOrigin.deviceId,
})
beforeEach(() => { vi.clearAllMocks(); selection.current = { ...agreementOrigin } })

describe('payment response guards', () => {
  it('accepts active, voided and receipt payments plus consistent summaries', () => {
    expect(validPayment(paymentFixture())).toBe(true)
    expect(validPayment(voidedPaymentFixture())).toBe(true)
    expect(validPayment(paymentReceiptFixture())).toBe(true)
    expect(validPaymentSummary(paymentSummaryFixture())).toBe(true)
    expect(validPaymentSummary(partialSummaryFixture())).toBe(true)
    expect(validPaymentList({ items: [paymentFixture()], paymentSummary: partialSummaryFixture() })).toBe(true)
  })
  it.each([
    { id: '0190bbbb-0000-4000-8000-000000000001' }, { amountMinor: 0 }, { amountMinor: 2147483648 }, { amountMinor: 1.5 },
    { currency: 'USD' }, { occurredAt: 'yesterday' }, { note: 'x'.repeat(1001) }, { participantName: '' },
    { status: 'reversed' }, { status: 'voided' }, { reversal: voidedPaymentFixture().reversal },
    { createdBy: { memberId: 'x' } },
  ])('rejects malformed or inconsistent payments %j', (over) => {
    expect(validPayment({ ...paymentFixture(), ...over })).toBe(false)
  })
  it('rejects a voided payment whose reversal is empty or reuses the payment id', () => {
    const voided = voidedPaymentFixture()
    expect(validPayment({ ...voided, reversal: { ...voided.reversal!, reason: '' } })).toBe(false)
    expect(validPayment({ ...voided, reversal: { ...voided.reversal!, id: PAYMENT_ID } })).toBe(false)
  })
  it.each([
    { status: 'PAID' }, { pendingMinor: 1 }, { hasPayments: true }, { paymentCount: -1 }, { activePaymentCount: 3 },
    { participants: [] }, { participants: [{ ...paymentSummaryFixture().participants[0], status: 'PAID' }] },
    { participants: [{ ...paymentSummaryFixture().participants[0], paidMinor: 300000, pendingMinor: -30000, status: 'PAID' }, paymentSummaryFixture().participants[1]] },
  ])('rejects inconsistent summaries %j', (over) => {
    expect(validPaymentSummary({ ...paymentSummaryFixture(), ...over })).toBe(false)
  })
  it('derives NOT_DUE for participants without an agreed amount and ignores them in the agreement status', () => {
    const summary = paymentSummaryFixture({
      status: 'UNPAID', agreedMinor: 330000, pendingMinor: 330000,
      participants: [
        { memberId: ALBERTO_ID, memberName: 'Alberto', agreedMinor: 0, paidMinor: 0, pendingMinor: 0, status: 'NOT_DUE' },
        { memberId: ADID_ID, memberName: 'Adid', agreedMinor: 330000, paidMinor: 0, pendingMinor: 330000, status: 'UNPAID' },
      ],
    })
    expect(validPaymentSummary(summary)).toBe(true)
    expect(validPaymentSummary({ ...summary, status: 'PARTIALLY_PAID' })).toBe(false)
  })
  it('keeps accepting agreement details with or without the live paymentSummary (validated separately before use)', () => {
    expect(validAgreement(agreementFixture())).toBe(true)
    expect(validAgreement(agreementFixture({ paymentSummary: partialSummaryFixture() }))).toBe(true)
    expect(validPaymentSummary(agreementFixture({ paymentSummary: { ...partialSummaryFixture(), status: 'PAID' } }).paymentSummary)).toBe(false)
  })
})

describe('payments API adapter', () => {
  const headers = { 'x-member-id': agreementOrigin.memberId, 'x-device-id': agreementOrigin.deviceId }
  it('sends only the strict create fields with identity headers and accepts the 201 receipt', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: paymentReceiptFixture({ note: 'Transferencia' }) })
    const forbidden = { ...payload(), agreedMinor: 1, pendingMinor: 1, contextId: 'x', participantName: 'Mallory', currency: 'USD' } as CreatePaymentPayload
    const result = await FinancePaymentsService.create(agreementOrigin, AGREEMENT_ID, forbidden)
    expect(result.paymentSummary?.hasPayments).toBe(true)
    expect(api.post).toHaveBeenCalledWith('/finance/distribution-agreements/' + AGREEMENT_ID + '/payments', payload(), expect.objectContaining({
      headers, financialOrigin: agreementOrigin,
    }))
  })
  it('omits a blank note from the body and trims a real one', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: paymentReceiptFixture() })
    await FinancePaymentsService.create(agreementOrigin, AGREEMENT_ID, { ...payload(), note: '   ' })
    expect(vi.mocked(api.post).mock.calls[0]?.[1]).not.toHaveProperty('note')
    vi.mocked(api.post).mockResolvedValue({ data: paymentReceiptFixture({ note: 'Transferencia' }) })
    await FinancePaymentsService.create(agreementOrigin, AGREEMENT_ID, { ...payload(), note: '  Transferencia ' })
    expect(vi.mocked(api.post).mock.calls[1]?.[1]).toHaveProperty('note', 'Transferencia')
  })
  it.each([
    { amountMinor: 99999 }, { participantMemberId: ADID_ID }, { id: '0190bbbb-0000-7000-8000-000000000099' },
    { occurredAt: '2026-10-08T15:00:00.000Z' }, { note: 'Otra nota' }, { createdBy: { memberId: ALBERTO_ID, name: 'Otro', accountId: AGREEMENT_ID, deviceId: AGREEMENT_ID } },
  ])('treats a 2xx belonging to another attempt as uncertain %j', async (over) => {
    vi.mocked(api.post).mockResolvedValue({ data: paymentReceiptFixture({ note: 'Transferencia', ...over }) })
    await expect(FinancePaymentsService.create(agreementOrigin, AGREEMENT_ID, payload())).rejects.toBeInstanceOf(FinancePaymentContractError)
  })
  it('treats a malformed 2xx or a missing live summary as uncertain', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: PAYMENT_ID } })
    await expect(FinancePaymentsService.create(agreementOrigin, AGREEMENT_ID, payload())).rejects.toBeInstanceOf(FinancePaymentContractError)
    vi.mocked(api.post).mockResolvedValue({ data: paymentFixture({ note: 'Transferencia' }) })
    await expect(FinancePaymentsService.create(agreementOrigin, AGREEMENT_ID, payload())).rejects.toBeInstanceOf(FinancePaymentContractError)
  })
  it.each([
    { amountMinor: 0 }, { amountMinor: 2147483648 }, { amountMinor: 10.5 }, { occurredAt: 'not-a-date' },
    { occurredAt: '2026-10-09T15:00:00.1234Z' }, { note: 'x'.repeat(1001) }, { participantMemberId: 'nope' }, { id: 'nope' },
  ])('refuses to dispatch an invalid create body %j', async (over) => {
    await expect(FinancePaymentsService.create(agreementOrigin, AGREEMENT_ID, { ...payload(), ...over })).rejects.toThrow()
    expect(api.post).not.toHaveBeenCalled()
  })
  it('refuses to dispatch when the payload identity is not the active selection', async () => {
    await expect(FinancePaymentsService.create(agreementOrigin, AGREEMENT_ID, { ...payload(), createdByMemberId: ADID_ID })).rejects.toThrow()
    await expect(FinancePaymentsService.create(agreementOrigin, 'bad-id', payload())).rejects.toThrow()
    expect(api.post).not.toHaveBeenCalled()
  })
  it('lists payments for one agreement and validates the unpaginated envelope', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { items: [paymentFixture()], paymentSummary: partialSummaryFixture() } })
    const list = await FinancePaymentsService.list(agreementOrigin, AGREEMENT_ID)
    expect(list.items).toHaveLength(1)
    expect(api.get).toHaveBeenCalledWith('/finance/distribution-agreements/' + AGREEMENT_ID + '/payments', expect.objectContaining({ headers }))
    vi.mocked(api.get).mockResolvedValueOnce({ data: { items: [paymentFixture({ agreementId: PAYMENT_ID })], paymentSummary: partialSummaryFixture() } })
    await expect(FinancePaymentsService.list(agreementOrigin, AGREEMENT_ID)).rejects.toBeInstanceOf(FinancePaymentContractError)
    vi.mocked(api.get).mockResolvedValueOnce({ data: { items: [], paymentSummary: { status: 'x' } } })
    await expect(FinancePaymentsService.list(agreementOrigin, AGREEMENT_ID)).rejects.toBeInstanceOf(FinancePaymentContractError)
  })
  it('reads one payment by id and rejects another identity', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: paymentFixture() })
    expect((await FinancePaymentsService.get(agreementOrigin, PAYMENT_ID)).id).toBe(PAYMENT_ID)
    expect(vi.mocked(api.get).mock.calls[0]?.[0]).toBe('/finance/distribution-payments/' + PAYMENT_ID)
    vi.mocked(api.get).mockResolvedValueOnce({ data: paymentFixture({ id: PAYMENT_REVERSAL_ID }) })
    await expect(FinancePaymentsService.get(agreementOrigin, PAYMENT_ID)).rejects.toBeInstanceOf(FinancePaymentContractError)
  })
  it('posts the exact reversal body and validates the voided receipt', async () => {
    const receipt = voidedPaymentFixture({ participantSummary: partialSummaryFixture().participants[0], paymentSummary: partialSummaryFixture() })
    vi.mocked(api.post).mockResolvedValue({ data: receipt })
    const result = await FinancePaymentsService.reverse(agreementOrigin, PAYMENT_ID, { ...reversal(), reason: '  Monto equivocado  ', extra: 1 } as ReversePaymentPayload)
    expect(result.status).toBe('voided')
    expect(api.post).toHaveBeenCalledWith('/finance/distribution-payments/' + PAYMENT_ID + '/reversals', reversal(), expect.objectContaining({ headers }))
  })
  it.each([
    { status: 'active', reversal: null }, { paymentSummary: undefined },
  ])('treats a reversal receipt that does not show the payment voided with a live summary as uncertain %j', async (over) => {
    vi.mocked(api.post).mockResolvedValue({ data: { ...voidedPaymentFixture({ paymentSummary: partialSummaryFixture() }), ...over } })
    await expect(FinancePaymentsService.reverse(agreementOrigin, PAYMENT_ID, reversal())).rejects.toBeInstanceOf(FinancePaymentContractError)
  })
  it('refuses an empty reason, a reason over 1000 characters and a reversal that reuses the payment id', async () => {
    await expect(FinancePaymentsService.reverse(agreementOrigin, PAYMENT_ID, { ...reversal(), reason: '   ' })).rejects.toThrow()
    await expect(FinancePaymentsService.reverse(agreementOrigin, PAYMENT_ID, { ...reversal(), reason: 'x'.repeat(1001) })).rejects.toThrow()
    await expect(FinancePaymentsService.reverse(agreementOrigin, PAYMENT_ID, { ...reversal(), id: PAYMENT_ID })).rejects.toThrow()
    expect(api.post).not.toHaveBeenCalled()
  })
  it('does not send anything while offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await expect(FinancePaymentsService.create(agreementOrigin, AGREEMENT_ID, payload())).rejects.toThrow()
    await expect(FinancePaymentsService.list(agreementOrigin, AGREEMENT_ID)).rejects.toThrow()
    expect(api.post).not.toHaveBeenCalled()
    expect(api.get).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})
