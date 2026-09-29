import api from './api'
import type { CreateAbonoPayload, CreateDeudaPayload, Deuda } from '@/types/deuda.types'

const DeudasService = {
  /**
   * POST /deudas — solo socios. Un solo producto/cantidad por deuda (nunca un
   * carrito); exactamente uno de `deudorId`/`deudor` en el payload. Descuenta
   * stock de inmediato en el servidor. Responde 201 con la deuda y
   * `abonos: []`, SIN `deudor` anidado.
   */
  async createDeuda(payload: CreateDeudaPayload): Promise<Deuda> {
    const { data } = await api.post<Deuda>('/deudas', payload)
    return data
  },

  /**
   * POST /deudas/:id/abonos — cualquier Member activo (no exige ser socio).
   * Responde 201 con la DEUDA completa actualizada (con `abonos` y
   * `deudor`), no el abono suelto.
   */
  async createAbono(deudaId: string, payload: CreateAbonoPayload): Promise<Deuda> {
    const { data } = await api.post<Deuda>(`/deudas/${deudaId}/abonos`, payload)
    return data
  },
}

export default DeudasService
