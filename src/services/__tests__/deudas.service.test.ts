// DeudasService — fiado/apartado (solo un producto/cantidad por deuda).
// Contrato verificado literalmente contra doc/api-contract-for-frontend.md
// §10 (ver odd/tasks/ajustes-ux-incidencias-fiado.md).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DeudasService from '../deudas.service'
import api from '../api'

vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))

const DEUDA_ID = '70000000-0000-4000-8000-000000000001'
const CUOTA_ID = '90000000-0000-4000-8000-000000000001'

const deuda = {
  id: DEUDA_ID,
  type: 'apartado' as const,
  deudorId: '60000000-0000-4000-8000-000000000001',
  productId: '30000000-0000-4000-8000-000000000003',
  contextId: 'bazar-local',
  cantidad: 1,
  totalMinor: 65000,
  status: 'pendiente' as const,
  unitCostMinor: null,
  saldadaAt: null,
  createdByMemberId: 'bf030001-0000-4000-8000-000000000001',
  createdAt: '2026-09-23T12:00:00.000Z',
  abonos: [],
  cuotasPlaneadas: [],
}

const cuota = {
  id: CUOTA_ID,
  deudaId: DEUDA_ID,
  contextId: 'bazar-local',
  fechaEsperada: '2026-10-15',
  montoEsperadoMinor: 32500,
  createdAt: '2026-09-23T12:00:00.000Z',
}

beforeEach(() => vi.clearAllMocks())

describe('DeudasService.createDeuda', () => {
  it('hace POST /deudas con el payload tal cual (deudor nuevo inline, abonoInicialMinor explícito) y devuelve la deuda', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: deuda })
    const payload = {
      type: 'apartado' as const,
      productId: deuda.productId,
      cantidad: 1,
      deudor: { nombre: 'Lucía', telefono: '555-0001', notas: 'Pasa el sábado' },
      abonoInicialMinor: 0,
    }

    expect(await DeudasService.createDeuda(payload)).toEqual(deuda)
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/deudas', payload)
  })

  it('también manda deudorId cuando el deudor ya existe, y cuotasPlaneadas cuando se pasan', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: deuda })
    const payload = {
      type: 'fiado' as const,
      productId: deuda.productId,
      cantidad: 2,
      deudorId: deuda.deudorId,
      abonoInicialMinor: 20000,
      cuotasPlaneadas: [{ fechaEsperada: '2026-10-15', montoEsperadoMinor: 32500 }],
    }

    await DeudasService.createDeuda(payload)

    expect(api.post).toHaveBeenCalledExactlyOnceWith('/deudas', payload)
  })

  it.each([400, 401, 403])('propaga el %i', async (status) => {
    vi.mocked(api.post).mockRejectedValue({ response: { status } })
    await expect(DeudasService.createDeuda({ type: 'fiado', productId: 'p', cantidad: 1, deudorId: 'd', abonoInicialMinor: 0 }))
      .rejects.toMatchObject({ response: { status } })
  })
})

describe('DeudasService.listDeudas', () => {
  it('hace GET /deudas con los params tal cual y devuelve items/total/page/limit', async () => {
    const response = { items: [deuda], total: 1, page: 1, limit: 20 }
    vi.mocked(api.get).mockResolvedValue({ data: response })

    const result = await DeudasService.listDeudas({ status: 'pendiente', orderBy: 'saldoPendiente', atrasado: true })

    expect(result).toEqual(response)
    expect(api.get).toHaveBeenCalledExactlyOnceWith('/deudas', { params: { status: 'pendiente', orderBy: 'saldoPendiente', atrasado: true } })
  })

  it('sin params, manda un objeto vacío (defaults del servidor)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { items: [], total: 0, page: 1, limit: 20 } })
    await DeudasService.listDeudas()
    expect(api.get).toHaveBeenCalledExactlyOnceWith('/deudas', { params: {} })
  })
})

describe('DeudasService.getDeuda', () => {
  it('hace GET /deudas/:id y devuelve la deuda', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: deuda })
    expect(await DeudasService.getDeuda(DEUDA_ID)).toEqual(deuda)
    expect(api.get).toHaveBeenCalledExactlyOnceWith(`/deudas/${DEUDA_ID}`)
  })
})

describe('DeudasService.createCuota', () => {
  it('hace POST /deudas/:id/cuotas con fechaEsperada/montoEsperadoMinor y devuelve la cuota', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: cuota })
    const payload = { fechaEsperada: cuota.fechaEsperada, montoEsperadoMinor: cuota.montoEsperadoMinor }

    expect(await DeudasService.createCuota(DEUDA_ID, payload)).toEqual(cuota)
    expect(api.post).toHaveBeenCalledExactlyOnceWith(`/deudas/${DEUDA_ID}/cuotas`, payload)
  })
})

describe('DeudasService.updateCuota', () => {
  it('hace PATCH /deudas/:id/cuotas/:cuotaId con solo los campos que se pasan', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { ...cuota, montoEsperadoMinor: 40000 } })

    const result = await DeudasService.updateCuota(DEUDA_ID, CUOTA_ID, { montoEsperadoMinor: 40000 })

    expect(result.montoEsperadoMinor).toBe(40000)
    expect(api.patch).toHaveBeenCalledExactlyOnceWith(`/deudas/${DEUDA_ID}/cuotas/${CUOTA_ID}`, { montoEsperadoMinor: 40000 })
  })
})

describe('DeudasService.deleteCuota', () => {
  it('hace DELETE /deudas/:id/cuotas/:cuotaId y devuelve la cuota eliminada', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: cuota })

    expect(await DeudasService.deleteCuota(DEUDA_ID, CUOTA_ID)).toEqual(cuota)
    expect(api.delete).toHaveBeenCalledExactlyOnceWith(`/deudas/${DEUDA_ID}/cuotas/${CUOTA_ID}`)
  })
})

describe('DeudasService.createAbono', () => {
  it('hace POST /deudas/:id/abonos con el monto y la nota, y devuelve la DEUDA completa (no el abono suelto)', async () => {
    const updated = {
      ...deuda,
      abonos: [{ id: 'a-1', deudaId: DEUDA_ID, contextId: 'bazar-local', montoMinor: 20000, receivedByMemberId: 'm-1', receivedAt: '2026-09-23T13:00:00.000Z', nota: 'Primer abono' }],
      deudor: { id: deuda.deudorId, nombre: 'Lucía', telefono: null, notas: null, contextId: 'bazar-local', createdAt: '2026-09-23T12:00:00.000Z' },
    }
    vi.mocked(api.post).mockResolvedValue({ data: updated })

    const result = await DeudasService.createAbono(DEUDA_ID, { montoMinor: 20000, nota: 'Primer abono' })

    expect(result).toEqual(updated)
    expect(api.post).toHaveBeenCalledExactlyOnceWith(`/deudas/${DEUDA_ID}/abonos`, { montoMinor: 20000, nota: 'Primer abono' })
  })

  it('nota es opcional', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: deuda })
    await DeudasService.createAbono(DEUDA_ID, { montoMinor: 5000 })
    expect(api.post).toHaveBeenCalledExactlyOnceWith(`/deudas/${DEUDA_ID}/abonos`, { montoMinor: 5000 })
  })

  it.each([400, 401, 403, 404])('propaga el %i (400 incluye monto mayor al saldo)', async (status) => {
    vi.mocked(api.post).mockRejectedValue({ response: { status } })
    await expect(DeudasService.createAbono(DEUDA_ID, { montoMinor: 1 })).rejects.toMatchObject({ response: { status } })
  })
})
