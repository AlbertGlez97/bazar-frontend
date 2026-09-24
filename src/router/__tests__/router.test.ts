import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import router from '../index'
import { useAuthStore } from '@/stores/auth.store'
vi.stubGlobal('scrollTo', vi.fn())
beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()) })
describe('session routing', () => {
  // '/' ahora es la landing pública: un visitante sin sesión debe poder verla
  // sin ser redirigido a login (a diferencia del resto de rutas protegidas).
  it('shows the public landing at / when logged out', async () => {
    await router.push('/'); expect(router.currentRoute.value.name).toBe('Landing')
  })
  it.each(['/unknown', '/dashboard', '/register', '/app', '/login'])('sends logged-out %s to login', async (path) => {
    await router.push(path); expect(router.currentRoute.value.name).toBe('Login')
  })
  it('allows logged-out visitors to reach the business registration placeholder', async () => {
    await router.push('/registro-negocio'); expect(router.currentRoute.value.name).toBe('BusinessRegistration')
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
