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
import AuthService from '@/services/auth.service'

const mockGet    = vi.mocked(api.get)
const mockPost   = vi.mocked(api.post)
const mockPatch  = vi.mocked(api.patch)

const authResponse = { token: 'jwt-xxx', user: { id: 'u-1', email: 'a@b.com' } }
const user         = { id: 'u-1', email: 'a@b.com', ruleNeeds: 50, ruleWants: 30, ruleSavings: 20 }

describe('AuthService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('login() POST /auth/login con el payload', async () => {
    mockPost.mockResolvedValue({ data: authResponse })
    const result = await AuthService.login({ email: 'a@b.com', password: '123' })
    expect(mockPost).toHaveBeenCalledWith('/auth/login', { email: 'a@b.com', password: '123' })
    expect(result).toEqual(authResponse)
  })

  it('register() POST /auth/register con el payload', async () => {
    mockPost.mockResolvedValue({ data: authResponse })
    const payload = { email: 'a@b.com', password: '123', recoveryPhrase: 'abc' }
    const result = await AuthService.register(payload as any)
    expect(mockPost).toHaveBeenCalledWith('/auth/register', payload)
    expect(result).toEqual(authResponse)
  })

  it('initRecovery() POST /auth/recovery/init con el email', async () => {
    const resp = { salt: 'abc', iv: 'def', wrappedDek: 'xyz', publicSalt: 'pqr' }
    mockPost.mockResolvedValue({ data: resp })
    const result = await AuthService.initRecovery('a@b.com')
    expect(mockPost).toHaveBeenCalledWith('/auth/recovery/init', { email: 'a@b.com' })
    expect(result).toEqual(resp)
  })

  it('completeRecovery() POST /auth/recovery/complete con el payload', async () => {
    mockPost.mockResolvedValue({ data: authResponse })
    const payload = { email: 'a@b.com', newPassword: 'new', wrappedDek: 'x', iv: 'i', salt: 's' }
    const result = await AuthService.completeRecovery(payload as any)
    expect(mockPost).toHaveBeenCalledWith('/auth/recovery/complete', payload)
    expect(result).toEqual(authResponse)
  })

  it('getMe() GET /users/me', async () => {
    mockGet.mockResolvedValue({ data: user })
    const result = await AuthService.getMe()
    expect(mockGet).toHaveBeenCalledWith('/users/me')
    expect(result).toEqual(user)
  })

  it('updateBudgetRule() PATCH /users/me/budget-rule con los porcentajes', async () => {
    mockPatch.mockResolvedValue({ data: user })
    const result = await AuthService.updateBudgetRule(50, 30, 20)
    expect(mockPatch).toHaveBeenCalledWith('/users/me/budget-rule', {
      ruleNeeds: 50, ruleWants: 30, ruleSavings: 20,
    })
    expect(result).toEqual(user)
  })
})
