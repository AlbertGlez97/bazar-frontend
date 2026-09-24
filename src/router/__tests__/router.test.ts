import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import router from '../index'
import { useAuthStore } from '@/stores/auth.store'
vi.stubGlobal('scrollTo', vi.fn())
beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()) })
describe('session routing', () => {
  it.each(['/', '/unknown', '/dashboard', '/register', '/app', '/login'])('sends logged-out %s to login', async (path) => {
    await router.push(path); expect(router.currentRoute.value.name).toBe('Login')
  })
  it.each(['/', '/unknown', '/login', '/app'])('sends restored-session %s to shell', async (path) => {
    localStorage.setItem('access_token', 'token')
    localStorage.setItem('user', JSON.stringify({ id: '1', name: 'Ana', email: 'a@test.com' }))
    await router.push(path); expect(router.currentRoute.value.name).toBe('AppHome')
  })
  it('logout returns to login and prevents shell reentry', async () => {
    const auth = useAuthStore(); auth.token = 't'; auth.user = { id: '1', name: 'Ana', email: 'a@test.com' }
    await router.push('/app'); auth.logout(); await router.push('/login'); await router.push('/app')
    expect(router.currentRoute.value.name).toBe('Login')
  })
})
