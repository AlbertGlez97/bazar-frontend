import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import layoutSource from '../AppLayout.vue?raw'
import AppLayout from '@/layouts/AppLayout.vue'
import { useSessionStore } from '@/stores/session.store'
import type { Member } from '@/types/member.types'
import AppNavDrawer from '@/components/ui/organisms/AppNavDrawer.vue'
import { SMALL_SCREEN_MAX_WIDTH, SMALL_SCREEN_QUERY } from '@/composables/useDeviceCapabilities'

// Bajo 900 px (teléfono y tablet vertical) NO hay barra lateral: una barra
// superior con el título y "Ayuda"; el socio abre un cajón con el menú y el
// colaborador solo ve Ayuda y "Salir". Desde 900 px todo sigue como siempre.

vi.mock('@/stores/sales-queue.store', () => ({
  useSalesQueueStore: () => ({
    pendingCount: 0, needsReviewCount: 0, needsReviewRecords: [], isSyncing: false, incompatibleCount: 0,
    start: vi.fn(), stop: vi.fn(), dismissReview: vi.fn(),
  }),
}))

const socio: Member = { id: 'm-1', name: 'Ana', role: 'socio', active: true }
const colaborador: Member = { id: 'm-2', name: 'Carlos', role: 'colaborador', active: true }

const TEST_IDENTITY = 'a.' + btoa(JSON.stringify({ sub: 'account-a' })) + '.z'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  // Sesión de la cuenta A en este dispositivo: sin esto el miembro guardado no se acepta.
  localStorage.setItem('access_token', TEST_IDENTITY)
  localStorage.setItem('token_expires_at', String(Date.now() + 60000))
  localStorage.setItem('device_context_owner', JSON.stringify({ accountId: 'account-a', apiBase: '/api/v1' }))
})

afterEach(() => {
  document.body.innerHTML = ''
  document.body.style.overflow = ''
})

/** `small`: el viewport está bajo 900 px (la consulta de pantalla pequeña coincide). */
async function mountLayout(options: { small: boolean; member?: Member; mode?: 'venta' | 'gestion'; path?: string }) {
  const { small, member = socio, mode = 'venta', path = '/app/venta' } = options
  localStorage.setItem('la-marchanta-ui-mode', mode)
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: small && query === SMALL_SCREEN_QUERY, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn(),
  }))
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'Login', component: stub },
      {
        path: '/app', component: { render: () => h(RouterView) },
        children: [
          { path: '', name: 'AppHome', component: stub },
          { path: 'venta', name: 'Sale', component: stub },
          { path: 'productos', name: 'ProductCatalog', component: stub },
          { path: 'ajustes', name: 'Settings', component: stub },
          { path: 'ajustes/contrasena', name: 'ChangePassword', component: stub },
          { path: 'ayuda', name: 'Help', component: stub },
        ],
      },
    ],
  })
  await router.push(path)
  // La persona es la de la cuenta (la fija auth.store con /auth/me): aquí se pone directo en la sesión.
  const pinia = createPinia()
  useSessionStore(pinia).setMember(member)
  const wrapper = mount(AppLayout, { attachTo: document.body, global: { plugins: [pinia, router] } })
  await flushPromises()
  return { wrapper, router }
}

const drawer = () => document.body.querySelector<HTMLElement>('[role="dialog"][aria-labelledby]')
const accountAction = (name: string) => document.body.querySelector<HTMLButtonElement>(`[data-action="${name}"]`)!

describe('AppLayout — el umbral es el de pantalla pequeña (900 px)', () => {
  it('usa SMALL_SCREEN_MAX_WIDTH = 900 y no un breakpoint propio', () => {
    expect(SMALL_SCREEN_MAX_WIDTH).toBe(900)
    expect(SMALL_SCREEN_QUERY).toBe('(max-width: 899.98px)')
  })
})

describe('AppLayout — pantalla ancha (900 px o más)', () => {
  it('conserva la barra lateral y no muestra la barra superior', async () => {
    const { wrapper } = await mountLayout({ small: false })

    expect(wrapper.find('aside.sidebar').exists()).toBe(true)
    expect(wrapper.find('.app-top-bar').exists()).toBe(false)
    expect(wrapper.find('.app-header').exists()).toBe(true)
    wrapper.unmount()
  })
})

