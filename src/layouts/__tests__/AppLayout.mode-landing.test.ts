import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { useUiModeStore } from '@/stores/uiMode.store'
import { useSessionStore } from '@/stores/session.store'
import AppLayout from '@/layouts/AppLayout.vue'
import type { UiMode } from '@/types/ui-mode.types'

// Menú y cambio de modo del layout: el switch y los enlaces son los reales; solo se
// stubean los ajenos al tema (avatar, instalar) y la cola de ventas.
vi.mock('@/stores/sales-queue.store', () => ({
  useSalesQueueStore: () => ({
    pendingCount: 0, needsReviewCount: 0, needsReviewRecords: [], isSyncing: false,
    start: vi.fn(), stop: vi.fn(), dismissReview: vi.fn(),
  }),
}))

vi.mock('@/components', async () => ({
  AppButton:        { template: '<button><slot /></button>' },
  AppAvatar:        { template: '<div />' },
  InstallAppButton: { template: '<div />' },
  AppBadge:         (await import('@/components/ui/atoms/AppBadge.vue')).default,
  UiModeSwitch:     (await import('@/components/ui/organisms/UiModeSwitch.vue')).default,
  SyncStatusIndicator: (await import('@/components/ui/organisms/SyncStatusIndicator.vue')).default,
}))

beforeEach(() => localStorage.clear())

async function mountAt(path: string, mode: UiMode, role: 'socio' | 'colaborador' = 'socio') {
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{
      path: '/app',
      component: { render: () => h(RouterView) },
      children: [
        { path: '', name: 'AppHome', component: stub, meta: { requiresGestion: true } },
        { path: 'productos', name: 'ProductCatalog', component: stub },
        { path: 'venta', name: 'Sale', component: stub },
        { path: 'reportes', name: 'Reports', component: stub, meta: { requiresGestion: true, requiresSocio: true } },
        { path: 'ajustes', name: 'Settings', component: stub },
      ],
    }],
  })
  const pinia = createPinia()
  useUiModeStore(pinia).setMode(mode)
  useSessionStore(pinia).setMember({ id: 'm-1', name: 'Alberto', role, active: true })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(AppLayout, { global: { plugins: [pinia, router], stubs: { teleport: true } } })
  return { wrapper, router }
}

const links = (wrapper: Awaited<ReturnType<typeof mountAt>>['wrapper']) =>
  wrapper.findAll('.sidebar__nav .sidebar__link').map((a) => a.attributes('href'))
const labels = (wrapper: Awaited<ReturnType<typeof mountAt>>['wrapper']) =>
  wrapper.findAll('.sidebar__nav .sidebar__link').map((a) => a.text())
const switchTo = async (wrapper: Awaited<ReturnType<typeof mountAt>>['wrapper'], name: 'Modo Venta' | 'Modo Gestión') => {
  await wrapper.get(`.sidebar__mode button[aria-label="${name}"]`).trigger('click')
  await flushPromises()
}

describe('AppLayout — el menú depende del modo', () => {
  it('Modo Venta: el menú tiene solo "Vender"', async () => {
    const { wrapper } = await mountAt('/app/venta', 'venta')
    expect(labels(wrapper)).toHaveLength(1)
    expect(labels(wrapper)[0]).toContain('Vender')
    expect(links(wrapper)).toEqual(['/app/venta'])
  })

  it('Modo Venta: un colaborador tampoco ve Inicio ni Productos', async () => {
    const { wrapper } = await mountAt('/app/venta', 'venta', 'colaborador')
    expect(links(wrapper)).toEqual(['/app/venta'])
  })

  it('Modo Gestión: Inicio, Productos, Vender y (socio) Reportes', async () => {
    const { wrapper } = await mountAt('/app/productos', 'gestion')
    expect(links(wrapper)).toEqual(['/app', '/app/productos', '/app/venta', '/app/reportes'])
  })

  it('Modo Gestión: un colaborador no ve Reportes', async () => {
    const { wrapper } = await mountAt('/app/productos', 'gestion', 'colaborador')
    expect(links(wrapper)).toEqual(['/app', '/app/productos', '/app/venta'])
  })

  it('el engrane de ajustes se ofrece en los dos modos', async () => {
    for (const mode of ['venta', 'gestion'] as const) {
      const { wrapper } = await mountAt('/app/venta', mode)
      expect(wrapper.find('a.sidebar__settings[href="/app/ajustes"]').exists()).toBe(true)
    }
  })

  it('cambiar de modo desde el selector actualiza el menú al instante', async () => {
    const { wrapper } = await mountAt('/app/venta', 'gestion')
    expect(links(wrapper)).toContain('/app/productos')
    await switchTo(wrapper, 'Modo Venta')
    expect(links(wrapper)).toEqual(['/app/venta'])
  })
})

describe('AppLayout — al cambiar de modo se aterriza en la página de inicio del modo nuevo', () => {
  it('de Gestión a Venta estando en Inicio: pasa a Vender (Inicio ya no existe ahí)', async () => {
    const { wrapper, router } = await mountAt('/app', 'gestion')
    expect(router.currentRoute.value.name).toBe('AppHome')
    await switchTo(wrapper, 'Modo Venta')
    expect(router.currentRoute.value.name).toBe('Sale')
  })

  it('de Gestión a Venta estando en Reportes: pasa a Vender', async () => {
    const { wrapper, router } = await mountAt('/app/reportes', 'gestion')
    await switchTo(wrapper, 'Modo Venta')
    expect(router.currentRoute.value.name).toBe('Sale')
  })

  it('de Venta a Gestión estando en Vender: aterriza en Inicio', async () => {
    const { wrapper, router } = await mountAt('/app/venta', 'venta')
    await switchTo(wrapper, 'Modo Gestión')
    expect(router.currentRoute.value.name).toBe('AppHome')
  })

  it('de Gestión a Venta estando en Productos: no hay razón para moverlo, pero Inicio ya no es alcanzable', async () => {
    const { wrapper, router } = await mountAt('/app/productos', 'gestion')
    await switchTo(wrapper, 'Modo Venta')
    // Productos no exige Modo Gestión (solo se quitó del menú): se queda donde estaba.
    expect(router.currentRoute.value.name).toBe('ProductCatalog')
  })

  it.each(['venta', 'gestion'] as const)('en Ajustes no se le saca de la pantalla al cambiar de modo (desde %s)', async (from) => {
    const to = from === 'venta' ? 'Modo Gestión' : 'Modo Venta'
    const { wrapper, router } = await mountAt('/app/ajustes', from)
    await switchTo(wrapper, to)
    expect(router.currentRoute.value.name).toBe('Settings')
  })

  it('tocar el modo que ya está activo no navega a ningún lado', async () => {
    const { wrapper, router } = await mountAt('/app/productos', 'gestion')
    await switchTo(wrapper, 'Modo Gestión')
    expect(router.currentRoute.value.name).toBe('ProductCatalog')
  })
})
