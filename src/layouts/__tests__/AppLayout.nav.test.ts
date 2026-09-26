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

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

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
          { path: 'reportes', name: 'Reports', component: stub },
          { path: 'ajustes', name: 'Settings', component: stub },
          { path: 'ajustes/contrasena', name: 'ChangePassword', component: stub },
          { path: 'ajustes/equipo', name: 'Team', component: stub },
          { path: 'ajustes/dispositivos', name: 'DevicesAdmin', component: stub },
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

  it('Reportes: solo un socio en Modo Gestión lo ve, y va al final', async () => {
    sessionStorage.setItem('member_context', JSON.stringify({ id: 'm-1', name: 'Ana', role: 'socio', active: true }))
    localStorage.setItem('la-marchanta-ui-mode', 'gestion')
    const wrapper = await mountAt('/app')
    expect(linkLabels(wrapper)).toEqual(['🏠 Inicio', '📦 Productos', '🛒 Vender', '📊 Reportes'])
    expect(wrapper.findAll('a.sidebar__link').at(-1)?.attributes('href')).toBe('/app/reportes')
  })

  it('Reportes no aparece para un socio en Modo Venta', async () => {
    sessionStorage.setItem('member_context', JSON.stringify({ id: 'm-1', name: 'Ana', role: 'socio', active: true }))
    localStorage.setItem('la-marchanta-ui-mode', 'venta')
    const wrapper = await mountAt('/app')
    expect(wrapper.find('.sidebar__nav').text()).not.toMatch(/Reportes/)
  })

  it('Reportes no aparece para un colaborador, ni en Gestión ni en Venta', async () => {
    sessionStorage.setItem('member_context', JSON.stringify({ id: 'm-2', name: 'Carlos', role: 'colaborador', active: true }))
    for (const mode of ['venta', 'gestion']) {
      localStorage.setItem('la-marchanta-ui-mode', mode)
      const wrapper = await mountAt('/app')
      expect(wrapper.find('.sidebar__nav').text()).not.toMatch(/Reportes/)
    }
  })

  it('en /app/reportes solo "Reportes" está activo y el título de la barra es "Reportes"', async () => {
    sessionStorage.setItem('member_context', JSON.stringify({ id: 'm-1', name: 'Ana', role: 'socio', active: true }))
    localStorage.setItem('la-marchanta-ui-mode', 'gestion')
    const wrapper = await mountAt('/app/reportes')
    expect(activeLabels(wrapper)).toHaveLength(1)
    expect(activeLabels(wrapper)[0]).toContain('Reportes')
    expect(wrapper.get('.app-header__title').text()).toBe('Reportes')
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

describe('AppLayout engrane de ajustes (junto al nombre)', () => {
  const socio = { id: 'm-1', name: 'Ana', role: 'socio', active: true }
  const colaborador = { id: 'm-2', name: 'Carlos', role: 'colaborador', active: true }

  it.each([['socio', socio], ['colaborador', colaborador]])('lo ve %s, en el pie junto al nombre y antes de cerrar sesión', async (_role, member) => {
    sessionStorage.setItem('member_context', JSON.stringify(member))
    const wrapper = await mountAt('/app')
    const footer = wrapper.get('.sidebar__footer')
    const gear = footer.get('a.sidebar__settings')
    expect(gear.attributes('href')).toBe('/app/ajustes')
    // orden en el pie: avatar, nombre, engrane, cerrar sesión
    const known = ['sidebar__user', 'sidebar__settings', 'sidebar__logout']
    const order = footer.findAll('.sidebar__user, .sidebar__settings, .sidebar__logout').map((n) => n.classes().find((c) => known.includes(c)))
    expect(order).toEqual(['sidebar__user', 'sidebar__settings', 'sidebar__logout'])
  })

  it('tiene nombre accesible ("Ajustes") y el ícono es decorativo', async () => {
    const wrapper = await mountAt('/app')
    const gear = wrapper.get('a.sidebar__settings')
    expect(gear.attributes('aria-label')).toBe('Ajustes')
    expect(gear.attributes('title')).toBe('Ajustes')
    expect(gear.get('[aria-hidden="true"]').text()).toBe('⚙️')
  })

  it('con el sidebar colapsado (el estado normal en un celular) sigue estando a la mano', async () => {
    const wrapper = await mountAt('/app')
    await wrapper.get('.sidebar__toggle').trigger('click')
    const gear = wrapper.get('a.sidebar__settings')
    expect(gear.attributes('aria-label')).toBe('Ajustes')
    expect(gear.attributes('href')).toBe('/app/ajustes')
  })

  it('no es parte de la navegación principal (no cambia los enlaces de arriba)', async () => {
    const wrapper = await mountAt('/app')
    expect(wrapper.findAll('a.sidebar__link')).toHaveLength(3)
    expect(wrapper.find('.sidebar__nav a.sidebar__settings').exists()).toBe(false)
  })

  it('en /app/ajustes queda marcado como activo, y solo él', async () => {
    const wrapper = await mountAt('/app/ajustes')
    expect(wrapper.get('a.sidebar__settings').classes()).toContain('sidebar__settings--active')
    expect(activeLabels(wrapper)).toEqual([])
  })

  it('en una subpantalla de ajustes sigue activo', async () => {
    const wrapper = await mountAt('/app/ajustes/contrasena')
    expect(wrapper.get('a.sidebar__settings').classes()).toContain('sidebar__settings--active')
  })

  it('fuera de ajustes no está activo', async () => {
    const wrapper = await mountAt('/app/productos')
    expect(wrapper.get('a.sidebar__settings').classes()).not.toContain('sidebar__settings--active')
  })

  it('se puede llegar con el teclado: es un enlace real', async () => {
    const wrapper = await mountAt('/app')
    expect(wrapper.get('a.sidebar__settings').element.tagName).toBe('A')
  })

  it('títulos de la barra superior: "Ajustes" y "Cambiar mi contraseña"', async () => {
    const settings = await mountAt('/app/ajustes')
    expect(settings.get('.app-header__title').text()).toBe('Ajustes')
    const password = await mountAt('/app/ajustes/contrasena')
    expect(password.get('.app-header__title').text()).toBe('Cambiar mi contraseña')
    const team = await mountAt('/app/ajustes/equipo')
    expect(team.get('.app-header__title').text()).toBe('Mi equipo')
    expect(team.get('a.sidebar__settings').classes()).toContain('sidebar__settings--active')
    const devices = await mountAt('/app/ajustes/dispositivos')
    expect(devices.get('.app-header__title').text()).toBe('Dispositivos')
    expect(devices.get('a.sidebar__settings').classes()).toContain('sidebar__settings--active')
  })
})
