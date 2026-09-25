import api from './api'
import { UnexpectedSaleResponseError } from './sale-errors'
import type {
  CreateSalePayload,
  CreateSaleResult,
  Sale,
  SaleListParams,
  SaleListResponse,
} from '@/types/sale.types'

function isSale(value: unknown): value is Sale {
  const v = value as Partial<Sale> | null
  return !!v && typeof v === 'object' && typeof v.id === 'string'
    && (v.status === 'completada' || v.status === 'rechazada_por_conflicto')
}

const SalesService = {
  /**
   * POST /sales — cualquier Member activo con dispositivo autorizado.
   *
   * Contrato §1.6: 201 con `status: 'rechazada_por_conflicto'` NO es un error
   * HTTP ni una venta cobrada; por eso el resultado discrimina por
   * `body.status` (`outcome`) y expone además el código HTTP (`httpStatus`;
   * 200 = reenvío idempotente de un id ya guardado). Un 2xx cuyo cuerpo no es
   * una venta de ESTE id lanza `UnexpectedSaleResponseError`.
   *
   * Los headers `x-member-id` / `x-device-id` se toman de la propia venta
   * (deben coincidir con el cuerpo o el servidor responde 403) y no de la
   * sesión actual, que puede ser de otra persona cuando se sincroniza la cola.
   * Los errores de Axios se propagan tal cual: clasifícalos con `classifySaleError`.
   */
  async createSale(payload: CreateSalePayload): Promise<CreateSaleResult> {
    const response = await api.post<unknown>('/sales', payload, {
      headers: { 'x-member-id': payload.memberId, 'x-device-id': payload.deviceId },
    })

    if (!isSale(response.data) || response.data.id !== payload.id) {
      throw new UnexpectedSaleResponseError(response.status)
    }

    return {
      outcome: response.data.status === 'completada' ? 'completed' : 'conflict',
      httpStatus: response.status,
      replayed: response.status === 200,
      sale: response.data,
    }
  },

  /**
   * GET /sales/:id — confirma lo persistido tras una respuesta perdida.
   * Devuelve `null` si el servidor nunca la recibió (404).
   */
  async getSale(id: string): Promise<Sale | null> {
    try {
      const { data } = await api.get<Sale>(`/sales/${id}`)
      return data
    } catch (cause) {
      if ((cause as { response?: { status?: number } } | null)?.response?.status === 404) return null
      throw cause
    }
  },

  /**
   * GET /sales — solo socios ("movimientos"). Paginado `{ items, total, page,
   * limit }`, orden por `receivedAt`. OJO: NO existe filtro por fecha (solo
   * `status`, `search` por nombre de vendedor, `sort`, `page`, `limit`), así
   * que un rango de fechas se resuelve paginando o con /reports.
   */
  async listSales(params: SaleListParams = {}): Promise<SaleListResponse> {
    const { data } = await api.get<SaleListResponse>('/sales', { params })
    return data
  },
}

export default SalesService
