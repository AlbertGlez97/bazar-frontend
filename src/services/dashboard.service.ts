import api from './api'
import type { DashboardSummary, DashboardSummaryQuery } from '@/types/report.types'

const DashboardService = {
  /**
   * GET /dashboard/summary — solo socios. `umbral` es el único query
   * (entero 0..100000, opcional; el servidor usa 2 si se omite): umbral de
   * stock (inclusive) para "productos con poca existencia". "Hoy" y "ayer"
   * los resuelve el servidor con el día de negocio UTC-6 actual, no se piden.
   */
  async getSummary(query?: DashboardSummaryQuery): Promise<DashboardSummary> {
    const { data } = await api.get<DashboardSummary>('/dashboard/summary', { params: query })
    return data
  },
}

export default DashboardService
