import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../auth.store'
import AuthService from '@/services/auth.service'
vi.mock('@/services/auth.service', () => ({ default: { login: vi.fn() } }))
const user = { id: '1', name: 'Ana', email: 'a@test.com' }
const payload = { email: user.email, password: 'password' }
beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()); vi.clearAllMocks() })
describe('local session', () => {
  it('starts logged out', () => expect(useAuthStore().isAuthenticated).toBe(false))
  it('restores a complete local session without a request', () => {
    localStorage.setItem('access_token', 'token'); localStorage.setItem('user', JSON.stringify(user))
    expect(useAuthStore().user).toEqual(user)
    expect(useAuthStore().isAuthenticated).toBe(true)
    expect(AuthService.login).not.toHaveBeenCalled()
  })
  it.each(['', '{', 'null', '[]', '"text"', '{}', '{"id":1}', '{"id":""}', '{"id":"1","name":1}', '{"id":"1","name":"Ana","email":1}'])('rejects invalid user storage %s', (raw) => {
    localStorage.setItem('access_token', 'token'); localStorage.setItem('user', raw)
    expect(useAuthStore().isAuthenticated).toBe(false)
    expect(localStorage.getItem('user')).toBeNull(); expect(localStorage.getItem('access_token')).toBeNull()
  })
  it.each([null, '', '   '])('rejects missing or blank token %s', (token) => {
    if (token !== null) localStorage.setItem('access_token', token)
    localStorage.setItem('user', JSON.stringify(user))
    expect(useAuthStore().isAuthenticated).toBe(false)
    expect(localStorage.getItem('user')).toBeNull()
  })
  it('clears token-only storage', () => {
    localStorage.setItem('access_token', 'token')
    expect(useAuthStore().isAuthenticated).toBe(false)
    expect(localStorage.getItem('access_token')).toBeNull()
  })
  it('persists login and clears logout', async () => {
    vi.mocked(AuthService.login).mockResolvedValue({ accessToken: 'token', usuario: user })
    const auth = useAuthStore(); const pending = auth.login(payload)
    expect(auth.loading).toBe(true); await pending
    expect(auth.isAuthenticated).toBe(true); expect(auth.loading).toBe(false)
    expect(JSON.parse(localStorage.getItem('user')!)).toEqual(user)
    auth.logout(); expect(auth.isAuthenticated).toBe(false)
    expect(localStorage.getItem('user')).toBeNull(); expect(localStorage.getItem('access_token')).toBeNull()
  })
  it.each([{ response: { data: { message: 'Denied' } } }, new Error('offline'), null, { response: { data: { message: ['bad'] } } }])('resets state after login error', async (cause) => {
    vi.mocked(AuthService.login).mockRejectedValue(cause)
    const auth = useAuthStore()
    await expect(auth.login(payload)).rejects.toEqual(cause)
    expect(auth.loading).toBe(false); expect(auth.isAuthenticated).toBe(false)
    expect(auth.error).toBeTruthy()
  })
  it.each([{ accessToken: '', usuario: user }, { accessToken: 't', usuario: null }])('rejects incomplete login responses', async (response) => {
    vi.mocked(AuthService.login).mockResolvedValue(response as never)
    await expect(useAuthStore().login(payload)).rejects.toThrow('Invalid login response')
    expect(useAuthStore().isAuthenticated).toBe(false)
  })
})
