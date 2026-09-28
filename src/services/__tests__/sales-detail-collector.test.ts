import { describe, expect, it, vi } from 'vitest'
import { collectSalesDetail, DEFAULT_MAX_PAGES, SALES_DETAIL_PAGE_SIZE } from '../sales-detail-collector'
import type { SalesDetailQuery, SalesDetailResponse, SalesDetailRow, SalesDetailTotals } from '@/types/report.types'

const RANGE = { from: '2026-09-24', to: '2026-09-24' }

let seq = 0
function row(overrides: Partial<SalesDetailRow> = {}): SalesDetailRow {
  seq += 1
  return {
    productId: `p-${seq}`,
    productName: `Producto ${seq}`,
    memberId: 'm-1',
    memberName: 'Carlos',
    units: 1,
    ingresoMinor: 1000,
    costoMinor: 500,
    gananciaMinor: 500,
    gananciaDisponible: true,
    ...overrides,
  }
}

/** `listSalesDetail` falso: páginas fijas preparadas por el test, `total` fijo. */
function fakePages(pages: SalesDetailRow[][], total: number, totalsPerPage: SalesDetailTotals[]) {
  return vi.fn(async (query: SalesDetailQuery): Promise<SalesDetailResponse> => {
    const page = query.page ?? 1
    return {
      items: pages[page - 1] ?? [],
      total,
      page,
      limit: query.limit ?? 20,
      totals: totalsPerPage[page - 1] ?? totalsPerPage[0],
    }
  })
}

describe('collectSalesDetail', () => {
  it('asks page 1 with the default page size (100) and the given range', async () => {
    const getSalesDetail = fakePages([[row()]], 1, [{ ingresoMinor: 1000, gananciaMinor: 500, lineasSinCosto: 0 }])
    await collectSalesDetail(RANGE, { getSalesDetail })
    expect(getSalesDetail).toHaveBeenCalledTimes(1)
    expect(getSalesDetail).toHaveBeenCalledWith({ from: RANGE.from, to: RANGE.to, page: 1, limit: 100 })
  })

  it('returns an empty, non-truncated result when there are no rows', async () => {
    const getSalesDetail = fakePages([[]], 0, [{ ingresoMinor: 0, gananciaMinor: 0, lineasSinCosto: 0 }])
    const result = await collectSalesDetail(RANGE, { getSalesDetail })
    expect(result).toEqual({
      rows: [],
      totals: { ingresoMinor: 0, gananciaMinor: 0, lineasSinCosto: 0 },
      truncated: false,
      pagesFetched: 1,
    })
  })

  it('collects every row across pages and stops when the list ends', async () => {
    const rows = Array.from({ length: 7 }, () => row())
    const pages = [rows.slice(0, 3), rows.slice(3, 6), rows.slice(6, 7)]
    const totals = { ingresoMinor: 7000, gananciaMinor: 3500, lineasSinCosto: 2 }
    const getSalesDetail = fakePages(pages, 7, [totals, totals, totals])
    const result = await collectSalesDetail(RANGE, { getSalesDetail, pageSize: 3 })
    expect(result.rows).toHaveLength(7)
    expect(result.pagesFetched).toBe(3)
    expect(getSalesDetail).toHaveBeenCalledTimes(3)
    expect(result.truncated).toBe(false)
  })

  it('takes totals from the first page only, even if later pages report something else', async () => {
    const rows = Array.from({ length: 4 }, () => row())
    const pages = [rows.slice(0, 2), rows.slice(2, 4)]
    const firstTotals = { ingresoMinor: 4000, gananciaMinor: 2000, lineasSinCosto: 1 }
    const laterTotals = { ingresoMinor: 999999, gananciaMinor: 999999, lineasSinCosto: 999 }
    const getSalesDetail = fakePages(pages, 4, [firstTotals, laterTotals])
    const result = await collectSalesDetail(RANGE, { getSalesDetail, pageSize: 2 })
    expect(result.totals).toEqual(firstTotals)
  })

  it('stops at the page cap and reports truncated: true', async () => {
    const rows = Array.from({ length: 20 }, () => row())
    const pages = Array.from({ length: 7 }, (_, i) => rows.slice(i * 3, i * 3 + 3))
    const totals = { ingresoMinor: 1, gananciaMinor: 1, lineasSinCosto: 0 }
    const getSalesDetail = fakePages(pages, 20, Array(7).fill(totals))
    const result = await collectSalesDetail(RANGE, { getSalesDetail, pageSize: 3, maxPages: 2 })
    expect(getSalesDetail).toHaveBeenCalledTimes(2)
    expect(result.rows).toHaveLength(6)
    expect(result.truncated).toBe(true)
    expect(result.pagesFetched).toBe(2)
  })

  it('is not truncated when the cap lands exactly on the last page', async () => {
    const rows = Array.from({ length: 6 }, () => row())
    const pages = [rows.slice(0, 3), rows.slice(3, 6)]
    const totals = { ingresoMinor: 1, gananciaMinor: 1, lineasSinCosto: 0 }
    const getSalesDetail = fakePages(pages, 6, [totals, totals])
    const result = await collectSalesDetail(RANGE, { getSalesDetail, pageSize: 3, maxPages: 2 })
    expect(result.rows).toHaveLength(6)
    expect(result.truncated).toBe(false)
  })

  it('defaults to a 100-page / 100-per-page safety cap (10,000 rows), same order of magnitude as GET /sales', () => {
    expect(DEFAULT_MAX_PAGES).toBe(100)
    expect(SALES_DETAIL_PAGE_SIZE).toBe(100)
  })

  it('propagates a request failure instead of returning partial data as if it were complete', async () => {
    const failure = new Error('network')
    const getSalesDetail = vi.fn()
      .mockResolvedValueOnce({
        items: [row(), row(), row()],
        total: 9,
        page: 1,
        limit: 3,
        totals: { ingresoMinor: 1, gananciaMinor: 1, lineasSinCosto: 0 },
      })
      .mockRejectedValueOnce(failure)
    await expect(collectSalesDetail(RANGE, { getSalesDetail, pageSize: 3 })).rejects.toBe(failure)
  })
})
