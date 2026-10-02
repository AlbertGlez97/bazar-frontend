const TEST_IDENTITY = 'a.' + btoa(JSON.stringify({ sub: 'account-a' })) + '.z'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '../index'
import AuthService from '@/services/auth.service'
import { useSessionStore } from '@/stores/session.store'
import { useUiModeStore } from '@/stores/uiMode.store'

vi.mock('@/services/auth.service', () => ({ default: { login: vi.fn(), me: vi.fn() } }))
vi.stubGlobal('scrollTo', vi.fn())
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setActivePinia(createPinia())
  vi.mocked(AuthService.me).mockResolvedValue({ username: 'x', memberId: null, member: null })
})
function auth() {
  localStorage.setItem('access_token', TEST_IDENTITY)
  localStorage.setItem('token_expires_at', String(Date.now() + 60_000))
}
describe('help route access', () => {
  it.each(['socio', 'colaborador'] as const)('allows %s in both modes with ready context', async (role) => {
    auth()
    useSessionStore().setDevice({ deviceId: 'd', name: 'Fixture' })
    useSessionStore().setMember({ id: 'm', name: 'Fixture', role, active: true })
    for (const mode of ['gestion', 'venta'] as const) {
      useUiModeStore().setMode(mode)
      const router = createAppRouter(createMemoryHistory())
      await router.push('/app/ayuda#efectivo')
      expect(router.currentRoute.value.name).toBe('Help')
      expect(router.currentRoute.value.meta.requiresAuth).toBe(true)
      expect(router.currentRoute.value.meta.requiresContext).toBe(true)
      expect(router.currentRoute.value.meta.requiresSocio).not.toBe(true)
      expect(router.currentRoute.value.meta.requiresGestion).not.toBe(true)
    }
  })
  it('requires login', async () => {
    const router = createAppRouter(createMemoryHistory())
    await router.push('/app/ayuda')
    expect(router.currentRoute.value.name).toBe('Login')
  })
  it('requires complete context', async () => {
    auth()
    const router = createAppRouter(createMemoryHistory())
    await router.push('/app/ayuda')
    expect(router.currentRoute.value.name).toBe('SelectContext')
  })
  it('rejects an inactive bound member despite a forged ready context', async () => {
    auth()
    useSessionStore().setDevice({ deviceId: 'd', name: 'Fixture' })
    useSessionStore().setMember({ id: 'm', name: 'Fixture', role: 'socio', active: true })
    vi.mocked(AuthService.me).mockResolvedValue({ username: 'x', memberId: 'm', member: { id: 'm', name: 'Fixture', role: 'socio', active: false } })
    const router = createAppRouter(createMemoryHistory())
    await router.push('/app/ayuda')
    expect(router.currentRoute.value.name).toBe('SelectContext')
  })
})
