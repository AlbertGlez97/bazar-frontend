import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/api', () => ({
  default: { get: vi.fn() },
}))

import api from '@/services/api'
import DashboardService from '@/services/dashboard.service'

const mockGet = vi.mocked(api.get)

describe('DashboardService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getFullDashboard() GET /dashboard', async () => {
    const data = { generadoEn: '2026-07-01', mesActual: {}, anual: {}, deudas: {}, ahorros: {}, topGastos: {} }
    mockGet.mockResolvedValue({ data })
    const result = await DashboardService.getFullDashboard()
    expect(mockGet).toHaveBeenCalledWith('/dashboard')
    expect(result).toEqual(data)
  })

  it('getAnnualSummary() GET /dashboard/annual/:year', async () => {
    const data = { anio: 2026, budgets: [], mesesRegistrados: 7 }
    mockGet.mockResolvedValue({ data })
    const result = await DashboardService.getAnnualSummary(2026)
    expect(mockGet).toHaveBeenCalledWith('/dashboard/annual/2026')
    expect(result).toEqual(data)
  })
})
