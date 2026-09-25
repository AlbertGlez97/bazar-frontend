import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, shallowMount } from '@vue/test-utils'
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

// Cola de ventas offline: el shell la arranca y la detiene; aquí solo se observa eso.
const salesQueue = vi.hoisted(() => ({
  pendingCount: 0,
  needsReviewCount: 0,
  needsReviewRecords: [] as unknown[],
  isSyncing: false,
  start: vi.fn(),
  stop: vi.fn(),
  dismissReview: vi.fn(),
}))
vi.mock('@/stores/sales-queue.store', () => ({ useSalesQueueStore: () => salesQueue }))

vi.mock('@/components', () => ({
  AppBadge:         { template: '<span><slot /></span>' },
  AppButton:        { template: '<button><slot /></button>' },
  AppAvatar:        { template: '<div />' },
  AppToast:         { template: '<div />' },
  InstallAppButton: { template: '<div />' },
  UiModeSwitch:     { template: '<div />' },
  SyncStatusIndicator: { props: ['pendingCount', 'needsReviewCount', 'isSyncing', 'records'], template: '<div class="sync-stub" />' },
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

  it('navItems contiene inicio, productos y vender (Modo Gestión: vender al final)', () => {
    const wrapper = shallowMount(AppLayout)
    const vm = wrapper.vm as unknown as AppLayoutVm
    expect(vm.navItems.map((i) => i.to)).toEqual(['/app', '/app/productos', '/app/venta'])
  })

  it('currentRouteTitle muestra "Vender" en la pantalla de venta', () => {
    routeMock.name = 'Sale'
    const wrapper = shallowMount(AppLayout)
    const vm = wrapper.vm as unknown as AppLayoutVm
    expect(vm.currentRouteTitle).toBe('Vender')
    routeMock.name = 'AppHome'
  })

  it('arranca la sincronización de ventas al montar y la detiene al desmontar', () => {
    const wrapper = shallowMount(AppLayout)
    expect(salesQueue.start).toHaveBeenCalledTimes(1)
    expect(salesQueue.stop).not.toHaveBeenCalled()
    wrapper.unmount()
    expect(salesQueue.stop).toHaveBeenCalledTimes(1)
  })

  it('si arrancar la cola falla, el shell sigue funcionando', async () => {
    salesQueue.start.mockRejectedValueOnce(new Error('idb'))
    const wrapper = shallowMount(AppLayout)
    await Promise.resolve()
    expect(wrapper.exists()).toBe(true)
  })

  it('muestra el indicador de sincronización en la cabecera', () => {
    // mount (no shallowMount): así el componente de la cabecera se renderiza de verdad
    const wrapper = mount(AppLayout)
    expect(wrapper.find('.app-header .sync-stub').exists()).toBe(true)
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
