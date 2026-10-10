import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session.store'
import { useUiModeStore } from '@/stores/uiMode.store'
import { closeHelpDrawer, openHelpDrawer } from '@/composables/useHelp'
import HelpView from '@/views/help/HelpView.vue'
import AppLayout from '../AppLayout.vue'

vi.mock('@/stores/sales-queue.store', () => ({ useSalesQueueStore: () => ({
  pendingCount: 0, needsReviewCount: 0, needsReviewRecords: [], isSyncing: false,
  start: vi.fn(), stop: vi.fn(), dismissReview: vi.fn(),
}) }))

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(() => {
  closeHelpDrawer()
  document.body.innerHTML = ''
  document.body.style.overflow = ''
})

const stub = { template: '<div />' }
const ROUTES = [
  ['/app', 'AppHome'],
  ['/app/productos', 'ProductCatalog'],
  ['/app/venta', 'Sale'],
  ['/app/finanzas', 'Contributions'],
  ['/app/finanzas/resumen', 'FinanceOverview'],
  ['/app/finanzas/gastos', 'Expenses'],
  ['/app/finanzas/jornadas', 'WorkShifts'],
  ['/app/finanzas/reservas', 'FinanceReserves'],
  ['/app/finanzas/simulador', 'FinanceSimulator'],
  ['/app/finanzas/acuerdos', 'FinanceAgreements'],
  ['/app/finanzas/acuerdos/:id', 'FinanceAgreementDetail'],
  ['/app/reportes', 'Reports'],
  ['/app/deudas', 'Deudas'],
  ['/app/ajustes', 'Settings'],
] as const

async function mountAt(path: string, options: { role?: 'socio' | 'colaborador'; mode?: 'venta' | 'gestion'; realHelp?: boolean } = {}) {
  const pinia = createPinia()
  useSessionStore(pinia).setMember({ id: 'm', name: 'Fixture', role: options.role ?? 'socio', active: true })
  useUiModeStore(pinia).setMode(options.mode ?? 'gestion')
  const router = createRouter({ history: createMemoryHistory(), routes: [
    ...ROUTES.map(([routePath, name]) => ({ path: routePath, name, component: stub })),
    { path: '/app/ayuda', name: 'Help', component: options.realHelp ? HelpView : stub },
  ] })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(AppLayout, { attachTo: document.body, global: { plugins: [pinia, router], stubs: { InstallAppButton: true } } })
  await flushPromises()
  return { wrapper, router, pinia }
}

const helpButton = (wrapper: Awaited<ReturnType<typeof mountAt>>['wrapper']) => wrapper.get('.app-header button[aria-label="Ayuda"]')
const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]')
const dialogTitle = () => dialog()?.querySelector('h2')?.textContent?.trim()
const drawerArticleIds = () => [...(dialog()?.querySelectorAll('article[id]') ?? [])].map((node) => node.id.replace(/^drawer-/, ''))

describe('shared help entry', () => {
  it.each(['socio', 'colaborador'] as const)('is a button available to %s in both modes even with collapsed sidebar', async (role) => {
    for (const mode of ['gestion', 'venta'] as const) {
      const { wrapper, pinia } = await mountAt('/app/productos', { role, mode })
      await wrapper.get('.sidebar__toggle').trigger('click')
      const button = helpButton(wrapper)
      expect(button.element.tagName).toBe('BUTTON')
      expect(button.attributes('type')).toBe('button')
      expect(button.attributes('aria-haspopup')).toBe('dialog')
      expect(button.attributes('aria-expanded')).toBe('false')
      expect(button.text()).toContain('Ayuda')
      expect(wrapper.find('.app-header a[aria-label="Ayuda"]').exists()).toBe(false)
      expect(wrapper.find('.sidebar__nav a[href*="ayuda"]').exists()).toBe(false)
      await button.trigger('click')
      await flushPromises()
      expect(dialog()).not.toBeNull()
      expect(button.attributes('aria-expanded')).toBe('true')
      expect(dialogTitle()).toBe('Productos')
      expect(useUiModeStore(pinia).currentMode).toBe(mode)
      expect(wrapper.get('.app-header__title').text()).toBe('Productos')
      wrapper.unmount()
      document.body.innerHTML = ''
    }
  })

  it.each(['socio', 'colaborador'] as const)('shows every article with its audience badge to a %s in the drawer', async (role) => {
    const { wrapper } = await mountAt('/app/finanzas/gastos', { role })
    await helpButton(wrapper).trigger('click')
    await flushPromises()
    expect(drawerArticleIds()).toEqual(['gastos', 'corregir-gasto'])
    expect(dialog()!.textContent!.match(/Solo socios/g)).toHaveLength(2)
    wrapper.unmount()
  })
})