describe('AppLayout — pantalla pequeña (bajo 900 px)', () => {
  it('no hay barra lateral; hay barra superior con el título y "Ayuda" con texto', async () => {
    const { wrapper } = await mountLayout({ small: true })

    expect(wrapper.find('aside.sidebar').exists()).toBe(false)
    expect(wrapper.get('.app-top-bar__title').text()).toBe('Vender')
    expect(wrapper.get('.app-top-bar__help').text()).toContain('Ayuda')
    wrapper.unmount()
  })

  it('el contenido ocupa todo el ancho (sin columna de barra lateral ni margen reservado)', async () => {
    const { wrapper } = await mountLayout({ small: true })

    expect(wrapper.get('.app-layout').classes()).toContain('app-layout--compact')
    wrapper.unmount()
  })

  it('colaborador: título, "Ayuda" y "Mi cuenta"; sin botón de menú ni "Salir" suelto', async () => {
    const { wrapper } = await mountLayout({ small: true, member: colaborador })

    expect(wrapper.find('.app-top-bar__menu').exists()).toBe(false)
    expect(wrapper.get('.app-top-bar__title').text()).toBe('Vender')
    expect(wrapper.get('.app-top-bar__help').text()).toContain('Ayuda')
    expect(wrapper.get('.account-menu__trigger').text()).toContain('Mi cuenta')
    expect(wrapper.find('.app-top-bar__logout').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/\bSalir\b/)
    wrapper.unmount()
  })

  it('colaborador: ni siquiera se monta el cajón del menú (no tiene cómo abrirlo)', async () => {
    const { wrapper } = await mountLayout({ small: true, member: colaborador })

    expect(wrapper.findComponent(AppNavDrawer).exists()).toBe(false)
    wrapper.unmount()
  })

  it('colaborador: "Mi cuenta" > "Cambiar contraseña" lleva a la pantalla de cambiar su contraseña', async () => {
    const { wrapper, router } = await mountLayout({ small: true, member: colaborador })

    await wrapper.get('.account-menu__trigger').trigger('click')
    await flushPromises()
    accountAction('change-password').click()
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('ChangePassword')
    wrapper.unmount()
  })

  it('colaborador sin conexión: "Cambiar contraseña" no navega y dice que necesita internet', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const { wrapper, router } = await mountLayout({ small: true, member: colaborador })

    await wrapper.get('.account-menu__trigger').trigger('click')
    await flushPromises()
    accountAction('change-password').click()
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('Sale')
    expect(document.body.textContent).toContain('Necesitas internet para cambiar tu contraseña.')
    wrapper.unmount()
  })

  it('colaborador: "Mi cuenta" > "Cerrar sesión" cierra la sesión y lleva al ingreso', async () => {
    const { wrapper, router } = await mountLayout({ small: true, member: colaborador })

    await wrapper.get('.account-menu__trigger').trigger('click')
    await flushPromises()
    accountAction('logout').click()
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('Login')
    wrapper.unmount()
  })

  it('socio: no trae "Mi cuenta" en la barra (la tiene en el cajón) y conserva Ajustes en el cajón', async () => {
    const { wrapper } = await mountLayout({ small: true })

    expect(wrapper.find('.account-menu').exists()).toBe(false)
    await wrapper.get('.app-top-bar__menu').trigger('click')
    await flushPromises()
    expect(drawer()!.querySelector('a[href="/app/ajustes"]')).not.toBeNull()
    wrapper.unmount()
  })

  it('socio: botón de menú a la izquierda y sin "Salir" suelto en la barra', async () => {
    const { wrapper } = await mountLayout({ small: true })

    expect(wrapper.get('.app-top-bar__menu').attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.app-top-bar__logout').exists()).toBe(false)
    wrapper.unmount()
  })

  it('socio: el menú abre el cajón con el cambio de modo, los ítems, la cuenta y "Cerrar sesión"', async () => {
    const { wrapper } = await mountLayout({ small: true, mode: 'gestion', path: '/app' })

    await wrapper.get('.app-top-bar__menu').trigger('click')
    await flushPromises()

    expect(wrapper.get('.app-top-bar__menu').attributes('aria-expanded')).toBe('true')
    const text = drawer()!.textContent!
    expect(drawer()!.querySelector('.ui-mode-switch')).not.toBeNull()
    expect(text).toContain('Inicio')
    expect(text).toContain('Productos')
    expect(drawer()!.querySelector('.app-nav-drawer__name')).not.toBeNull()
    expect(text).toContain('Cerrar sesión')
    wrapper.unmount()
  })

  it('socio: el cajón de Venta solo muestra los ítems de Venta (no los de Gestión)', async () => {
    const { wrapper } = await mountLayout({ small: true, mode: 'venta' })

    await wrapper.get('.app-top-bar__menu').trigger('click')
    await flushPromises()

    const labels = [...drawer()!.querySelectorAll('.app-nav-drawer__link')].map((a) => a.textContent!.replace(/\s+/g, ' ').trim())
    expect(labels.some((label) => label.includes('Vender'))).toBe(true)
    expect(labels.some((label) => label.includes('Productos'))).toBe(false)
    wrapper.unmount()
  })

  it('socio: cambiar de modo desde el cajón lleva a la pantalla inicial de ese modo y lo cierra', async () => {
    const { wrapper, router } = await mountLayout({ small: true, mode: 'gestion', path: '/app/productos' })

    await wrapper.get('.app-top-bar__menu').trigger('click')
    await flushPromises()
    drawer()!.querySelector<HTMLButtonElement>('[aria-label="Modo Venta"]')!.click()
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/app/venta')
    expect(drawer()).toBeNull()
    wrapper.unmount()
  })

  it('socio: "Cerrar sesión" del cajón cierra la sesión', async () => {
    const { wrapper, router } = await mountLayout({ small: true })

    await wrapper.get('.app-top-bar__menu').trigger('click')
    await flushPromises()
    drawer()!.querySelector<HTMLButtonElement>('[data-action="logout"]')!.click()
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('Login')
    wrapper.unmount()
  })

  it('"Ayuda" de la barra abre el cajón de ayuda', async () => {
    const { wrapper } = await mountLayout({ small: true })

    await wrapper.get('.app-top-bar__help').trigger('click')
    await flushPromises()

    expect(wrapper.get('.app-top-bar__help').attributes('aria-expanded')).toBe('true')
    expect(drawer()).not.toBeNull()
    wrapper.unmount()
  })

  it('en la pantalla de ayuda no hay botón Ayuda', async () => {
    const { wrapper } = await mountLayout({ small: true, path: '/app/ayuda' })

    expect(wrapper.find('.app-top-bar__help').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('AppLayout — CSS de pantalla pequeña', () => {
  const style = layoutSource.slice(layoutSource.indexOf('<style scoped>')).replace(/\/\*[\s\S]*?\*\//g, '')

  it('el modo compacto no reserva espacio para la barra lateral (los paneles fijos arrancan en 0)', () => {
    expect(style).toMatch(/\.app-layout--compact\s*\{[^}]*--app-sidebar-offset:\s*0px/)
    expect(style).toMatch(/\.app-layout--compact\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/)
  })
})
