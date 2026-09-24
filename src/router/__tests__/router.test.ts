import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '../index'
import { useAuthStore } from '@/stores/auth.store'
vi.stubGlobal('scrollTo', vi.fn())
// A new router (with its own in-memory history) per test: the app router is a
// module singleton whose current route would leak from one test to the next.
let router: ReturnType<typeof createAppRouter>
beforeEach(() => {
  localStorage.clear(); setActivePinia(createPinia())
  router = createAppRouter(createMemoryHistory())
})
describe('session routing', () => {
  // '/' ahora es la landing pública: un visitante sin sesión debe poder verla
  // sin ser redirigido a login (a diferencia del resto de rutas protegidas).
  it('shows the public landing at / when logged out', async () => {
    await router.push('/'); expect(router.currentRoute.value.name).toBe('Landing')
  })
  it.each(['/unknown', '/dashboard', '/register', '/app', '/login'])('sends logged-out %s to login', async (path) => {
    await router.push(path); expect(router.currentRoute.value.name).toBe('Login')
  })
  it('allows logged-out visitors to reach the business registration form', async () => {
    await router.push('/registro-negocio'); expect(router.currentRoute.value.name).toBe('BusinessRegistration')
  })
  it.each(['/', '/unknown', '/login', '/app'])('sends restored-session %s to shell', async (path) => {
    localStorage.setItem('access_token', 'token')
    localStorage.setItem('token_expires_at', String(Date.now() + 60_000))
    await router.push(path); expect(router.currentRoute.value.name).toBe('AppHome')
  })
  it('sends an expired-session visitor to login instead of the shell', async () => {
    localStorage.setItem('access_token', 'token')
    localStorage.setItem('token_expires_at', String(Date.now() - 1_000))
    await router.push('/app'); expect(router.currentRoute.value.name).toBe('Login')
  })
  it('does not share the current route between router instances', async () => {
    localStorage.setItem('access_token', 'token')
    localStorage.setItem('token_expires_at', String(Date.now() + 60_000))
    await router.push('/app')
    const other = createAppRouter(createMemoryHistory())
    expect(router.currentRoute.value.name).toBe('AppHome')
    expect(other.currentRoute.value.name).not.toBe('AppHome')
  })
  it('logout returns to login and prevents shell reentry', async () => {
    const auth = useAuthStore(); auth.token = 't'; auth.expiresAt = Date.now() + 60_000
    await router.push('/app'); auth.logout(); await router.push('/login'); await router.push('/app')
    expect(router.currentRoute.value.name).toBe('Login')
  })
})
