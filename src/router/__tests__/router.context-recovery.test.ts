import { beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import { flushPromises } from '@vue/test-utils'
import { createAppRouter } from '../index'
import { useSessionStore } from '@/stores/session.store'
import { useAuthStore } from '@/stores/auth.store'
import AuthService from '@/services/auth.service'
vi.mock('@/services/auth.service', () => ({ default: { me: vi.fn(), login: vi.fn() } }))
vi.stubGlobal('scrollTo', vi.fn())
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActivePinia(createPinia())
  vi.clearAllMocks()
  localStorage.setItem('access_token', 'a.' + btoa(JSON.stringify({ sub: 'a' })) + '.z')
  localStorage.setItem('token_expires_at', String(Date.now() + 60000))
})
it('recovers once into device identification while retaining the server-bound person', async () => {
  const member = { id: 'ma', name: 'Ana', role: 'colaborador' as const, active: true }
  vi.mocked(AuthService.me).mockResolvedValue({ username: 'a', memberId: 'ma', member })
  const session = useSessionStore()
  session.setDevice({ deviceId: 'da', name: 'Tablet' })
  const router = createAppRouter(createMemoryHistory())
  await router.push('/app/venta')
  session.clearDevice()
  session.clearMember()
  session.recoveryReason = 'rejected'
  await flushPromises()
  await flushPromises()
  await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('SelectContext'), { timeout: 3000 })
  expect(useAuthStore().bindingStatus).toBe('bound')
  expect(session.memberId).toBe('ma')
  expect(AuthService.me).toHaveBeenCalledTimes(2)
})
