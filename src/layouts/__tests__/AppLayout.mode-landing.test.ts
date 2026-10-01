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
        { path: 'codigos-qr', name: 'CodigosQr', component: stub },
        { path: 'incidencias', name: 'Incidencias', component: stub },
        { path: 'deudas', name: 'Deudas', component: stub },
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

  it('Modo Gestión: Inicio, Productos y (socio) Reportes, Códigos QR, Incidencias y Deudas, sin Vender', async () => {
    const { wrapper } = await mountAt('/app/productos', 'gestion')
    expect(links(wrapper)).toEqual(['/app', '/app/productos', '/app/reportes', '/app/codigos-qr', '/app/incidencias', '/app/deudas'])
  })

  it('Modo Gestión: un colaborador no ve Reportes', async () => {
    const { wrapper } = await mountAt('/app/productos', 'gestion', 'colaborador')
    expect(links(wrapper)).toEqual(['/app', '/app/productos'])
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

describe('AppLayout mode-change navigation', () => {
  it.each([
    ['/app', 'Inicio'], ['/app/productos', 'Productos'], ['/app/reportes', 'Reportes'],
    ['/app/codigos-qr', 'Códigos QR'], ['/app/incidencias', 'Incidencias'], ['/app/deudas', 'Deudas'],
  ])('switching from %s immediately lands in Sale with consistent shell state', async (path, title) => {
    const { wrapper, router } = await mountAt(path, 'gestion')
    expect(wrapper.get('.app-header__title').text()).toBe(title)
    expect(wrapper.get('.app-header__mode').text()).toBe('Modo Gestión')
    expect(wrapper.get('.sidebar__nav [aria-current="page"]').attributes('href')).toBe(path)
    await switchTo(wrapper, 'Modo Venta')
    expect(router.currentRoute.value.fullPath).toBe('/app/venta')
    expect(wrapper.get('.app-header__title').text()).toBe('Vender')
    expect(wrapper.get('.app-header__mode').text()).toBe('Modo Venta')
    expect(wrapper.get('button[aria-label="Modo Venta"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('.sidebar__nav [aria-current="page"]').attributes('href')).toBe('/app/venta')
    await switchTo(wrapper, 'Modo Gestión')
    expect(router.currentRoute.value.fullPath).toBe('/app')
    expect(wrapper.get('.app-header__title').text()).toBe('Inicio')
    expect(wrapper.get('.app-header__mode').text()).toBe('Modo Gestión')
    expect(wrapper.get('button[aria-label="Modo Gestión"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('.sidebar__nav [aria-current="page"]').attributes('href')).toBe('/app')
  })

  it.each(['venta', 'gestion'] as const)('switching from Settings in %s lands at the new mode default', async (from) => {
    const { wrapper, router } = await mountAt('/app/ajustes', from)
    await switchTo(wrapper, from === 'venta' ? 'Modo Gestión' : 'Modo Venta')
    expect(router.currentRoute.value.fullPath).toBe(from === 'venta' ? '/app' : '/app/venta')
  })

  it('Vender remains a usable return destination from Settings in Sale mode', async () => {
    const { wrapper, router } = await mountAt('/app/ajustes', 'venta')
    await wrapper.get('.sidebar__nav a[href="/app/venta"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/app/venta')
    expect(wrapper.get('.sidebar__nav [aria-current="page"]').text()).toContain('Vender')
  })

  it.each(['venta', 'gestion'] as const)('mounting in %s preserves the current URL', async (mode) => {
    const { router } = await mountAt('/app/productos', mode)
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/app/productos')
  })


  it('clicking the active mode does not navigate', async () => {
    const { wrapper, router } = await mountAt('/app/productos', 'gestion')
    await switchTo(wrapper, 'Modo Gestión')
    expect(router.currentRoute.value.fullPath).toBe('/app/productos')
  })
})
