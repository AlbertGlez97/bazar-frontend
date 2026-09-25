import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { APP_NAME } from '@/config/app'
import AppLayout from '@/layouts/AppLayout.vue'

// A diferencia de AppLayout.test.ts (que mockea vue-router), aquí se usa un
// router real: el estado activo de los enlaces depende de cómo vue-router
// compara rutas, y un mock no puede detectar que "Inicio" siga resaltado.
// La cola de ventas (IndexedDB, red) no es asunto de estas pruebas.
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
  // Reales: el selector de modo y su indicador no dependen de nada externo
  AppBadge:         (await import('@/components/ui/atoms/AppBadge.vue')).default,
  UiModeSwitch:     (await import('@/components/ui/organisms/UiModeSwitch.vue')).default,
  SyncStatusIndicator: (await import('@/components/ui/organisms/SyncStatusIndicator.vue')).default,
}))

beforeEach(() => localStorage.clear())

async function mountAt(path: string) {
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      // Misma forma que router/index.ts: 'Inicio' es el hijo con path '' del
      // padre '/app'. Con esa forma vue-router considera activo el enlace a
      // '/app' también en '/app/productos', salvo que se compare exacto.
      {
        path: '/app',
        component: { render: () => h(RouterView) },
        children: [
          { path: '', name: 'AppHome', component: stub },
          { path: 'productos', name: 'ProductCatalog', component: stub },
          { path: 'venta', name: 'Sale', component: stub },
        ],
      },
    ],
  })
  router.push(path)
  await router.isReady()
  return mount(AppLayout, { global: { plugins: [createPinia(), router] } })
}

const activeLabels = (wrapper: Awaited<ReturnType<typeof mountAt>>) =>
  wrapper.findAll('.sidebar__link--active').map((l) => l.text())

const linkLabels = (wrapper: Awaited<ReturnType<typeof mountAt>>) =>
  wrapper.findAll('a.sidebar__link').map((l) => `${l.get('.sidebar__link-icon').text()} ${l.get('.sidebar__link-label').text()}`)

describe('AppLayout navegación', () => {
  it('Modo Gestión: Inicio, Productos y después Vender', async () => {
    localStorage.setItem('la-marchanta-ui-mode', 'gestion')
    const wrapper = await mountAt('/app')
    expect(linkLabels(wrapper)).toEqual(['🏠 Inicio', '📦 Productos', '🛒 Vender'])
  })

  it('Modo Venta: Vender va primero', async () => {
    localStorage.setItem('la-marchanta-ui-mode', 'venta')
    const wrapper = await mountAt('/app')
    expect(linkLabels(wrapper)).toEqual(['🛒 Vender', '🏠 Inicio', '📦 Productos'])
  })

  it('Vender siempre está a la vista, en cualquier modo', async () => {
    for (const mode of ['venta', 'gestion']) {
      localStorage.setItem('la-marchanta-ui-mode', mode)
      const wrapper = await mountAt('/app')
      expect(linkLabels(wrapper).some((label) => label.includes('Vender'))).toBe(true)
    }
  })

  it('cambiar de modo reordena el menú en el momento', async () => {
    localStorage.setItem('la-marchanta-ui-mode', 'gestion')
    const wrapper = await mountAt('/app')
    await wrapper.get('.sidebar__mode button[aria-label="Modo Venta"]').trigger('click')
    expect(linkLabels(wrapper)[0]).toContain('Vender')
  })

  it('en /app/venta solo "Vender" está activo, no "Inicio"', async () => {
    const wrapper = await mountAt('/app/venta')
    expect(activeLabels(wrapper)).toHaveLength(1)
    expect(activeLabels(wrapper)[0]).toContain('Vender')
  })

  it('el título de la barra superior en /app/venta es "Vender"', async () => {
    const wrapper = await mountAt('/app/venta')
    expect(wrapper.get('.app-header__title').text()).toBe('Vender')
  })

  it('Modo Venta y Modo Gestión no ofrecen aún un ítem de Reportes (lo agrega otro cambio)', async () => {
    for (const mode of ['venta', 'gestion']) {
      localStorage.setItem('la-marchanta-ui-mode', mode)
      const wrapper = await mountAt('/app')
      expect(wrapper.find('.sidebar__nav').text()).not.toMatch(/Reportes/)
    }
  })

  it('muestra los enlaces a Inicio y Productos con sus rutas', async () => {
    const wrapper = await mountAt('/app')
    const links = wrapper.findAll('a.sidebar__link')
    expect(links).toHaveLength(3)
    expect(links.find((l) => l.text().includes('Vender'))?.attributes('href')).toBe('/app/venta')
    expect(links.find((l) => l.text().includes('Productos'))?.attributes('href')).toBe('/app/productos')
    expect(links.find((l) => l.text().includes('Inicio'))?.attributes('href')).toBe('/app')
  })

  it('en /app solo "Inicio" está activo', async () => {
    const wrapper = await mountAt('/app')
    expect(activeLabels(wrapper)).toHaveLength(1)
    expect(activeLabels(wrapper)[0]).toContain('Inicio')
  })

  it('en /app/productos solo "Productos" está activo, no "Inicio"', async () => {
    const wrapper = await mountAt('/app/productos')
    expect(activeLabels(wrapper)).toHaveLength(1)
    expect(activeLabels(wrapper)[0]).toContain('Productos')
  })

  it('el título de la barra superior en /app/productos es "Productos"', async () => {
    const wrapper = await mountAt('/app/productos')
    expect(wrapper.find('.app-header__title').text()).toBe('Productos')
  })

  it('el logo enlaza al inicio de la app y muestra el nombre sin emoji', async () => {
    const wrapper = await mountAt('/app/productos')
    const brand = wrapper.get('a.sidebar__brand')
    expect(brand.attributes('href')).toBe('/app')
    expect(brand.text()).toBe(APP_NAME)
    expect(wrapper.text()).not.toContain('💰')
  })

  it('con el sidebar colapsado el logo sigue siendo un enlace con nombre accesible', async () => {
    const wrapper = await mountAt('/app')
    await wrapper.get('.sidebar__toggle').trigger('click')
    const brand = wrapper.get('a.sidebar__brand')
    expect(brand.attributes('href')).toBe('/app')
    expect(brand.attributes('aria-label')).toBe(APP_NAME)
    // Colapsado solo queda el isotipo (sin texto): el nombre lo da el aria-label
    expect(brand.text()).toBe('')
    expect(brand.find('svg').exists()).toBe(true)
    expect(brand.find('.brand-logo__name').exists()).toBe(false)
  })

  it('expandido el logo muestra isotipo y nombre en la tipografía de marca', async () => {
    const wrapper = await mountAt('/app')
    const brand = wrapper.get('a.sidebar__brand')
    expect(brand.find('svg').exists()).toBe(true)
    expect(brand.get('.brand-logo__name').text()).toBe(APP_NAME)
    expect(brand.attributes('aria-label')).toBe(APP_NAME)
  })

  it('la fecha lleva mayúscula solo al inicio (no "De" en medio)', async () => {
    const wrapper = await mountAt('/app')
    const date = wrapper.get('.app-header__date').text()
    expect(date).toMatch(/^[A-ZÁÉÍÓÚ]/)
    expect(date).not.toMatch(/ De /)
  })

  it('al hacer clic en el logo desde otra vista vuelve a /app', async () => {
    const wrapper = await mountAt('/app/productos')
    await wrapper.get('a.sidebar__brand').trigger('click')
    await flushPromises()
    expect(wrapper.find('.app-header__title').text()).toBe('Inicio')
  })
})
