/**
 * Planned reserves (Finanzas > Reservas). A reserve is a PLAN, never cash set
 * aside, a payment or a distribution. Money is integer MXN cents. Source of
 * truth: bazar-api/doc/finance-overview-reserves.md (create/list/cancel).
 *
 * Periods are calendar dates `YYYY-MM-DD` and `periodTo` is EXCLUSIVE: the
 * range picker emits inclusive days, so callers send `addDaysToKey(to, 1)`.
 */
export type ReserveStatus = 'active' | 'reversed'

/** Exact body of POST /finance/reserves. */
export interface CreateReservePayload {
  /** Client-generated UUIDv7: the idempotency key. */
  id: string
  name: string
  amountMinor: number
  currency?: 'MXN'
  periodFrom: string
  /** Exclusive end. */
  periodTo: string
  note?: string | null
  /** Zoned ISO instant (audit). */
  occurredAt: string
  createdByMemberId: string
  deviceId: string
}

/** User-entered fields; id, audit instant and origin are added by the store. */
export type ReserveFields = Pick<CreateReservePayload, 'name' | 'amountMinor' | 'periodFrom' | 'periodTo' | 'note'>

/** Exact body of POST /finance/reserves/:id/reversals. */
export interface CancelReservePayload {
  /** NEW client UUIDv7 (never the reserve id). */
  id: string
  reason: string
  occurredAt: string
  createdByMemberId: string
  deviceId: string
}

export interface ReserveReceipt {
  id: string
  name: string
  amountMinor: number
  currency: 'MXN'
  periodFrom: string
  /** Exclusive end. */
  periodTo: string
  note: string | null
  occurredAt: string
  receivedAt: string
  createdByMemberId: string
  createdByAccountId: string
  deviceId: string
  contextId: string
}

export interface ReserveCancellation {
  id: string
  reserveId: string
  reason: string
  occurredAt: string
  receivedAt: string
  createdByMemberId: string
  createdByAccountId: string
  deviceId: string
}

export interface ReserveCancellationReceipt extends ReserveCancellation {
  contextId: string
  /** Frozen creation receipt. */
  original: ReserveReceipt
}

export interface ReserveListItem extends ReserveReceipt {
  status: ReserveStatus
  reversal: ReserveCancellation | null
}

export interface ReservePage {
  items: ReserveListItem[]
  nextCursor: string | null
}

/** Query of GET /finance/reserves. `from`/`to` go together and match the stored period EXACTLY. */
export interface ReserveFilter {
  from?: string
  /** Exclusive end, as stored. */
  to?: string
  status?: ReserveStatus
  limit?: number
  cursor?: string
}
