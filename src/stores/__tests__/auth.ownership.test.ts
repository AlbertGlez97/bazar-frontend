import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../auth.store'
import { useSessionStore } from '../session.store'
import type { AccountBinding } from '@/types/auth.types'
import AuthService from '@/services/auth.service'
vi.mock('@/services/auth.service', () => ({ default: { login: vi.fn(), me: vi.fn() } }))
const jwt = (sub: string) => 'a.' + btoa(JSON.stringify({ sub })) + '.z'
const owner = { accountId: 'a', apiBase: '/api/v1' }
const member = { id: 'ma', name: 'Ana', role: 'socio' as const, active: true }
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActivePinia(createPinia()); vi.clearAllMocks(); localStorage.setItem('access_token', jwt('a')); localStorage.setItem('token_expires_at', String(Date.now() + 60000)); localStorage.setItem('auth_username', 'same') })
describe('account-owned binding lifecycle', () => {
  it('does not trust an unowned cache with the same username', async () => {
    localStorage.setItem('account_binding', JSON.stringify({ username: 'same', member }))
    vi.mocked(AuthService.me).mockRejectedValue(new Error('offline'))
    const auth = useAuthStore(); await auth.ensureBinding()
    expect(auth.bindingStatus).toBe('unknown')
    expect(useSessionStore().memberId).toBeNull()
  })
  it('drops a cache from another account or API even with the same username', async () => {
    localStorage.setItem('account_binding', JSON.stringify({ username: 'same', member, owner: { ...owner, apiBase: '/other' } }))
    vi.mocked(AuthService.me).mockRejectedValue(new Error('offline'))
    const auth = useAuthStore(); await auth.ensureBinding()
    expect(auth.bindingStatus).toBe('unknown')
  })
  it('uses only a matching owned offline cache', async () => {
    localStorage.setItem('account_binding', JSON.stringify({ username: 'same', member, owner }))
    vi.mocked(AuthService.me).mockRejectedValue(new Error('offline'))
    const auth = useAuthStore(); await auth.ensureBinding()
    expect(auth.bindingStatus).toBe('bound')
  })
  it.each(['success', '401'])('ignores old binding %s after another account login', async (result) => {
    let resolve!: (value: AccountBinding) => void; let reject!: (value: unknown) => void
    vi.mocked(AuthService.me).mockImplementationOnce(() => new Promise((yes, no) => { resolve = yes; reject = no }))
    const auth = useAuthStore(); const old = auth.ensureBinding()
    vi.mocked(AuthService.login).mockResolvedValue({ accessToken: jwt('b'), expiresIn: 3600, tokenType: 'Bearer' })
    vi.mocked(AuthService.me).mockResolvedValue({ username: 'b', memberId: null, member: null })
    await auth.login({ username: 'b', password: 'synthetic' })
    if (result === 'success') resolve({ username: 'a', memberId: member.id, member }); else reject({ response: { status: 401 } })
    await old
    expect(auth.token).toBe(jwt('b')); expect(auth.bindingStatus).toBe('shared')
    expect(useSessionStore().memberId).toBeNull()
    expect(JSON.parse(localStorage.getItem('account_binding')!).owner.accountId).toBe('b')
  })
})
