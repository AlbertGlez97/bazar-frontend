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
import SavingsService from '@/services/savings.service'
import type { SavingGoal, SavingContribution } from '@/types/savings.types'

const mockGet    = vi.mocked(api.get)
const mockPost   = vi.mocked(api.post)
const mockPatch  = vi.mocked(api.patch)
const mockDelete = vi.mocked(api.delete)

const goal: SavingGoal = {
  id: 'g-1', name: 'Fondo', targetAmount: 50000, currentAmount: 10000,
  targetDate: null, frequency: 'mensual', minimumMonthlyContribution: 2000,
  isCompleted: false, notes: null, createdAt: '2026-01-01',
}

const contribution: SavingContribution = {
  id: 'c-1', savingGoalId: 'g-1', amount: 2000,
  date: '2026-07-01', note: null, createdAt: '2026-07-01',
}

describe('SavingsService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getAll() GET /savings', async () => {
    mockGet.mockResolvedValue({ data: [goal] })
    const result = await SavingsService.getAll()
    expect(mockGet).toHaveBeenCalledWith('/savings')
    expect(result).toEqual([goal])
  })

  it('getOne() GET /savings/:id', async () => {
    mockGet.mockResolvedValue({ data: goal })
    const result = await SavingsService.getOne('g-1')
    expect(mockGet).toHaveBeenCalledWith('/savings/g-1')
    expect(result).toEqual(goal)
  })

  it('create() POST /savings con el payload', async () => {
    const payload = {
      name: 'Fondo', targetAmount: 50000, targetDate: null,
      frequency: 'mensual' as const, minimumMonthlyContribution: 2000, notes: null,
    }
    mockPost.mockResolvedValue({ data: goal })
    const result = await SavingsService.create(payload)
    expect(mockPost).toHaveBeenCalledWith('/savings', payload)
    expect(result).toEqual(goal)
  })

  it('update() PATCH /savings/:id con el payload', async () => {
    mockPatch.mockResolvedValue({ data: goal })
    const result = await SavingsService.update('g-1', { name: 'Nuevo nombre' })
    expect(mockPatch).toHaveBeenCalledWith('/savings/g-1', { name: 'Nuevo nombre' })
    expect(result).toEqual(goal)
  })

  it('remove() DELETE /savings/:id', async () => {
    mockDelete.mockResolvedValue({ data: undefined })
    await SavingsService.remove('g-1')
    expect(mockDelete).toHaveBeenCalledWith('/savings/g-1')
  })

  it('getContributions() GET /savings/:id/records', async () => {
    mockGet.mockResolvedValue({ data: [contribution] })
    const result = await SavingsService.getContributions('g-1')
    expect(mockGet).toHaveBeenCalledWith('/savings/g-1/records')
    expect(result).toEqual([contribution])
  })

  it('addContribution() POST /savings/:id/records con el payload', async () => {
    const payload = { amount: 2000, date: '2026-07-01', note: null }
    mockPost.mockResolvedValue({ data: contribution })
    const result = await SavingsService.addContribution('g-1', payload)
    expect(mockPost).toHaveBeenCalledWith('/savings/g-1/records', payload)
    expect(result).toEqual(contribution)
  })
})