describe('quick help drawer: context per route', () => {
  it.each([
    ['/app', 'Primeros pasos'],
    ['/app/venta', 'Ventas'],
    ['/app/productos', 'Productos'],
    ['/app/deudas', 'Fiados y apartados'],
    ['/app/reportes', 'Reportes'],
    ['/app/ajustes', 'Dispositivos y sesión'],
    ['/app/finanzas', 'Aportaciones'],
    ['/app/finanzas/resumen', 'Resumen'],
    ['/app/finanzas/gastos', 'Gastos'],
    ['/app/finanzas/jornadas', 'Jornadas'],
    ['/app/finanzas/reservas', 'Reservas'],
    ['/app/finanzas/simulador', 'Simulador'],
    ['/app/finanzas/acuerdos', 'Acuerdos'],
    ['/app/finanzas/acuerdos/abc-123', 'Acuerdos'],
  ])('%s opens %s', async (path, title) => {
    const { wrapper } = await mountAt(path)
    await helpButton(wrapper).trigger('click')
    await flushPromises()
    expect(dialogTitle()).toBe(title)
    wrapper.unmount()
  })

  it('shows all the articles of a category when the route has no specific topic (Ventas)', async () => {
    const { wrapper } = await mountAt('/app/venta')
    await helpButton(wrapper).trigger('click')
    await flushPromises()
    expect(drawerArticleIds().sort()).toEqual(['carrito', 'efectivo', 'escanear', 'primera-venta'])
    expect(dialog()!.querySelector('[aria-expanded="true"]')?.getAttribute('data-item-id')).toBe('primera-venta')
    wrapper.unmount()
  })

  it('shows the topic articles as compact accordions with the first one expanded', async () => {
    const { wrapper } = await mountAt('/app/finanzas/jornadas')
    await helpButton(wrapper).trigger('click')
    await flushPromises()
    const triggers = [...dialog()!.querySelectorAll('button[aria-expanded]')]
    expect(triggers.map((item) => item.getAttribute('data-item-id'))).toEqual(['jornadas', 'jornadas-preguntas'])
    expect(triggers.map((item) => item.getAttribute('aria-expanded'))).toEqual(['true', 'false'])
    expect(dialog()!.textContent).toContain('Registrar quién trabajó')
    wrapper.unmount()
  })

  it('offers the related topics of the agreement screen (Pagos) and leaves for them', async () => {
    const { wrapper, router } = await mountAt('/app/finanzas/acuerdos/abc-123')
    await helpButton(wrapper).trigger('click')
    await flushPromises()
    const related = [...dialog()!.querySelectorAll<HTMLAnchorElement>('.help-drawer__related-link')]
    expect(related.map((item) => item.textContent?.trim())).toEqual(['Pagos'])
    related[0]!.click()
    await flushPromises()
    expect(router.currentRoute.value.query).toMatchObject({ topic: 'finanzas.pagos', from: '/app/finanzas/acuerdos/abc-123' })
    expect(dialog()).toBeNull()
    wrapper.unmount()
  })

  it('opens on a specific article with openHelpDrawer(path) for future inline help', async () => {
    const { wrapper } = await mountAt('/app/productos')
    openHelpDrawer('finanzas.jornadas.corregir')
    await flushPromises()
    expect(dialogTitle()).toBe('Jornadas')
    expect(dialog()!.querySelector('[data-item-id="jornadas"]')?.getAttribute('aria-expanded')).toBe('true')
    expect(dialog()!.querySelector('[data-item-id="jornadas-preguntas"]')?.getAttribute('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('is a single dialog instance that follows the route it is opened from', async () => {
    const { wrapper, router } = await mountAt('/app/venta')
    await helpButton(wrapper).trigger('click')
    await flushPromises()
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
    await router.push('/app/deudas')
    await flushPromises()
    expect(dialog()).toBeNull()
    await helpButton(wrapper).trigger('click')
    await flushPromises()
    expect(dialogTitle()).toBe('Fiados y apartados')
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
    wrapper.unmount()
  })
})

describe('quick help drawer: interaction', () => {
  it('names itself, closes with Escape and returns focus to the ? button', async () => {
    const { wrapper } = await mountAt('/app/finanzas/jornadas')
    const button = helpButton(wrapper)
    ;(button.element as HTMLButtonElement).focus()
    await button.trigger('click')
    await flushPromises()
    const el = dialog()!
    expect(el.getAttribute('aria-modal')).toBe('true')
    expect(document.getElementById(el.getAttribute('aria-labelledby')!)?.textContent).toContain('Jornadas')
    expect(el.contains(document.activeElement)).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(dialog()).toBeNull()
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(button.element)
    wrapper.unmount()
  })

  it('returns focus to the ? button even if the browser did not focus it on click', async () => {
    const { wrapper } = await mountAt('/app/finanzas/jornadas')
    const button = helpButton(wrapper)
    ;(document.activeElement as HTMLElement | null)?.blur()
    await button.trigger('click')
    await flushPromises()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(document.activeElement).toBe(button.element)
    wrapper.unmount()
  })

  it('closes from the close button and from the backdrop', async () => {
    const { wrapper } = await mountAt('/app/venta')
    await helpButton(wrapper).trigger('click')
    await flushPromises()
    document.body.querySelector<HTMLButtonElement>('button[aria-label="Cerrar ayuda"]')!.click()
    await flushPromises()
    expect(dialog()).toBeNull()
    await helpButton(wrapper).trigger('click')
    await flushPromises()
    document.body.querySelector<HTMLElement>('.app-drawer__backdrop')!.click()
    await flushPromises()
    expect(dialog()).toBeNull()
    wrapper.unmount()
  })

  it('locks the page scroll while open and restores it on close', async () => {
    const { wrapper } = await mountAt('/app/venta')
    await helpButton(wrapper).trigger('click')
    await flushPromises()
    expect(document.body.style.overflow).toBe('hidden')
    document.body.querySelector<HTMLButtonElement>('button[aria-label="Cerrar ayuda"]')!.click()
    await flushPromises()
    expect(document.body.style.overflow).toBe('')
    wrapper.unmount()
  })

  it('"Ver toda la ayuda" opens the Center on the same topic, remembering the screen, and closes the drawer', async () => {
    const { wrapper, router } = await mountAt('/app/finanzas/jornadas', { realHelp: true })
    await helpButton(wrapper).trigger('click')
    await flushPromises()
    const cta = document.body.querySelector<HTMLAnchorElement>('[data-action="open-center"]')!
    expect(cta.textContent).toContain('Ver toda la ayuda')
    expect(cta.getAttribute('href')).toContain('topic=finanzas.jornadas')
    cta.click()
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('Help')
    expect(router.currentRoute.value.query).toMatchObject({ topic: 'finanzas.jornadas', from: '/app/finanzas/jornadas' })
    expect(dialog()).toBeNull()
    expect(document.body.style.overflow).toBe('')
    // The Center shows the topic and "Volver" goes back to the screen.
    expect(wrapper.get('.help-center__main h2').text()).toBe('Jornadas')
    await wrapper.get('[data-action="return"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('WorkShifts')
    wrapper.unmount()
  })

  it('"Ver toda la ayuda" keeps the article of a targeted drawer', async () => {
    const { wrapper, router } = await mountAt('/app/productos', { realHelp: true })
    openHelpDrawer('finanzas.jornadas.corregir')
    await flushPromises()
    document.body.querySelector<HTMLAnchorElement>('[data-action="open-center"]')!.click()
    await flushPromises()
    expect(router.currentRoute.value.query).toMatchObject({ topic: 'finanzas.jornadas', article: 'jornadas', from: '/app/productos' })
    wrapper.unmount()
  })

  it('does not offer the drawer on the Help page itself', async () => {
    const { wrapper } = await mountAt('/app/ayuda')
    expect(wrapper.find('.app-header__help').exists()).toBe(false)
    expect(openHelpDrawer()).toBe(false)
    await flushPromises()
    expect(dialog()).toBeNull()
    wrapper.unmount()
  })

  it('has no drawer when the layout is gone, even if it was open', async () => {
    const { wrapper } = await mountAt('/app/venta')
    await helpButton(wrapper).trigger('click')
    await flushPromises()
    wrapper.unmount()
    await flushPromises()
    expect(dialog()).toBeNull()
    expect(document.body.style.overflow).toBe('')
  })
})
