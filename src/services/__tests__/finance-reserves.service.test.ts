import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../api'
import { FinanceReservesService, validReservePage, validReserveReceipt } from '../finance-reserves.service'
import { FinanceReserveContractError } from '@/utils/finance-reserves'
import {
  CANCEL_ID,
  RESERVE_ID,
  cancellationFixture,
  cancellationReceiptFixture,
  reserveItemFixture,
  reserveOrigin,
  reservePageFixture,
  reserveReceiptFixture,
} from './finance-reserves.fixture'
import type { CancelReservePayload, CreateReservePayload } from '@/types/finance-reserve.types'

vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

const payload: CreateReservePayload = {
  id: RESERVE_ID,
  name: 'Renta del local',
  amountMinor: 500000,
  periodFrom: '2026-10-01',
  periodTo: '2026-11-01',
  note: null,
  occurredAt: '2026-10-07T12:00:00.000Z',
  createdByMemberId: reserveOrigin.memberId,
  deviceId: reserveOrigin.deviceId,
}
const cancelPayload: CancelReservePayload = {
  id: CANCEL_ID,
  reason: 'Ya no se necesita',
  occurredAt: '2026-10-08T12:00:00.000Z',
  createdByMemberId: reserveOrigin.memberId,
  deviceId: reserveOrigin.deviceId,
}

beforeEach(() => {
  vi.mocked(api.get).mockReset()
  vi.mocked(api.post).mockReset()
})

describe('FinanceReservesService.create', () => {
  it('posts the exact body with member/device headers and the financial origin', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: reserveReceiptFixture() })
    const receipt = await FinanceReservesService.create(reserveOrigin, payload)
    expect(api.post).toHaveBeenCalledTimes(1)
    const [url, body, config] = vi.mocked(api.post).mock.calls[0] as [string, unknown, Record<string, unknown>]
    expect(url).toBe('/finance/reserves')
    expect(body).toEqual(payload)
    expect(body).not.toHaveProperty('contextId')
    expect(body).not.toHaveProperty('createdByAccountId')
    expect(config.headers).toEqual({ 'x-device-id': reserveOrigin.deviceId })
    expect(config.financialOrigin).toBe(reserveOrigin)
    expect(receipt.id).toBe(RESERVE_ID)
  })

  it('accepts the replayed receipt for the same id (200) exactly like the first one', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: reserveReceiptFixture(), status: 200 })
    await expect(FinanceReservesService.create(reserveOrigin, payload)).resolves.toMatchObject({ id: RESERVE_ID })
  })

  it.each([
    ['unknown shape', { ok: true }],
    ['a different reserve id', reserveReceiptFixture({ id: CANCEL_ID })],
    ['non-integer amount', { ...reserveReceiptFixture(), amountMinor: 10.5 }],
    ['non-positive amount', { ...reserveReceiptFixture(), amountMinor: 0 }],
    ['other currency', { ...reserveReceiptFixture(), currency: 'USD' }],
    ['inverted period', { ...reserveReceiptFixture(), periodFrom: '2026-11-01', periodTo: '2026-10-01' }],
    ['bad instant', { ...reserveReceiptFixture(), receivedAt: 'yesterday' }],
  ])('rejects a response with %s', async (_name, data) => {
    vi.mocked(api.post).mockResolvedValue({ data })
    await expect(FinanceReservesService.create(reserveOrigin, payload)).rejects.toBeInstanceOf(FinanceReserveContractError)
  })

  it('propagates 409 and 400 untouched so the store can map them', async () => {
    for (const status of [409, 400]) {
      const failure = Object.assign(new Error('x'), { response: { status, data: { message: 'm' } } })
      vi.mocked(api.post).mockRejectedValueOnce(failure)
      await expect(FinanceReservesService.create(reserveOrigin, payload)).rejects.toBe(failure)
    }
  })
})

