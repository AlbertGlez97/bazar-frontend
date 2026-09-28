import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import { NAV_ITEMS, getNavItems } from '../nav-items'

/**
 * Regla de negocio (dos modos, dos menús que no se mezclan):
 * - Modo Venta: SOLO "Vender".
 * - Modo Gestión: Inicio, Productos, Reportes (solo socios) y las secciones de
 *   gestión que vengan; NUNCA "Vender".
 * Estos tests fallan si "Vender" vuelve a colarse en Gestión o si algo que no sea
 * "Vender" aparece en Venta, para cada rol y en cada variante de layout.
 */

const SELL = '/app/venta'

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

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

type Role = 'socio' | 'colaborador'
type Mode = 'venta' | 'gestion'

async function mountLayout(mode: Mode, role: Role, path = '/app') {
  localStorage.setItem('la-marchanta-ui-mode', mode)
  sessionStorage.setItem('member_context', JSON.stringify({ id: 'm-1', name: 'Ana', role, active: true }))
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{
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
    }],
  })
  router.push(path)
  await router.isReady()
  return mount(AppLayout, { global: { plugins: [createPinia(), router] } })
}

const hrefs = (wrapper: Awaited<ReturnType<typeof mountLayout>>) => wrapper.findAll('a').map((a) => a.attributes('href'))
const navLabels = (wrapper: Awaited<ReturnType<typeof mountLayout>>) =>
  wrapper.findAll('a.sidebar__link').map((l) => l.get('.sidebar__link-label').text())

describe('registro de navegación: cada ítem dice explícitamente en qué modos aparece', () => {
  it('ningún ítem queda sin `modes` (omitirlo lo dejaba en los dos modos por descuido)', () => {
    for (const item of NAV_ITEMS) {
      expect(item.modes, `${item.to} debe declarar sus modos`).toBeDefined()
      expect(item.modes!.length).toBeGreaterThan(0)
    }
  })

  it('"Vender" aparece SOLO en Modo Venta', () => {
    const sell = NAV_ITEMS.find((item) => item.to === SELL)
    expect(sell?.modes).toEqual(['venta'])
  })

  it('en Modo Venta el único ítem del registro es "Vender"', () => {
    expect(NAV_ITEMS.filter((item) => item.modes?.includes('venta')).map((item) => item.to)).toEqual([SELL])
  })

  it('ningún ítem de gestión lleva "venta" en sus modos', () => {
    for (const item of NAV_ITEMS.filter((i) => i.to !== SELL)) {
      expect(item.modes).toEqual(['gestion'])
    }
  })
})

describe('getNavItems, por modo y por rol', () => {
  it.each([true, false, undefined])('Modo Gestión (isSocio=%s): nunca "Vender"', (isSocio) => {
    expect(getNavItems('gestion', { isSocio }).map((i) => i.to)).not.toContain(SELL)
  })

  it.each([true, false, undefined])('Modo Venta (isSocio=%s): exactamente "Vender"', (isSocio) => {
    expect(getNavItems('venta', { isSocio }).map((i) => i.to)).toEqual([SELL])
  })

  it('Modo Gestión: un socio ve Inicio, Productos, Reportes y Códigos QR, en ese orden', () => {
    expect(getNavItems('gestion', { isSocio: true }).map((i) => i.to)).toEqual(['/app', '/app/productos', '/app/reportes', '/app/codigos-qr'])
  })

  it('Modo Gestión: un colaborador ve Inicio y Productos', () => {
    expect(getNavItems('gestion', { isSocio: false }).map((i) => i.to)).toEqual(['/app', '/app/productos'])
  })
})

describe('AppLayout (todo lo que dibuja: menú lateral, enlaces del pie y de la barra superior)', () => {
  it.each(['socio', 'colaborador'] as Role[])('Modo Gestión (%s): ningún enlace de la pantalla lleva a Vender', async (role) => {
    const wrapper = await mountLayout('gestion', role)
    expect(hrefs(wrapper)).not.toContain(SELL)
    expect(navLabels(wrapper)).not.toContain('Vender')
    // El selector de modo también usa 🛒 (botón "Modo Venta"): se mira solo el menú.
    expect(wrapper.find('.sidebar__nav').text()).not.toMatch(/🛒|Vender/)
  })

  it.each(['socio', 'colaborador'] as Role[])('Modo Venta (%s): el menú es exactamente "Vender"', async (role) => {
    const wrapper = await mountLayout('venta', role)
    expect(navLabels(wrapper)).toEqual(['Vender'])
    // Nada de gestión en el menú.
    expect(wrapper.find('.sidebar__nav').text()).not.toMatch(/Inicio|Productos|Reportes/)
  })

  it('Modo Gestión (socio): Inicio, Productos, Reportes y Códigos QR', async () => {
    const wrapper = await mountLayout('gestion', 'socio')
    expect(navLabels(wrapper)).toEqual(['Inicio', 'Productos', 'Reportes', 'Códigos QR'])
  })

  it('Modo Gestión (colaborador): Inicio y Productos, sin Reportes', async () => {
    const wrapper = await mountLayout('gestion', 'colaborador')
    expect(navLabels(wrapper)).toEqual(['Inicio', 'Productos'])
  })

  it.each(['socio', 'colaborador'] as Role[])('al cambiar de Venta a Gestión (%s) "Vender" sale del menú en el momento', async (role) => {
    const wrapper = await mountLayout('venta', role)
    expect(navLabels(wrapper)).toEqual(['Vender'])
    await wrapper.get('.sidebar__mode button[aria-label="Modo Gestión"]').trigger('click')
    expect(navLabels(wrapper)).not.toContain('Vender')
    expect(hrefs(wrapper)).not.toContain(SELL)
  })

  it.each(['socio', 'colaborador'] as Role[])('al cambiar de Gestión a Venta (%s) el menú queda solo en "Vender"', async (role) => {
    const wrapper = await mountLayout('gestion', role)
    await wrapper.get('.sidebar__mode button[aria-label="Modo Venta"]').trigger('click')
    expect(navLabels(wrapper)).toEqual(['Vender'])
  })

  it('con el menú lateral colapsado o expandido la lista es la misma (solo cambia cómo se dibuja)', async () => {
    for (const mode of ['venta', 'gestion'] as Mode[]) {
      const wrapper = await mountLayout(mode, 'socio')
      // Colapsado no se dibuja la etiqueta, solo el ícono: se compara por ruta.
      const links = () => wrapper.findAll('a.sidebar__link').map((l) => l.attributes('href'))
      const before = links()
      await wrapper.get('.sidebar__toggle').trigger('click')
      expect(links()).toEqual(before)
      expect(links()).not.toContain(mode === 'gestion' ? SELL : '/app')
    }
  })
})
