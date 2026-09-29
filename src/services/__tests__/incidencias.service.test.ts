// IncidenciasService — módulo de Incidencias (solo socios): listar, ver el
// detalle con la venta anidada, y resolver. Contrato verificado literalmente
// contra doc/api-contract-for-frontend.md §7 (ver odd/tasks/ajustes-ux-incidencias-fiado.md).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import IncidenciasService from '../incidencias.service'
import api from '../api'

vi.mock('../api', () => ({ default: { get: vi.fn(), patch: vi.fn() } }))

const ID = '50000000-0000-4000-8000-000000000001'

const incidencia = {
  id: ID,
  saleId: '40000000-0000-4000-8000-000000000002',
  contextId: 'bazar-local',
  type: 'conflicto_stock' as const,
  reason: 'stock insuficiente al sincronizar: producto 30000000-0000-4000-8000-000000000001, solicitado 1, disponible 0',
  detectedAt: '2026-09-23T12:00:02.000Z',
  resolutionStatus: 'pendiente' as const,
  resolvedByMemberId: null,
  resolvedAt: null,
  resolutionNotes: null,
}

beforeEach(() => vi.clearAllMocks())

describe('IncidenciasService.listIncidencias', () => {
  it('hace GET /incidencias sin parámetros por defecto y devuelve la página tal cual', async () => {
    const response = { items: [incidencia], total: 1, page: 1, limit: 20 }
    vi.mocked(api.get).mockResolvedValue({ data: response })
    expect(await IncidenciasService.listIncidencias()).toEqual(response)
    expect(api.get).toHaveBeenCalledExactlyOnceWith('/incidencias', { params: {} })
  })

  it('manda los filtros tal cual (type, resolutionStatus, search, sort, page, limit)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { items: [], total: 0, page: 2, limit: 10 } })
    const params = {
      type: 'incidencia_fecha' as const,
      resolutionStatus: 'pendiente' as const,
      search: 'Ana',
      sort: 'asc' as const,
      page: 2,
      limit: 10,
    }
    await IncidenciasService.listIncidencias(params)
    expect(api.get).toHaveBeenCalledExactlyOnceWith('/incidencias', { params })
  })

  it.each([400, 401, 403])('propaga el %i', async (status) => {
    vi.mocked(api.get).mockRejectedValue({ response: { status } })
    await expect(IncidenciasService.listIncidencias()).rejects.toMatchObject({ response: { status } })
  })
})

describe('IncidenciasService.getIncidencia', () => {
  it('hace GET /incidencias/:id y devuelve la incidencia con su venta anidada', async () => {
    const withSale = { ...incidencia, sale: { id: 'sale-1', items: [] } }
    vi.mocked(api.get).mockResolvedValue({ data: withSale })
    expect(await IncidenciasService.getIncidencia(ID)).toEqual(withSale)
    expect(api.get).toHaveBeenCalledExactlyOnceWith(`/incidencias/${ID}`)
  })

  it.each([400, 403, 404])('propaga el %i', async (status) => {
    vi.mocked(api.get).mockRejectedValue({ response: { status } })
    await expect(IncidenciasService.getIncidencia(ID)).rejects.toMatchObject({ response: { status } })
  })
})

describe('IncidenciasService.resolverIncidencia', () => {
  it('hace PATCH /incidencias/:id/resolver (ruta en español) con las notas y devuelve la incidencia resuelta', async () => {
    const resolved = { ...incidencia, resolutionStatus: 'resuelta', resolvedByMemberId: 'm-1', resolvedAt: '2026-09-23T14:00:00.000Z', resolutionNotes: 'Se acordó con el cliente.' }
    vi.mocked(api.patch).mockResolvedValue({ data: resolved })
    expect(await IncidenciasService.resolverIncidencia(ID, 'Se acordó con el cliente.')).toEqual(resolved)
    expect(api.patch).toHaveBeenCalledExactlyOnceWith(`/incidencias/${ID}/resolver`, { resolutionNotes: 'Se acordó con el cliente.' })
  })

  it.each([400, 403, 404, 409])('propaga el %i (409 = ya estaba resuelta)', async (status) => {
    vi.mocked(api.patch).mockRejectedValue({ response: { status } })
    await expect(IncidenciasService.resolverIncidencia(ID, 'x')).rejects.toMatchObject({ response: { status } })
  })
})
