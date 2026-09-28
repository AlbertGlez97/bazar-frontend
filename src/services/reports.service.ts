import api from './api'
import type {
  ReportRangeParams,
  SalesByMemberReport,
  SalesByPeriodReport,
  SalesDetailQuery,
  SalesDetailResponse,
} from '@/types/report.types'

const ReportsService = {
  /**
   * GET /reports/sales-by-period — solo socios. `from` y `to` son OBLIGATORIOS
   * (`YYYY-MM-DD` = día de negocio UTC-6, inclusivo). Responde 200 con ceros a
   * un rango invertido: quien llama debe impedirlo (`isValidRange`). Solo
   * cuentan ventas `completada`, ancladas a `receivedAt`.
   */
  async getSalesByPeriod(params: ReportRangeParams): Promise<SalesByPeriodReport> {
    const { data } = await api.get<SalesByPeriodReport>('/reports/sales-by-period', { params })
    return data
  },

  /**
   * GET /reports/sales-by-member — mismo query. Incluye socios y colaboradores,
   * ordenado de mayor a menor; quien no vendió en el periodo no aparece.
   */
  async getSalesByMember(params: ReportRangeParams): Promise<SalesByMemberReport> {
    const { data } = await api.get<SalesByMemberReport>('/reports/sales-by-member', { params })
    return data
  },

  /**
   * GET /reports/sales-detail — solo socios. A diferencia de los dos
   * anteriores, ESTE reporte pagina (`page`/`limit`, máx. `limit: 100`, def.
   * 20): para el periodo completo hay que recorrer todas las páginas
   * (`services/sales-detail-collector.ts`). Ganancia real por par
   * (producto, vendedor), con un hueco explícito (nunca estimado) cuando
   * falta el costo de compra.
   */
  async getSalesDetail(params: SalesDetailQuery): Promise<SalesDetailResponse> {
    const { data } = await api.get<SalesDetailResponse>('/reports/sales-detail', { params })
    return data
  },
}

export default ReportsService
