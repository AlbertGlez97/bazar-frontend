import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/api', () => ({
  default: {
    get:    vi.fn(),
    post:   vi.fn(),
    patch:  vi.fn(),
    delete: vi.fn(),
  },
}))

import api from '@/services/api'
import DebtsService from '@/services/debts.service'
import type { CreateDebtPayload, DebtPayment } from '@/types/debt.types'

const mockGet    = vi.mocked(api.get)
const mockPost   = vi.mocked(api.post)
const mockPatch  = vi.mocked(api.patch)
const mockDelete = vi.mocked(api.delete)

const debt = { id: 'd-1', name: 'Tarjeta', totalAmount: 10000, remainingBalance: 8000 }
const payment: DebtPayment = {
  id: 'p-1', debtId: 'd-1', scheduledAmount: 500, actualAmount: 500,
  paymentDate: '2026-07-01', note: null, transactionId: null, createdAt: '2026-01-01',
}

describe('DebtsService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getAll() GET /debts', async () => {
    mockGet.mockResolvedValue({ data: [debt] })
    const result = await DebtsService.getAll()
    expect(mockGet).toHaveBeenCalledWith('/debts')
    expect(result).toEqual([debt])
  })

  it('getOne() GET /debts/:id', async () => {
    mockGet.mockResolvedValue({ data: debt })
    const result = await DebtsService.getOne('d-1')
    expect(mockGet).toHaveBeenCalledWith('/debts/d-1')
    expect(result).toEqual(debt)
  })

  it('create() POST /debts con el payload', async () => {
    const payload: CreateDebtPayload = {
      name: 'Tarjeta', initialAmount: 10000,
      minimumPayment: 500, startDate: '2026-01-01',
    }
    mockPost.mockResolvedValue({ data: debt })
    const result = await DebtsService.create(payload)
    expect(mockPost).toHaveBeenCalledWith('/debts', payload)
    expect(result).toEqual(debt)
  })

  it('update() PATCH /debts/:id con el payload', async () => {
    mockPatch.mockResolvedValue({ data: debt })
    const result = await DebtsService.update('d-1', { name: 'Nuevo nombre' })
    expect(mockPatch).toHaveBeenCalledWith('/debts/d-1', { name: 'Nuevo nombre' })
    expect(result).toEqual(debt)
  })

  it('remove() DELETE /debts/:id', async () => {
    mockDelete.mockResolvedValue({ data: undefined })
    await DebtsService.remove('d-1')
    expect(mockDelete).toHaveBeenCalledWith('/debts/d-1')
  })

  // ── Pagos ──────────────────────────────────────────────────────────────

  it('getPayments() GET /debts/:id/payments', async () => {
    mockGet.mockResolvedValue({ data: [payment] })
    const result = await DebtsService.getPayments('d-1')
    expect(mockGet).toHaveBeenCalledWith('/debts/d-1/payments')
    expect(result).toEqual([payment])
  })

  it('registerPayment() POST /debts/:id/payments', async () => {
    const payload = { actualAmount: 500, paymentDate: '2026-07-01', note: null }
    mockPost.mockResolvedValue({ data: payment })
    const result = await DebtsService.registerPayment('d-1', payload)
    expect(mockPost).toHaveBeenCalledWith('/debts/d-1/payments', payload)
    expect(result).toEqual(payment)
  })

  it('updatePayment() PATCH /debts/:id/payments/:paymentId', async () => {
    mockPatch.mockResolvedValue({ data: payment })
    const result = await DebtsService.updatePayment('d-1', 'p-1', { note: 'extra' })
    expect(mockPatch).toHaveBeenCalledWith('/debts/d-1/payments/p-1', { note: 'extra' })
    expect(result).toEqual(payment)
  })

  it('removePayment() DELETE /debts/:id/payments/:paymentId', async () => {
    mockDelete.mockResolvedValue({ data: undefined })
    await DebtsService.removePayment('d-1', 'p-1')
    expect(mockDelete).toHaveBeenCalledWith('/debts/d-1/payments/p-1')
  })

  // ── Amortización y planes ──────────────────────────────────────────────

  it('getAmortization() GET /debts/:id/amortization', async () => {
    const data = { tabla: [], isNegativeAmortization: false }
    mockGet.mockResolvedValue({ data })
    const result = await DebtsService.getAmortization('d-1')
    expect(mockGet).toHaveBeenCalledWith('/debts/d-1/amortization')
    expect(result).toEqual(data)
  })

  it('getSnowballPlan() GET /debts/plans/snowball', async () => {
    mockGet.mockResolvedValue({ data: { steps: [] } })
    const result = await DebtsService.getSnowballPlan()
    expect(mockGet).toHaveBeenCalledWith('/debts/plans/snowball')
    expect(result).toEqual({ steps: [] })
  })

  it('getAvalanchePlan() GET /debts/plans/avalanche', async () => {
    mockGet.mockResolvedValue({ data: { steps: [] } })
    await DebtsService.getAvalanchePlan()
    expect(mockGet).toHaveBeenCalledWith('/debts/plans/avalanche')
  })

  it('getFireballPlan() GET /debts/plans/fireball', async () => {
    mockGet.mockResolvedValue({ data: { steps: [] } })
    await DebtsService.getFireballPlan()
    expect(mockGet).toHaveBeenCalledWith('/debts/plans/fireball')
  })
})
