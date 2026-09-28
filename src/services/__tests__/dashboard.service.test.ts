// Tests de DashboardService — contrato de doc/api-contract-for-frontend.md
// §"GET /api/v1/dashboard/summary".
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardService from '../dashboard.service'
import api from '../api'
import type { DashboardSummary } from '@/types/report.types'

vi.mock('../api', () => ({
  default: { get: vi.fn() },
}))

const summary: DashboardSummary = {
  ventasHoy: { totalMinor: 125000, count: 1 },
  ventasAyer: { totalMinor: 0, count: 0 },
  gananciaHoyMinor: 35000,
  lineasSinCostoHoy: 0,
  incidenciasPendientes: 0,
  deudasPendientes: { totalMinor: 0, personas: 0 },
  productosPocaExistencia: { umbral: 2, total: 0, items: [] },
}

beforeEach(() => {
  vi.mocked(api.get).mockReset()
})

describe('DashboardService.getSummary', () => {
  it('GETs /dashboard/summary without params when none are given', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: summary })
    const result = await DashboardService.getSummary()
    expect(api.get).toHaveBeenCalledWith('/dashboard/summary', { params: undefined })
    expect(result).toEqual(summary)
  })

  it('forwards "umbral" as a query param', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: summary })
    await DashboardService.getSummary({ umbral: 5 })
    expect(api.get).toHaveBeenCalledWith('/dashboard/summary', { params: { umbral: 5 } })
  })

  it('propagates request errors untouched', async () => {
    const failure = Object.assign(new Error('Forbidden'), { response: { status: 403 } })
    vi.mocked(api.get).mockRejectedValue(failure)
    await expect(DashboardService.getSummary()).rejects.toBe(failure)
  })
})
