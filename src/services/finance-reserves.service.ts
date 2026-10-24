import api from './api'
import { asObject, isInstant, isUuid, MAX_MONEY_MINOR } from './finance-shared'
import { FinanceReserveContractError } from '@/utils/finance-reserves'
import { isValidDateKey } from '@/utils/business-time'
import type { FinanceOrigin } from './contributions-records'
import type {
  CancelReservePayload,
  CreateReservePayload,
  ReserveCancellationReceipt,
  ReserveFilter,
  ReservePage,
  ReserveReceipt,
} from '@/types/finance-reserve.types'

type Rec = Record<string, unknown>

const headers = (origin: FinanceOrigin) => ({
  'x-device-id': origin.deviceId,
})
const requestConfig = (origin: FinanceOrigin) => ({
  headers: headers(origin),
  financialOrigin: origin,
})

const str = (v: unknown): v is string => typeof v === 'string'
const nullableStr = (v: unknown) => v === null || str(v)

function validReceiptShape(r: Rec): boolean {
  return (
    isUuid(r.id) &&
    str(r.name) &&
    typeof r.amountMinor === 'number' &&
    Number.isSafeInteger(r.amountMinor) &&
    r.amountMinor >= 1 &&
    r.amountMinor <= MAX_MONEY_MINOR &&
    r.currency === 'MXN' &&
    str(r.periodFrom) &&
    isValidDateKey(r.periodFrom) &&
    str(r.periodTo) &&
    isValidDateKey(r.periodTo) &&
    r.periodFrom < r.periodTo &&
    nullableStr(r.note) &&
    isInstant(r.occurredAt) &&
    isInstant(r.receivedAt) &&
    isUuid(r.createdByMemberId) &&
    isUuid(r.createdByAccountId) &&
    isUuid(r.deviceId) &&
    str(r.contextId)
  )
}

export function validReserveReceipt(value: unknown): value is ReserveReceipt {
  const r = asObject(value)
  return !!r && validReceiptShape(r)
}

function validCancellationShape(r: Rec): boolean {
  return (
    isUuid(r.id) &&
    isUuid(r.reserveId) &&
    str(r.reason) &&
    isInstant(r.occurredAt) &&
    isInstant(r.receivedAt) &&
    isUuid(r.createdByMemberId) &&
    isUuid(r.createdByAccountId) &&
    isUuid(r.deviceId)
  )
}

export function validReserveCancellationReceipt(value: unknown): value is ReserveCancellationReceipt {
  const r = asObject(value)
  return !!r && validCancellationShape(r) && str(r.contextId) && validReserveReceipt(r.original)
}

/** Strict page check: an unknown or inconsistent item rejects the whole page. */
export function validReservePage(value: unknown): value is ReservePage {
  const page = asObject(value)
  if (!page || !nullableStr(page.nextCursor) || !Array.isArray(page.items)) return false
  return page.items.every((item) => {
    const r = asObject(item)
    if (!r || !validReceiptShape(r)) return false
    if (r.status === 'active') return r.reversal === null
    if (r.status !== 'reversed') return false
    const reversal = asObject(r.reversal)
    return !!reversal && validCancellationShape(reversal) && reversal.reserveId === r.id
  })
}

export const FinanceReservesService = {
  /**
   * POST /finance/reserves — 201 first time, 200 for an exact replay (same
   * body and id): both return the stored receipt, so retrying with the SAME id
   * is always safe. Callers must reuse the id of an uncertain attempt.
   */
  async create(origin: FinanceOrigin, payload: CreateReservePayload): Promise<ReserveReceipt> {
    const { data } = await api.post<unknown>('/finance/reserves', payload, requestConfig(origin) as Parameters<typeof api.post>[2])
    if (!validReserveReceipt(data) || data.id !== payload.id) throw new FinanceReserveContractError()
    return data
  },
  /** GET /finance/reserves. With `from`/`to` the match is EXACT (not overlap); `to` is exclusive. */
  async list(origin: FinanceOrigin, filter: ReserveFilter = {}): Promise<ReservePage> {
    const params: Record<string, string | number> = {}
    for (const [key, value] of Object.entries(filter)) if (value !== undefined && value !== '') params[key] = value
    const { data } = await api.get<unknown>('/finance/reserves', {
      params,
      ...requestConfig(origin),
    } as Parameters<typeof api.get>[1])
    if (!validReservePage(data)) throw new FinanceReserveContractError()
    return data
  },
  /** POST /finance/reserves/:id/reversals — plain cancellation (no edit, no replacement). */
  async cancel(
    origin: FinanceOrigin,
    reserveId: string,
    payload: CancelReservePayload,
  ): Promise<ReserveCancellationReceipt> {
    const { data } = await api.post<unknown>(
      `/finance/reserves/${encodeURIComponent(reserveId)}/reversals`,
      payload,
      requestConfig(origin) as Parameters<typeof api.post>[2],
    )
    if (
      !validReserveCancellationReceipt(data) ||
      data.id !== payload.id ||
      data.reserveId !== reserveId
    )
      throw new FinanceReserveContractError()
    return data
  },
}
