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
  bindAccount('socio')
})
// Una cuenta = una persona: /auth/me devuelve la persona que el test pone en la sesión.
function bindAccount(role: 'socio' | 'colaborador') {
  const member = { id: 'm', name: 'Fixture', role, active: true }
  vi.mocked(AuthService.me).mockResolvedValue({ username: 'x', memberId: member.id, member })
  return member
}
function auth() {
  localStorage.setItem('access_token', TEST_IDENTITY)
  localStorage.setItem('token_expires_at', String(Date.now() + 60_000))
}
describe('help route access', () => {
  it.each(['socio', 'colaborador'] as const)('allows %s in both modes with ready context', async (role) => {
    auth()
    useSessionStore().setDevice({ deviceId: 'd', name: 'Fixture' })
    useSessionStore().setMember(bindAccount(role))
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
  it('requires an identified device', async () => {
    auth()
    const router = createAppRouter(createMemoryHistory())
    await router.push('/app/ayuda')
    expect(router.currentRoute.value.name).toBe('SelectContext')
  })
  it('rejects an account without a person (unassigned) even with the device identified', async () => {
    auth()
    useSessionStore().setDevice({ deviceId: 'd', name: 'Fixture' })
    vi.mocked(AuthService.me).mockResolvedValue({ username: 'x', memberId: null, member: null })
    const router = createAppRouter(createMemoryHistory())
    await router.push('/app/ayuda')
    expect(router.currentRoute.value.name).toBe('SelectContext')
  })
  it('rejects an inactive bound member despite a forged ready context', async () => {
    auth()
    useSessionStore().setDevice({ deviceId: 'd', name: 'Fixture' })
    useSessionStore().setMember(bindAccount('socio'))
    vi.mocked(AuthService.me).mockResolvedValue({ username: 'x', memberId: 'm', member: { id: 'm', name: 'Fixture', role: 'socio', active: false } })
    const router = createAppRouter(createMemoryHistory())
    await router.push('/app/ayuda')
    expect(router.currentRoute.value.name).toBe('SelectContext')
  })
})
