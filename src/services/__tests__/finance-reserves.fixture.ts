import type {
  ReserveCancellation,
  ReserveCancellationReceipt,
  ReserveListItem,
  ReservePage,
  ReserveReceipt,
} from '@/types/finance-reserve.types'

export const RESERVE_ID = '0199a600-0000-7000-8000-000000000001'
export const CANCEL_ID = '0199a600-0000-7000-8000-000000000002'
const MEMBER = '11111111-1111-4111-8111-111111111111'
const DEVICE = '22222222-2222-4222-8222-222222222222'
const ACCOUNT = '33333333-3333-4333-8333-333333333333'

export const reserveOrigin = { accountId: ACCOUNT, apiBase: '/api/v1', memberId: MEMBER, deviceId: DEVICE }

/** Shared test fixture: a stored reserve receipt (`periodTo` is EXCLUSIVE). */
export const reserveReceiptFixture = (over: Partial<ReserveReceipt> = {}): ReserveReceipt => ({
  id: RESERVE_ID,
  name: 'Renta del local',
  amountMinor: 500000,
  currency: 'MXN',
  periodFrom: '2026-10-01',
  periodTo: '2026-11-01',
  note: null,
  occurredAt: '2026-10-07T12:00:00.000Z',
  receivedAt: '2026-10-07T12:00:01.000Z',
  createdByMemberId: MEMBER,
  createdByAccountId: ACCOUNT,
  deviceId: DEVICE,
  contextId: 'ctx-1',
  ...over,
})

export const cancellationFixture = (over: Partial<ReserveCancellation> = {}): ReserveCancellation => ({
  id: CANCEL_ID,
  reserveId: RESERVE_ID,
  reason: 'Ya no se necesita',
  occurredAt: '2026-10-08T12:00:00.000Z',
  receivedAt: '2026-10-08T12:00:01.000Z',
  createdByMemberId: MEMBER,
  createdByAccountId: ACCOUNT,
  deviceId: DEVICE,
  ...over,
})

export const cancellationReceiptFixture = (over: Partial<ReserveCancellationReceipt> = {}): ReserveCancellationReceipt => ({
  ...cancellationFixture(),
  contextId: 'ctx-1',
  original: reserveReceiptFixture(),
  ...over,
})

export const reserveItemFixture = (over: Partial<ReserveListItem> = {}): ReserveListItem => ({
  ...reserveReceiptFixture(),
  status: 'active',
  reversal: null,
  ...over,
})

export const reservePageFixture = (items: ReserveListItem[] = [reserveItemFixture()], nextCursor: string | null = null): ReservePage => ({
  items,
  nextCursor,
})
