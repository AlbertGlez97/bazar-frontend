import api from './api'
import type {
  CreateAbonoPayload,
  CreateDeudaPayload,
  CuotaPlaneada,
  CuotaPlaneadaInput,
  Deuda,
  DeudaListParams,
  DeudaListResponse,
  UpdateCuotaPlaneadaPayload,
} from '@/types/deuda.types'

const DeudasService = {
  /**
   * POST /deudas — solo socios. Un solo producto/cantidad por deuda (nunca un
   * carrito); exactamente uno de `deudorId`/`deudor` en el payload.
   * `abonoInicialMinor` (BE-15, requerido) crea el primer abono en la MISMA
   * transacción atómica — nunca una llamada aparte a `createAbono`. Descuenta
   * stock de inmediato en el servidor. Responde 201 con la deuda, `abonos`
   * (vacío o con el abono inicial) y `cuotasPlaneadas`, SIN `deudor` anidado.
   */
  async createDeuda(payload: CreateDeudaPayload): Promise<Deuda> {
    const { data } = await api.post<Deuda>('/deudas', payload)
    return data
  },

  /**
   * POST /deudas/:id/abonos — cualquier Member activo (no exige ser socio).
   * Responde 201 con la DEUDA completa actualizada (con `abonos` y
   * `deudor`), no el abono suelto. Se usa para abonos POSTERIORES a la
   * creación (p.ej. desde el detalle de la vista de Deudas); el abono inicial
   * ya va dentro de `createDeuda`.
   */
  async createAbono(deudaId: string, payload: CreateAbonoPayload): Promise<Deuda> {
    const { data } = await api.post<Deuda>(`/deudas/${deudaId}/abonos`, payload)
    return data
  },

  /**
   * GET /deudas — solo socios. `items` trae `abonos`, `deudor` y
   * `cuotasPlaneadas`. BE-15: `orderBy=saldoPendiente|cuotaVencida` y
   * `atrasado` se calculan en el servidor.
   */
  async listDeudas(params: DeudaListParams = {}): Promise<DeudaListResponse> {
    const { data } = await api.get<DeudaListResponse>('/deudas', { params })
    return data
  },

  /** GET /deudas/:id — solo socios. Una deuda con `abonos`, `deudor` y `cuotasPlaneadas`. */
  async getDeuda(id: string): Promise<Deuda> {
    const { data } = await api.get<Deuda>(`/deudas/${id}`)
    return data
  },

  /**
   * POST /deudas/:id/cuotas (BE-15) — solo socios. Agrega una cuota planeada
   * (calendario informativo, nunca afecta el saldo/`status`). Responde 201
   * con la cuota creada.
   */
  async createCuota(deudaId: string, payload: CuotaPlaneadaInput): Promise<CuotaPlaneada> {
    const { data } = await api.post<CuotaPlaneada>(`/deudas/${deudaId}/cuotas`, payload)
    return data
  },

  /**
   * PATCH /deudas/:id/cuotas/:cuotaId (BE-15) — solo socios. Edición parcial
   * (ambos campos opcionales; un body vacío es un no-op válido). Responde
   * 200 con la cuota actualizada.
   */
  async updateCuota(deudaId: string, cuotaId: string, payload: UpdateCuotaPlaneadaPayload): Promise<CuotaPlaneada> {
    const { data } = await api.patch<CuotaPlaneada>(`/deudas/${deudaId}/cuotas/${cuotaId}`, payload)
    return data
  },

  /**
   * DELETE /deudas/:id/cuotas/:cuotaId (BE-15) — solo socios. Borrado físico
   * (no lleva historial). Responde 200 con la cuota eliminada.
   */
  async deleteCuota(deudaId: string, cuotaId: string): Promise<CuotaPlaneada> {
    const { data } = await api.delete<CuotaPlaneada>(`/deudas/${deudaId}/cuotas/${cuotaId}`)
    return data
  },
}

export default DeudasService
