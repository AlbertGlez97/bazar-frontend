import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/api', () => ({
  default: {
    get:    vi.fn(),
    post:   vi.fn(),
    delete: vi.fn(),
  },
}))

import api from '@/services/api'
import { MsiService } from '@/services/msi.service'
import type { CreateMsiPayload, MsiPurchase } from '@/types/msi.types'

const mockGet    = vi.mocked(api.get)
const mockPost   = vi.mocked(api.post)
const mockDelete = vi.mocked(api.delete)

const purchase: MsiPurchase = {
  id: 'msi-1', userId: 'u-1', name: 'Laptop', store: null,
  totalAmount: 24000, installments: 12, monthlyAmount: 2000,
  startYear: 2026, startMonth: 1, status: 'active', createdAt: '2026-01-01',
}

describe('MsiService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getAll() GET /msi', async () => {
    mockGet.mockResolvedValue({ data: [purchase] })
    const result = await MsiService.getAll()
    expect(mockGet).toHaveBeenCalledWith('/msi')
    expect(result).toEqual([purchase])
  })

  it('getActive() GET /msi/active con year y month como params', async () => {
    mockGet.mockResolvedValue({ data: [purchase] })
    const result = await MsiService.getActive(2026, 7)
    expect(mockGet).toHaveBeenCalledWith('/msi/active', { params: { year: 2026, month: 7 } })
    expect(result).toEqual([purchase])
  })

  it('create() POST /msi con el payload', async () => {
    const payload: CreateMsiPayload = {
      name: 'Laptop', totalAmount: 24000, installments: 12,
      startYear: 2026, startMonth: 1,
    }
    mockPost.mockResolvedValue({ data: purchase })
    const result = await MsiService.create(payload)
    expect(mockPost).toHaveBeenCalledWith('/msi', payload)
    expect(result).toEqual(purchase)
  })

  it('remove() DELETE /msi/:id', async () => {
    mockDelete.mockResolvedValue({ data: undefined })
    await MsiService.remove('msi-1')
    expect(mockDelete).toHaveBeenCalledWith('/msi/msi-1')
  })
})
