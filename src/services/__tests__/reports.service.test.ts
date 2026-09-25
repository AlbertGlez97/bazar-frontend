// Tests de ReportsService — contrato de doc/api-contract-for-frontend.md §9.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReportsService from '../reports.service'
import api from '../api'
import type { SalesByMemberReport, SalesByPeriodReport } from '@/types/report.types'

vi.mock('../api', () => ({
  default: { get: vi.fn() },
}))

const period: SalesByPeriodReport = {
  from: '2026-09-24T06:00:00.000Z',
  to: '2026-09-25T05:59:59.999Z',
  totalSoldMinor: 210000,
  saleCount: 1,
}

const byMember: SalesByMemberReport = {
  from: period.from,
  to: period.to,
  items: [{ memberId: 'm-1', memberName: 'Carlos', role: 'colaborador', totalSoldMinor: 210000 }],
}

beforeEach(() => {
  vi.mocked(api.get).mockReset()
})

describe('ReportsService.getSalesByPeriod', () => {
  it('GETs /reports/sales-by-period with from and to as query params', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: period })
    const result = await ReportsService.getSalesByPeriod({ from: '2026-09-24', to: '2026-09-24' })
    expect(api.get).toHaveBeenCalledWith('/reports/sales-by-period', {
      params: { from: '2026-09-24', to: '2026-09-24' },
    })
    expect(result).toEqual(period)
  })

  it('propagates request errors untouched', async () => {
    const failure = Object.assign(new Error('Forbidden'), { response: { status: 403 } })
    vi.mocked(api.get).mockRejectedValue(failure)
    await expect(ReportsService.getSalesByPeriod({ from: 'a', to: 'b' })).rejects.toBe(failure)
  })
})

describe('ReportsService.getSalesByMember', () => {
  it('GETs /reports/sales-by-member with from and to as query params', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: byMember })
    const result = await ReportsService.getSalesByMember({ from: '2026-09-24', to: '2026-09-24' })
    expect(api.get).toHaveBeenCalledWith('/reports/sales-by-member', {
      params: { from: '2026-09-24', to: '2026-09-24' },
    })
    expect(result).toEqual(byMember)
  })
})
