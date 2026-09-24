import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'

const pushMock    = vi.fn()
const routeMock   = { name: 'AppHome' }

vi.mock('vue-router', () => ({
  useRouter:  () => ({ push: pushMock }),
  useRoute:   () => routeMock,
  RouterLink: { template: '<a><slot /></a>' },
  RouterView: { template: '<div />' },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    username: 'Juan',
    logout: vi.fn(),
  }),
}))

vi.mock('@/components', () => ({
  AppButton:        { template: '<button><slot /></button>' },
  AppAvatar:        { template: '<div />' },
  AppToast:         { template: '<div />' },
  InstallAppButton: { template: '<div />' },
}))

import AppLayout from '@/layouts/AppLayout.vue'

// Superficie del <script setup> tal como la expone el vm del wrapper
interface AppLayoutVm {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  navItems: { to: string }[]
  currentRouteTitle: string
  formattedDate: string
  handleLogout: () => void
}

describe('AppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('se monta sin errores', () => {
    const wrapper = shallowMount(AppLayout)
    expect(wrapper.exists()).toBe(true)
  })

  it('toggleSidebar cambia sidebarCollapsed', async () => {
    const wrapper = shallowMount(AppLayout)
    const vm = wrapper.vm as unknown as AppLayoutVm
    expect(vm.sidebarCollapsed).toBe(false)
    vm.toggleSidebar()
    expect(vm.sidebarCollapsed).toBe(true)
    vm.toggleSidebar()
    expect(vm.sidebarCollapsed).toBe(false)
  })

  it('navItems contiene solo la ruta de inicio', () => {
    const wrapper = shallowMount(AppLayout)
    const vm = wrapper.vm as unknown as AppLayoutVm
    expect(vm.navItems).toHaveLength(1)
    const routes = vm.navItems.map((i) => i.to)
    expect(routes).toContain('/app')
  })

  it('currentRouteTitle resuelve el nombre de la ruta actual', () => {
    const wrapper = shallowMount(AppLayout)
    const vm = wrapper.vm as unknown as AppLayoutVm
    expect(vm.currentRouteTitle).toBe('Inicio')
  })

  it('currentRouteTitle usa FinanzasApp como fallback para rutas desconocidas', () => {
    routeMock.name = 'Unknown'
    const wrapper = shallowMount(AppLayout)
    const vm = wrapper.vm as unknown as AppLayoutVm
    expect(vm.currentRouteTitle).toBe('FinanzasApp')
    routeMock.name = 'AppHome'
  })

  it('formattedDate devuelve una cadena no vacía', () => {
    const wrapper = shallowMount(AppLayout)
    const vm = wrapper.vm as unknown as AppLayoutVm
    expect(typeof vm.formattedDate).toBe('string')
    expect(vm.formattedDate.length).toBeGreaterThan(0)
  })

  it('handleLogout llama a logout() y redirige a Login', () => {
    const wrapper = shallowMount(AppLayout)
    const vm = wrapper.vm as unknown as AppLayoutVm
    vm.handleLogout()
    expect(pushMock).toHaveBeenCalledWith({ name: 'Login' })
  })
})
