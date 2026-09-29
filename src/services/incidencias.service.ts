import api from './api'
import type {
  Incidencia,
  IncidenciaListParams,
  IncidenciaListResponse,
  IncidenciaWithSale,
} from '@/types/incidencia.types'

const IncidenciasService = {
  /**
   * GET /incidencias — solo socios. Los items NO incluyen la venta.
   * `resolutionStatus` ausente lista todas; `sort` por `detectedAt` (default
   * `desc` en el servidor, no se manda por defecto aquí).
   */
  async listIncidencias(params: IncidenciaListParams = {}): Promise<IncidenciaListResponse> {
    const { data } = await api.get<IncidenciaListResponse>('/incidencias', { params })
    return data
  },

  /**
   * GET /incidencias/:id — la incidencia MÁS su venta anidada (con `items`).
   * Solo aquí se expone la venta; la lista nunca la trae.
   */
  async getIncidencia(id: string): Promise<IncidenciaWithSale> {
    const { data } = await api.get<IncidenciaWithSale>(`/incidencias/${id}`)
    return data
  },

  /**
   * PATCH /incidencias/:id/resolver — ruta en español, no `/resolve`. El
   * resolutor es siempre `x-member-id`; nunca se manda en el cuerpo. 409 si
   * ya estaba resuelta (no existe "des-resolver").
   */
  async resolverIncidencia(id: string, resolutionNotes: string): Promise<Incidencia> {
    const { data } = await api.patch<Incidencia>(`/incidencias/${id}/resolver`, { resolutionNotes })
    return data
  },
}

export default IncidenciasService
