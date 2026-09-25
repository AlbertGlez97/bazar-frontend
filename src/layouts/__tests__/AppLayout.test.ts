import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { APP_NAME } from '@/config/app'

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
  AppBadge:         { template: '<span><slot /></span>' },
  AppButton:        { template: '<button><slot /></button>' },
  AppAvatar:        { template: '<div />' },
  AppToast:         { template: '<div />' },
  InstallAppButton: { template: '<div />' },
  UiModeSwitch:     { template: '<div />' },
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

  describe('menú lateral según el ancho', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'matchMedia')
    const stubMatchMedia = (phone: boolean) => {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: vi.fn((query: string) => ({ matches: phone && query === '(max-width: 767px)', media: query })),
      })
    }
    afterEach(() => {
      if (original) Object.defineProperty(window, 'matchMedia', original)
      else Reflect.deleteProperty(window, 'matchMedia')
    })

    it('en un celular (< 768 px) arranca colapsado para no comerse el contenido', () => {
      stubMatchMedia(true)
      const vm = shallowMount(AppLayout).vm as unknown as AppLayoutVm
      expect(vm.sidebarCollapsed).toBe(true)
    })

    it('en una pantalla ancha arranca expandido', () => {
      stubMatchMedia(false)
      const vm = shallowMount(AppLayout).vm as unknown as AppLayoutVm
      expect(vm.sidebarCollapsed).toBe(false)
    })

    it('en un celular se puede volver a expandir', () => {
      stubMatchMedia(true)
      const vm = shallowMount(AppLayout).vm as unknown as AppLayoutVm
      vm.toggleSidebar()
      expect(vm.sidebarCollapsed).toBe(false)
    })
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

  it('navItems contiene inicio y el catálogo de productos', () => {
    const wrapper = shallowMount(AppLayout)
    const vm = wrapper.vm as unknown as AppLayoutVm
    expect(vm.navItems.map((i) => i.to)).toEqual(['/app', '/app/productos'])
  })

  it('currentRouteTitle resuelve el nombre de la ruta actual', () => {
    const wrapper = shallowMount(AppLayout)
    const vm = wrapper.vm as unknown as AppLayoutVm
    expect(vm.currentRouteTitle).toBe('Inicio')
  })

  it('currentRouteTitle muestra "Productos" en el catálogo', () => {
    routeMock.name = 'ProductCatalog'
    const wrapper = shallowMount(AppLayout)
    const vm = wrapper.vm as unknown as AppLayoutVm
    expect(vm.currentRouteTitle).toBe('Productos')
    routeMock.name = 'AppHome'
  })

  it('currentRouteTitle usa el nombre de la app como fallback para rutas desconocidas', () => {
    routeMock.name = 'Unknown'
    const wrapper = shallowMount(AppLayout)
    const vm = wrapper.vm as unknown as AppLayoutVm
    expect(vm.currentRouteTitle).toBe(APP_NAME)
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