describe('FinanceReservesService.list', () => {
  it('sends the exact period (exclusive end as given), status and cursor unchanged', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: reservePageFixture([], null) })
    await FinanceReservesService.list(reserveOrigin, {
      from: '2026-10-01',
      to: '2026-11-01',
      status: 'active',
      limit: 20,
      cursor: 'opaque==',
    })
    const [url, config] = vi.mocked(api.get).mock.calls[0] as [string, Record<string, unknown>]
    expect(url).toBe('/finance/reserves')
    expect(config.params).toEqual({ from: '2026-10-01', to: '2026-11-01', status: 'active', limit: 20, cursor: 'opaque==' })
    expect(config.headers).toEqual({ 'x-device-id': reserveOrigin.deviceId })
  })

  it('omits from/to for all periods and drops undefined filters', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: reservePageFixture() })
    const page = await FinanceReservesService.list(reserveOrigin, { status: 'reversed', from: undefined, to: undefined })
    expect((vi.mocked(api.get).mock.calls[0]![1] as { params: object }).params).toEqual({ status: 'reversed' })
    expect(page.items).toHaveLength(1)
  })

  it('accepts reversed items with their cancellation', () => {
    const page = reservePageFixture([reserveItemFixture({ status: 'reversed', reversal: cancellationFixture() })], 'next')
    expect(validReservePage(page)).toBe(true)
  })

  it.each([
    ['not an object', 'nope'],
    ['items missing', { nextCursor: null }],
    ['cursor of the wrong type', { items: [], nextCursor: 4 }],
    ['unknown status', reservePageFixture([{ ...reserveItemFixture(), status: 'weird' } as never])],
    ['active with a reversal', reservePageFixture([reserveItemFixture({ reversal: cancellationFixture() })])],
    ['reversed without a reversal', reservePageFixture([reserveItemFixture({ status: 'reversed', reversal: null })])],
    [
      'reversal of another reserve',
      reservePageFixture([reserveItemFixture({ status: 'reversed', reversal: cancellationFixture({ reserveId: CANCEL_ID }) })]),
    ],
    ['item with fractional money', reservePageFixture([{ ...reserveItemFixture(), amountMinor: 1.5 }])],
  ])('rejects an unknown shape: %s', async (_name, data) => {
    expect(validReservePage(data)).toBe(false)
    vi.mocked(api.get).mockResolvedValue({ data })
    await expect(FinanceReservesService.list(reserveOrigin)).rejects.toBeInstanceOf(FinanceReserveContractError)
  })
})

describe('FinanceReservesService.cancel', () => {
  it('posts to the reserve reversals path with the new cancellation id', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: cancellationReceiptFixture() })
    const receipt = await FinanceReservesService.cancel(reserveOrigin, RESERVE_ID, cancelPayload)
    const [url, body, config] = vi.mocked(api.post).mock.calls[0] as [string, unknown, Record<string, unknown>]
    expect(url).toBe(`/finance/reserves/${RESERVE_ID}/reversals`)
    expect(body).toEqual(cancelPayload)
    expect(body).not.toHaveProperty('reserveId')
    expect(config.financialOrigin).toBe(reserveOrigin)
    expect(receipt.original.id).toBe(RESERVE_ID)
  })

  it.each([
    ['unknown shape', { nope: 1 }],
    ['a receipt for another reserve', cancellationReceiptFixture({ reserveId: CANCEL_ID })],
    ['a receipt with another cancellation id', cancellationReceiptFixture({ id: RESERVE_ID })],
    ['no frozen original', { ...cancellationReceiptFixture(), original: null }],
  ])('rejects %s', async (_name, data) => {
    vi.mocked(api.post).mockResolvedValue({ data })
    await expect(FinanceReservesService.cancel(reserveOrigin, RESERVE_ID, cancelPayload)).rejects.toBeInstanceOf(
      FinanceReserveContractError,
    )
  })

  it('propagates 409 (already cancelled) untouched', async () => {
    const failure = Object.assign(new Error('Conflict'), { response: { status: 409, data: {} } })
    vi.mocked(api.post).mockRejectedValue(failure)
    await expect(FinanceReservesService.cancel(reserveOrigin, RESERVE_ID, cancelPayload)).rejects.toBe(failure)
  })
})

it.each([null, 20261001, {}, []])('rejects non-string receipt dates %j without throwing', (value) => {
  for (const key of ['periodFrom', 'periodTo']) {
    expect(validReserveReceipt({ ...reserveReceiptFixture(), [key]: value })).toBe(false)
    expect(validReservePage({ ...reservePageFixture(), items: [{ ...reserveItemFixture(), [key]: value }] })).toBe(false)
  }
})
