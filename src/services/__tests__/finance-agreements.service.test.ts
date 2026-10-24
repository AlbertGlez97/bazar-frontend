import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../api'
import { FinanceAgreementsService, validAgreement, validAgreementPage, validAgreementReversalReceipt } from '../finance-agreements.service'
import { FinanceAgreementContractError } from '@/utils/finance-agreements'
import { AGREEMENT_ID, agreementFixture, agreementItemFixture, agreementOrigin, reversalFixture } from './finance-agreements.fixture'
import type { CreateAgreementPayload } from '@/types/finance-agreement.types'
const selection = vi.hoisted(() => ({ current: {} as typeof agreementOrigin }))
vi.mock('../queue-origin', () => ({ currentQueueOrigin: () => selection.current }))
vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn(), defaults: { transformRequest: [] } } }))
const payload = (): CreateAgreementPayload => ({
  id: AGREEMENT_ID, from: '2026-10-01', to: '2026-11-01', requestedAmountMinor: 600000,
  partnerShareBps: 5000, workShareBps: 5000, workBasis: 'WORK_SHIFTS', title: 'October agreement',
  simulationFingerprint: 'sim1:' + 'a'.repeat(64), occurredAt: '2026-10-09T12:00:00.000Z',
  createdByMemberId: agreementOrigin.memberId, deviceId: agreementOrigin.deviceId,
})
beforeEach(() => { vi.clearAllMocks(); selection.current = { ...agreementOrigin } })
describe('agreement response guards', () => {
  it('accepts exact snapshots, summaries and immutable-original reversal receipts', () => {
    expect(validAgreement(agreementFixture())).toBe(true)
    expect(validAgreementPage({ items: [agreementItemFixture()], nextCursor: 'opaque' })).toBe(true)
    expect(validAgreementReversalReceipt(reversalFixture())).toBe(true)
    const { contextId, original, ...projection } = reversalFixture()
    expect(contextId).toBe(original.contextId)
    expect(validAgreement(agreementFixture({ status: 'voided', reversal: projection,
      replacedBy: { id: '0190aaaa-0000-7000-8000-000000000099', folio: 'AC-2026-00002' } }))).toBe(true)
  })
  it.each([
    { id: '0190aaaa-0000-4000-8000-000000000010' }, { simulationFingerprint: 'sim1:' + 'A'.repeat(64) },
    { snapshotFingerprint: 'short' }, { title: '' }, { status: 'reversed' }, { reversal: reversalFixture() },
    { replacesAgreementId: AGREEMENT_ID }, { generatedFrom: 'OTHER' }, { algorithmVersion: 2 },
    { period: { ...agreementFixture().period, from: '2026-02-30' } },
    { period: { ...agreementFixture().period, fromInstant: '2026-10-01T00:00:00Z' } },
    { participants: [{ ...agreementFixture().participants[0], totalMinor: 1 }] },
    { financialBase: { ...agreementFixture().financialBase, remainingAvailableMinor: 1 } },
  ])('rejects malformed or inconsistent snapshots %j', (over) => {
    expect(validAgreement({ ...agreementFixture(), ...over })).toBe(false)
  })
  it('rejects wrong voided status, list figures and mismatched receipt originals', () => {
    expect(validAgreement(agreementFixture({ status: 'voided' }))).toBe(false)
    expect(validAgreementPage({ items: [agreementItemFixture({ distributedMinor: 600001 })], nextCursor: null })).toBe(false)
    expect(validAgreementPage({ items: [agreementItemFixture({ status: 'voided' })], nextCursor: null })).toBe(false)
    expect(validAgreementReversalReceipt(reversalFixture({ agreementId: '0190aaaa-0000-7000-8000-000000000099' }))).toBe(false)
  })
})
describe('agreement API adapter', () => {
  it('sends only the strict create fields, identity headers and validated server snapshot', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: agreementFixture() })
    const result = await FinanceAgreementsService.create(agreementOrigin, { ...payload(), contextId: 'forbidden', pools: {} } as CreateAgreementPayload)
    expect(result.participants[0]?.name).toBe('Alberto')
    expect(api.post).toHaveBeenCalledWith('/finance/distribution-agreements', payload(), expect.objectContaining({
      headers: { 'x-device-id': agreementOrigin.deviceId }, financialOrigin: agreementOrigin,
    }))
  })
  it.each([
    { title: 'Other title' }, { createdBy: { ...agreementFixture().createdBy, accountId: AGREEMENT_ID } },
    { id: '0190aaaa-0000-7000-8000-000000000099' }, { simulationFingerprint: 'sim1:' + 'c'.repeat(64) },
  ])('rejects a successful response belonging to another attempt %j', async (over) => {
    vi.mocked(api.post).mockResolvedValue({ data: agreementFixture(over) })
    await expect(FinanceAgreementsService.create(agreementOrigin, payload())).rejects.toBeInstanceOf(FinanceAgreementContractError)
  })
  it('whitelists exact list filters and validates detail identity', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { items: [agreementItemFixture()], nextCursor: null } })
    await FinanceAgreementsService.list(agreementOrigin, { from: '2026-10-01', to: '2026-11-01', status: 'voided',
      folio: 'AC-2026-00001', limit: 20, cursor: 'opaque', extra: 'forbidden' } as never)
    expect(vi.mocked(api.get).mock.calls[0]?.[1]?.params).toEqual({ from: '2026-10-01', to: '2026-11-01', status: 'voided', folio: 'AC-2026-00001', limit: 20, cursor: 'opaque' })
    vi.mocked(api.get).mockResolvedValueOnce({ data: agreementFixture() })
    await expect(FinanceAgreementsService.get(agreementOrigin, '0190aaaa-0000-7000-8000-000000000099')).rejects.toBeInstanceOf(FinanceAgreementContractError)
  })
  it('uses the exact reversal endpoint and original receipt without forging voided detail', async () => {
    const receipt = reversalFixture()
    vi.mocked(api.post).mockResolvedValue({ data: receipt })
    await expect(FinanceAgreementsService.reverse(agreementOrigin, AGREEMENT_ID, receipt)).resolves.toEqual(receipt)
    const body = vi.mocked(api.post).mock.calls[0]?.[1] as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(['id', 'reason', 'occurredAt', 'createdByMemberId', 'deviceId'].sort())
    expect(vi.mocked(api.post).mock.calls[0]?.[0]).toBe('/finance/distribution-agreements/' + AGREEMENT_ID + '/reversals')
  })
  it('blocks a changed selected member both before a call and at Axios dispatch', async () => {
    selection.current.memberId = AGREEMENT_ID
    await expect(FinanceAgreementsService.create(agreementOrigin, payload())).rejects.toThrow(/origin/)
    expect(api.post).not.toHaveBeenCalled()
    selection.current = { ...agreementOrigin }
    vi.mocked(api.post).mockResolvedValue({ data: agreementFixture() })
    await FinanceAgreementsService.create(agreementOrigin, payload())
    const config = vi.mocked(api.post).mock.calls[0]?.[2]
    const transforms = config?.transformRequest
    selection.current.memberId = AGREEMENT_ID
    expect(() => (transforms as ((data: unknown) => unknown)[])[0]?.({})).toThrow(/origin/)
  })
})


describe('online adapter boundary', () => {
  it('does not dispatch offline mutations even when called without the store', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await expect(FinanceAgreementsService.create(agreementOrigin, payload())).rejects.toThrow(/connection/)
    await expect(FinanceAgreementsService.reverse(agreementOrigin, AGREEMENT_ID, reversalFixture())).rejects.toThrow(/connection/)
    expect(api.post).not.toHaveBeenCalled()
    online.mockRestore()
  })
})

it('accepts a voided exact create replay with current replacement links and the unchanged snapshot', async () => {
  const snapshot = agreementFixture({ status: 'voided', reversal: reversalFixture(), replacedBy: { id: '0190aaaa-0000-7000-8000-000000000099', folio: 'AC-2026-00002' } });
  vi.mocked(api.post).mockResolvedValue({ status: 200, data: snapshot });
  expect(await FinanceAgreementsService.create(agreementOrigin, payload())).toEqual(snapshot);
  expect(vi.mocked(api.post).mock.calls[0]?.[1]).toEqual(payload());
});
