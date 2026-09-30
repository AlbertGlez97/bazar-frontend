// Tests de ReportsService — contrato de doc/api-contract-for-frontend.md §9.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReportsService from '../reports.service'
import api from '../api'
import type { SalesByMemberReport, SalesByPeriodReport, SalesDetailResponse } from '@/types/report.types'

vi.mock('../api', () => ({
  default: { get: vi.fn() },
}))

const period: SalesByPeriodReport = {
  from: '2026-09-24T06:00:00.000Z',
  to: '2026-09-25T05:59:59.999Z',
  totalSoldMinor: 210000,
  saleCount: 1,
  // BE-15: sales-by-period se extendió con dos tablas de deudas y un total
  // combinado, en vez de crear un endpoint nuevo.
  abonosRecibidos: [{ fecha: '2026-09-22T15:30:00.000Z', deudor: 'Lucía', montoMinor: 20000, type: 'apartado' }],
  abonosRecibidosMinor: 20000,
  deudasLiquidadas: [{ id: 'd-1', type: 'fiado', deudor: 'Carlos', totalMinor: 65000, saldadaAt: '2026-09-23T13:00:00.000Z', gananciaMinor: 15000, gananciaDisponible: true }],
  totalIngresadoMinor: 230000,
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

const salesDetail: SalesDetailResponse = {
  items: [
    {
      productId: 'p-1',
      productName: 'Reloj',
      memberId: 'm-1',
      memberName: 'Carlos',
      units: 1,
      ingresoMinor: 125000,
      costoMinor: 90000,
      gananciaMinor: 35000,
      gananciaDisponible: true,
    },
  ],
  total: 1,
  page: 1,
  limit: 20,
  totals: { ingresoMinor: 125000, gananciaMinor: 35000, lineasSinCosto: 0 },
}

describe('ReportsService.getSalesDetail', () => {
  it('GETs /reports/sales-detail with from, to, page and limit as query params', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: salesDetail })
    const result = await ReportsService.getSalesDetail({ from: '2026-09-24', to: '2026-09-24', page: 1, limit: 100 })
    expect(api.get).toHaveBeenCalledWith('/reports/sales-detail', {
      params: { from: '2026-09-24', to: '2026-09-24', page: 1, limit: 100 },
    })
    expect(result).toEqual(salesDetail)
  })

  it('works without page/limit (server applies its own defaults)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: salesDetail })
    await ReportsService.getSalesDetail({ from: '2026-09-24', to: '2026-09-24' })
    expect(api.get).toHaveBeenCalledWith('/reports/sales-detail', {
      params: { from: '2026-09-24', to: '2026-09-24' },
    })
  })

  it('propagates request errors untouched', async () => {
    const failure = Object.assign(new Error('Forbidden'), { response: { status: 403 } })
    vi.mocked(api.get).mockRejectedValue(failure)
    await expect(ReportsService.getSalesDetail({ from: 'a', to: 'b' })).rejects.toBe(failure)
  })
})
