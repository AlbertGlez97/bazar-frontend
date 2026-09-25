// Tests de SalesService — contrato real de doc/api-contract-for-frontend.md
// §1.6 y §6 (Sales).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SalesService from '../sales.service'
import { UnexpectedSaleResponseError } from '../sale-errors'
import api from '../api'
import type { CreateSalePayload, Sale } from '@/types/sale.types'

vi.mock('../api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

const payload: CreateSalePayload = {
  id: '0190a5f0-7c3e-7000-8000-000000000001',
  memberId: '10000000-0000-4000-8000-000000000003',
  deviceId: '20000000-0000-4000-8000-000000000001',
  occurredAt: '2026-09-23T12:00:00.000Z',
  currency: 'MXN',
  cashReceivedMinor: 250000,
  items: [{ productId: '30000000-0000-4000-8000-000000000001', quantity: 1, unitPriceMinor: 125000 }],
}

const completed: Sale = {
  id: payload.id,
  memberId: payload.memberId,
  deviceId: payload.deviceId,
  occurredAt: payload.occurredAt,
  receivedAt: '2026-09-23T12:00:01.000Z',
  currency: 'MXN',
  status: 'completada',
  totalMinor: 125000,
  cashReceivedMinor: 250000,
  changeMinor: 125000,
  conflictReason: null,
  conflictDetectedAt: null,
  items: [],
}

const rejected: Sale = {
  ...completed,
  status: 'rechazada_por_conflicto',
  totalMinor: null,
  changeMinor: null,
  conflictReason: 'stock insuficiente al sincronizar: producto p, solicitado 1, disponible 0',
  conflictDetectedAt: '2026-09-23T12:00:02.000Z',
}

describe('SalesService.createSale', () => {
  beforeEach(() => vi.clearAllMocks())

  it('hace POST /sales con el cuerpo idéntico y los headers de la propia venta', async () => {
    vi.mocked(api.post).mockResolvedValue({ status: 201, data: completed })

    await SalesService.createSale(payload)

    expect(api.post).toHaveBeenCalledExactlyOnceWith('/sales', payload, {
      headers: { 'x-member-id': payload.memberId, 'x-device-id': payload.deviceId },
    })
  })

  it('201 completada: outcome completed, httpStatus 201, replayed false', async () => {
    vi.mocked(api.post).mockResolvedValue({ status: 201, data: completed })

    const result = await SalesService.createSale(payload)

    expect(result).toEqual({ outcome: 'completed', httpStatus: 201, replayed: false, sale: completed })
  })

  it('201 rechazada_por_conflicto: outcome conflict (NUNCA completed aunque sea 2xx)', async () => {
    vi.mocked(api.post).mockResolvedValue({ status: 201, data: rejected })

    const result = await SalesService.createSale(payload)

    expect(result.outcome).toBe('conflict')
    expect(result.httpStatus).toBe(201)
    expect(result.sale.status).toBe('rechazada_por_conflicto')
    expect(result.sale.totalMinor).toBeNull()
  })

  it('200 (reenvío idempotente) de una completada: completed con replayed true', async () => {
    vi.mocked(api.post).mockResolvedValue({ status: 200, data: completed })

    expect(await SalesService.createSale(payload)).toEqual({
      outcome: 'completed', httpStatus: 200, replayed: true, sale: completed,
    })
  })

  it('200 (reenvío idempotente) de una rechazada: conflict con replayed true', async () => {
    vi.mocked(api.post).mockResolvedValue({ status: 200, data: rejected })

    expect(await SalesService.createSale(payload)).toEqual({
      outcome: 'conflict', httpStatus: 200, replayed: true, sale: rejected,
    })
  })

  it('un 2xx cuyo cuerpo no es una venta (HTML de un portal cautivo) lanza UnexpectedSaleResponseError', async () => {
    vi.mocked(api.post).mockResolvedValue({ status: 200, data: '<html>login wifi</html>' })
    await expect(SalesService.createSale(payload)).rejects.toBeInstanceOf(UnexpectedSaleResponseError)
  })

  it('un 2xx con un status desconocido también lanza (no se asume éxito)', async () => {
    vi.mocked(api.post).mockResolvedValue({ status: 201, data: { ...completed, status: 'otra_cosa' } })
    await expect(SalesService.createSale(payload)).rejects.toBeInstanceOf(UnexpectedSaleResponseError)
  })

  it('un 2xx de OTRA venta (id distinto) no se acepta como confirmación', async () => {
    vi.mocked(api.post).mockResolvedValue({ status: 201, data: { ...completed, id: 'otro-id' } })
    await expect(SalesService.createSale(payload)).rejects.toBeInstanceOf(UnexpectedSaleResponseError)
  })

  it('propaga tal cual los errores de Axios (el llamador los clasifica)', async () => {
    const error = { isAxiosError: true, response: { status: 400, data: { message: 'x' } } }
    vi.mocked(api.post).mockRejectedValue(error)
    await expect(SalesService.createSale(payload)).rejects.toBe(error)
  })
})

describe('SalesService.getSale', () => {
  beforeEach(() => vi.clearAllMocks())

  it('hace GET /sales/:id y devuelve la venta', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: completed })
    expect(await SalesService.getSale('abc')).toEqual(completed)
    expect(api.get).toHaveBeenCalledExactlyOnceWith('/sales/abc')
  })

  it('404 (nunca llegó al servidor) devuelve null', async () => {
    vi.mocked(api.get).mockRejectedValue({ isAxiosError: true, response: { status: 404, data: { message: 'Not Found' } } })
    expect(await SalesService.getSale('abc')).toBeNull()
  })

  it('otros errores se propagan', async () => {
    const error = { isAxiosError: true, response: { status: 500 } }
    vi.mocked(api.get).mockRejectedValue(error)
    await expect(SalesService.getSale('abc')).rejects.toBe(error)
  })
})

describe('SalesService.listSales', () => {
  beforeEach(() => vi.clearAllMocks())

  it('hace GET /sales con status, search, sort, page y limit', async () => {
    const response = { items: [rejected], total: 1, page: 1, limit: 20 }
    vi.mocked(api.get).mockResolvedValue({ data: response })

    const params = { status: 'rechazada_por_conflicto', search: 'Ana', sort: 'asc', page: 2, limit: 50 } as const
    expect(await SalesService.listSales(params)).toEqual(response)
    expect(api.get).toHaveBeenCalledExactlyOnceWith('/sales', { params })
  })

  it('funciona sin params', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { items: [], total: 0, page: 1, limit: 20 } })
    await SalesService.listSales()
    expect(api.get).toHaveBeenCalledExactlyOnceWith('/sales', { params: {} })
  })
})
