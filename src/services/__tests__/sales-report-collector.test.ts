import { describe, expect, it, vi } from 'vitest'
import { collectSalesInRange, DEFAULT_MAX_PAGES } from '../sales-report-collector'
import type { Sale, SaleListParams, SaleListResponse } from '@/types/sale.types'

// Rango normalizado, como lo devuelve sales-by-period (UTC).
const RANGE = { from: '2026-09-24T06:00:00.000Z', to: '2026-09-25T05:59:59.999Z' }

let seq = 0
function sale(receivedAt: string, overrides: Partial<Sale> = {}): Sale {
  seq += 1
  return {
    id: `sale-${String(seq).padStart(4, '0')}`,
    memberId: 'm-1',
    deviceId: 'd-1',
    occurredAt: receivedAt,
    receivedAt,
    currency: 'MXN',
    status: 'completada',
    totalMinor: 1000,
    cashReceivedMinor: 1000,
    changeMinor: 0,
    conflictReason: null,
    conflictDetectedAt: null,
    items: [],
    ...overrides,
  }
}

/** Ventas dentro del rango, espaciadas un minuto hacia atrás desde `to` (desc). */
function inRange(count: number, startMinutesBeforeTo = 0): Sale[] {
  const to = Date.parse(RANGE.to)
  return Array.from({ length: count }, (_, i) =>
    sale(new Date(to - (startMinutesBeforeTo + i) * 60_000).toISOString()),
  )
}

/** Un `listSales` falso que se comporta como la API: `desc` por receivedAt, paginado por offset. */
function fakeList(all: Sale[]) {
  const sorted = [...all].sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt))
  return vi.fn(async (params: SaleListParams = {}): Promise<SaleListResponse> => {
    const page = params.page ?? 1
    const limit = params.limit ?? 20
    return { items: sorted.slice((page - 1) * limit, page * limit), total: sorted.length, page, limit }
  })
}

