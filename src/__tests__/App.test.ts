import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'

// ── Mocks ─────────────────────────────────────────────────────────────────

const replaceMock = vi.fn()
const routeMock   = { meta: {} }

vi.mock('vue-router', () => ({
  useRouter:  () => ({ currentRoute: { value: routeMock }, replace: replaceMock }),
  RouterView: { template: '<div />' },
}))

const fetchMeMock = vi.fn()
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    isAuthenticated: false,
    token: null,
    user:  null,
    fetchMe: fetchMeMock,
  })),
}))

vi.mock('@/stores/crypto.store', () => ({
  useCryptoStore: vi.fn(() => ({
    isReady:     false,
    canRestore:  vi.fn(() => false),
  })),
}))

vi.mock('@/components', () => ({
  AppToast: { template: '<div />' },
}))

vi.mock('@/components/ui/organisms/KeyRestoreModal.vue', () => ({
  default: { template: '<div />' },
}))

import App from '@/App.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useCryptoStore } from '@/stores/crypto.store'

describe('App.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routeMock.meta = {}
  })

  it('se monta sin errores', async () => {
    const wrapper = shallowMount(App)
    await wrapper.vm.$nextTick()
    expect(wrapper.exists()).toBe(true)
  })

  it('no llama a fetchMe si no hay token', async () => {
    shallowMount(App)
    await new Promise(r => setTimeout(r, 0))
    expect(fetchMeMock).not.toHaveBeenCalled()
  })

  it('llama a fetchMe si hay token', async () => {
    vi.mocked(useAuthStore).mockReturnValueOnce({
      isAuthenticated: false,
      token: 'jwt-xxx',
      user: null,
      fetchMe: fetchMeMock,
    } as any)
    fetchMeMock.mockResolvedValue(undefined)

    shallowMount(App)
    await new Promise(r => setTimeout(r, 0))
    expect(fetchMeMock).toHaveBeenCalledTimes(1)
  })

  it('redirige a Dashboard si isAuthenticated y ruta tiene redirectIfAuth', async () => {
    routeMock.meta = { redirectIfAuth: true }
    vi.mocked(useAuthStore).mockReturnValueOnce({
      isAuthenticated: true,
      token: 'jwt-xxx',
      user: { id: 'u-1' },
      fetchMe: fetchMeMock,
    } as any)
    fetchMeMock.mockResolvedValue(undefined)

    shallowMount(App)
    await new Promise(r => setTimeout(r, 10))
    expect(replaceMock).toHaveBeenCalledWith({ name: 'Dashboard' })
  })

  it('redirige a Login si no isAuthenticated y ruta tiene requiresAuth', async () => {
    routeMock.meta = { requiresAuth: true }
    vi.mocked(useAuthStore).mockReturnValueOnce({
      isAuthenticated: false,
      token: null,
      user: null,
      fetchMe: fetchMeMock,
    } as any)

    shallowMount(App)
    await new Promise(r => setTimeout(r, 10))
    expect(replaceMock).toHaveBeenCalledWith({ name: 'Login' })
  })

  it('needsKeyRestore es false cuando no hay sesión autenticada', () => {
    const wrapper = shallowMount(App)
    const vm = wrapper.vm as any
    expect(vm.needsKeyRestore).toBe(false)
  })

  it('needsKeyRestore es true cuando isAuthenticated + !isReady + canRestore + user', async () => {
    vi.mocked(useAuthStore).mockReturnValueOnce({
      isAuthenticated: true,
      token: 'jwt-xxx',
      user: { id: 'u-1' },
      fetchMe: fetchMeMock,
    } as any)
    vi.mocked(useCryptoStore).mockReturnValueOnce({
      isReady: false,
      canRestore: vi.fn(() => true),
    } as any)
    fetchMeMock.mockResolvedValue(undefined)

    const wrapper = shallowMount(App)
    await new Promise(r => setTimeout(r, 10))

    // checking becomes false after onMounted
    const vm = wrapper.vm as any
    expect(vm.needsKeyRestore).toBe(true)
  })
})
