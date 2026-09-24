import { beforeEach, describe, expect, it, vi } from 'vitest'
import AuthService from '../auth.service'
import api from '../api'
vi.mock('../api', () => ({ default: { post: vi.fn(), get: vi.fn() } }))
describe('legacy login service', () => {
  beforeEach(() => vi.clearAllMocks())
  it('posts credentials without fetching a profile', async () => {
    const response = { accessToken: 'token', usuario: { id: '1', name: 'Ana', email: 'a@test.com' } }
    vi.mocked(api.post).mockResolvedValue({ data: response })
    const payload = { email: 'a@test.com', password: 'password' }
    expect(await AuthService.login(payload)).toEqual(response)
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/auth/login', payload)
    expect(api.get).not.toHaveBeenCalled()
  })
  it('propagates errors', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('offline'))
    await expect(AuthService.login({ email: '', password: '' })).rejects.toThrow('offline')
  })
})