describe('collectSalesInRange', () => {
  it('asks for completed sales, newest first, 100 per page, from page 1', async () => {
    const listSales = fakeList(inRange(2))
    await collectSalesInRange(RANGE, { listSales })
    expect(listSales).toHaveBeenCalledTimes(1)
    expect(listSales).toHaveBeenCalledWith({ status: 'completada', sort: 'desc', page: 1, limit: 100 })
  })

  it('returns an empty, non-truncated result when there are no sales at all', async () => {
    const listSales = fakeList([])
    const result = await collectSalesInRange(RANGE, { listSales })
    expect(result).toEqual({ sales: [], truncated: false, pagesFetched: 1 })
  })

  it('collects every sale of the range across pages and stops when the list ends', async () => {
    const listSales = fakeList(inRange(7))
    const result = await collectSalesInRange(RANGE, { listSales, pageSize: 3 })
    expect(result.sales).toHaveLength(7)
    expect(result.truncated).toBe(false)
    expect(result.pagesFetched).toBe(3)
    expect(listSales).toHaveBeenCalledTimes(3)
  })

  it('stops as soon as a page reaches sales older than `from` (does not read the whole history)', async () => {
    const older = Array.from({ length: 30 }, (_, i) =>
      sale(new Date(Date.parse(RANGE.from) - (i + 1) * 3_600_000).toISOString()),
    )
    const listSales = fakeList([...inRange(4), ...older])
    const result = await collectSalesInRange(RANGE, { listSales, pageSize: 3 })
    // Página 1: 3 del rango. Página 2: 1 del rango + 2 anteriores -> se detiene.
    expect(listSales).toHaveBeenCalledTimes(2)
    expect(result.sales).toHaveLength(4)
    expect(result.truncated).toBe(false)
  })

  it('keeps the boundaries inclusive and drops one millisecond outside on each side', async () => {
    const at = (iso: string) => sale(iso)
    const edgeFrom = at(RANGE.from)
    const edgeTo = at(RANGE.to)
    const justBefore = at('2026-09-24T05:59:59.999Z')
    const justAfter = at('2026-09-25T06:00:00.000Z')
    const listSales = fakeList([justAfter, edgeTo, edgeFrom, justBefore])
    const result = await collectSalesInRange(RANGE, { listSales })
    expect(result.sales.map((s) => s.id).sort()).toEqual([edgeFrom.id, edgeTo.id].sort())
  })

  it('skips sales newer than `to` on the way down without stopping', async () => {
    const newer = Array.from({ length: 5 }, (_, i) =>
      sale(new Date(Date.parse(RANGE.to) + (i + 1) * 3_600_000).toISOString()),
    )
    const listSales = fakeList([...newer, ...inRange(2)])
    const result = await collectSalesInRange(RANGE, { listSales, pageSize: 3 })
    expect(result.sales).toHaveLength(2)
    expect(result.sales.every((s) => Date.parse(s.receivedAt) <= Date.parse(RANGE.to))).toBe(true)
  })

  it('ignores sales that are not completed even if the server let one through', async () => {
    const rejected = sale('2026-09-24T18:00:00.000Z', { status: 'rechazada_por_conflicto', totalMinor: null, changeMinor: null })
    const ok = sale('2026-09-24T17:00:00.000Z')
    const result = await collectSalesInRange(RANGE, { listSales: fakeList([rejected, ok]) })
    expect(result.sales.map((s) => s.id)).toEqual([ok.id])
  })

  it('dedupes a sale that shows up on two pages (offset pagination is not a snapshot)', async () => {
    const [a, b, c, d] = inRange(4)
    // Entre una página y la otra llegó una venta nueva y `c` se desplazó a la página 2.
    const pages: Sale[][] = [[a, b, c], [c, d]]
    const listSales = vi.fn(async (params: SaleListParams = {}): Promise<SaleListResponse> => ({
      items: pages[(params.page ?? 1) - 1] ?? [], total: 5, page: params.page ?? 1, limit: 3,
    }))
    const result = await collectSalesInRange(RANGE, { listSales, pageSize: 3 })
    expect(result.sales.map((s) => s.id)).toEqual([a.id, b.id, c.id, d.id])
  })

  it('stops at the page cap and reports truncated: true', async () => {
    const listSales = fakeList(inRange(20))
    const result = await collectSalesInRange(RANGE, { listSales, pageSize: 3, maxPages: 2 })
    expect(listSales).toHaveBeenCalledTimes(2)
    expect(result.sales).toHaveLength(6)
    expect(result.truncated).toBe(true)
    expect(result.pagesFetched).toBe(2)
  })

  it('is not truncated when the cap lands exactly on the last page', async () => {
    const listSales = fakeList(inRange(6))
    const result = await collectSalesInRange(RANGE, { listSales, pageSize: 3, maxPages: 2 })
    expect(result.sales).toHaveLength(6)
    expect(result.truncated).toBe(false)
  })

  it('is not truncated when the cap lands on the page that reaches older sales', async () => {
    const older = sale('2026-09-20T12:00:00.000Z')
    const listSales = fakeList([...inRange(4), older])
    const result = await collectSalesInRange(RANGE, { listSales, pageSize: 3, maxPages: 2 })
    expect(result.sales).toHaveLength(4)
    expect(result.truncated).toBe(false)
  })

  it('defaults to a 100-page safety cap (10,000 sales)', () => {
    expect(DEFAULT_MAX_PAGES).toBe(100)
  })

  it('propagates a request failure instead of returning partial data as if it were complete', async () => {
    const failure = new Error('network')
    const listSales = vi.fn().mockResolvedValueOnce({ items: inRange(3), total: 9, page: 1, limit: 3 }).mockRejectedValueOnce(failure)
    await expect(collectSalesInRange(RANGE, { listSales, pageSize: 3 })).rejects.toBe(failure)
  })
})
