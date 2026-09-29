// DeudasService — fiado/apartado (solo un producto/cantidad por deuda).
// Contrato verificado literalmente contra doc/api-contract-for-frontend.md
// §10 (ver odd/tasks/ajustes-ux-incidencias-fiado.md).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DeudasService from '../deudas.service'
import api from '../api'

vi.mock('../api', () => ({ default: { post: vi.fn() } }))

const DEUDA_ID = '70000000-0000-4000-8000-000000000001'

const deuda = {
  id: DEUDA_ID,
  type: 'apartado' as const,
  deudorId: '60000000-0000-4000-8000-000000000001',
  productId: '30000000-0000-4000-8000-000000000003',
  contextId: 'bazar-local',
  cantidad: 1,
  totalMinor: 65000,
  status: 'pendiente' as const,
  createdByMemberId: 'bf030001-0000-4000-8000-000000000001',
  createdAt: '2026-09-23T12:00:00.000Z',
  abonos: [],
}

beforeEach(() => vi.clearAllMocks())

describe('DeudasService.createDeuda', () => {
  it('hace POST /deudas con el payload tal cual (deudor nuevo inline) y devuelve la deuda', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: deuda })
    const payload = {
      type: 'apartado' as const,
      productId: deuda.productId,
      cantidad: 1,
      deudor: { nombre: 'Lucía', telefono: '555-0001', notas: 'Pasa el sábado' },
    }

    expect(await DeudasService.createDeuda(payload)).toEqual(deuda)
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/deudas', payload)
  })

  it('también manda deudorId cuando el deudor ya existe', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: deuda })
    const payload = { type: 'fiado' as const, productId: deuda.productId, cantidad: 2, deudorId: deuda.deudorId }

    await DeudasService.createDeuda(payload)

    expect(api.post).toHaveBeenCalledExactlyOnceWith('/deudas', payload)
  })

  it.each([400, 401, 403])('propaga el %i', async (status) => {
    vi.mocked(api.post).mockRejectedValue({ response: { status } })
    await expect(DeudasService.createDeuda({ type: 'fiado', productId: 'p', cantidad: 1, deudorId: 'd' }))
      .rejects.toMatchObject({ response: { status } })
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
