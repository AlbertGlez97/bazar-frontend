import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { mockDevice, type MockDevice } from '@/test/mockDevice'
import { UI_MODE_STORAGE_KEY, useUiModeStore } from '@/stores/uiMode.store'
import AppLayout from '@/layouts/AppLayout.vue'

// Selector de modo dentro del layout: el switch y el indicador usan los
// componentes reales; solo se stubean los ajenos al tema (avatar, instalar).
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

let device: MockDevice | null = null

const TEST_IDENTITY = 'a.' + btoa(JSON.stringify({ sub: 'account-a' })) + '.z'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

/** Un socio con sesión en este dispositivo (el menú del celular es solo de socios). */
function loginAsSocio() {
  localStorage.setItem('access_token', TEST_IDENTITY)
  localStorage.setItem('token_expires_at', String(Date.now() + 60000))
  localStorage.setItem('device_context_owner', JSON.stringify({ accountId: 'account-a', apiBase: '/api/v1' }))
  sessionStorage.setItem('member_context_owner', JSON.stringify({ accountId: 'account-a', apiBase: '/api/v1' }))
  sessionStorage.setItem('member_context', JSON.stringify({ id: 'm-1', name: 'Ana', role: 'socio', active: true }))
}
afterEach(() => {
  device?.restore()
  device = null
})

async function mountLayout() {
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{
      path: '/app',
      component: { render: () => h(RouterView) },
      children: [
        { path: '', name: 'AppHome', component: stub },
        { path: 'venta', name: 'Sale', component: stub },
      ],
    }],
  })
  router.push('/app')
  await router.isReady()
  const pinia = createPinia()
  const wrapper = mount(AppLayout, {
    global: { plugins: [pinia, router], stubs: { teleport: true } },
  })
  return { wrapper, store: useUiModeStore(pinia) }
}

const indicator = (wrapper: Awaited<ReturnType<typeof mountLayout>>['wrapper']) =>
  wrapper.get('.app-header__mode').text()
const drawerModeButton = (wrapper: Awaited<ReturnType<typeof mountLayout>>['wrapper'], name: string) =>
  wrapper.get(`.app-nav-drawer button[aria-label="${name}"]`)
const modeButton = (wrapper: Awaited<ReturnType<typeof mountLayout>>['wrapper'], name: string) =>
  wrapper.get(`.sidebar__mode button[aria-label="${name}"]`)

describe('AppLayout — selector e indicador de modo', () => {
  it('muestra el selector en la barra lateral, bajo el logo, con los dos modos', async () => {
    const { wrapper } = await mountLayout()
    const buttons = wrapper.get('.sidebar__mode').findAll('button')
    expect(buttons.map((b) => b.attributes('aria-label'))).toEqual(['Modo Venta', 'Modo Gestión'])
  })

  it('el indicador de la cabecera dice "Modo Gestión" en un equipo de escritorio', async () => {
    device = mockDevice({ touch: false, small: false })
    const { wrapper } = await mountLayout()
    expect(indicator(wrapper)).toBe('Modo Gestión')
    expect(modeButton(wrapper, 'Modo Gestión').attributes('aria-pressed')).toBe('true')
  })

  it('el modo es Venta cuando el dispositivo lo sugiere (táctil + pantalla pequeña) y el cajón lo marca', async () => {
    device = mockDevice({ touch: true, small: true })
    loginAsSocio()
    const { wrapper, store } = await mountLayout()
    expect(store.currentMode).toBe('venta')

    await wrapper.get('.app-top-bar__menu').trigger('click')
    expect(drawerModeButton(wrapper, 'Modo Venta').attributes('aria-pressed')).toBe('true')
    expect(drawerModeButton(wrapper, 'Modo Gestión').attributes('aria-pressed')).toBe('false')
  })

  it('respeta una preferencia guardada sobre la sugerencia del dispositivo', async () => {
    device = mockDevice({ touch: true, small: true })
    loginAsSocio()
    localStorage.setItem(UI_MODE_STORAGE_KEY, 'gestion')
    const { wrapper, store } = await mountLayout()
    expect(store.currentMode).toBe('gestion')

    await wrapper.get('.app-top-bar__menu').trigger('click')
    expect(drawerModeButton(wrapper, 'Modo Gestión').attributes('aria-pressed')).toBe('true')
  })

  it('cambiar de modo desde el selector actualiza el store, el indicador y lo guarda', async () => {
    device = mockDevice({ touch: false, small: false })
    const { wrapper, store } = await mountLayout()

    await modeButton(wrapper, 'Modo Venta').trigger('click')

    expect(store.currentMode).toBe('venta')
    expect(indicator(wrapper)).toBe('Modo Venta')
    expect(localStorage.getItem(UI_MODE_STORAGE_KEY)).toBe('venta')
  })

  it('en táctil + pantalla pequeña, ir a Gestión desde el cajón avisa y solo cambia al confirmar', async () => {
    device = mockDevice({ touch: true, small: true })
    loginAsSocio()
    const { wrapper, store } = await mountLayout()
    expect(store.currentMode).toBe('venta')

    await wrapper.get('.app-top-bar__menu').trigger('click')
    await drawerModeButton(wrapper, 'Modo Gestión').trigger('click')
    expect(wrapper.text()).toContain('¿Seguro que quieres entrar a Gestión?')
    expect(store.currentMode).toBe('venta')

    const confirm = wrapper.findAll('button').find((b) => b.text() === 'Entiendo, quiero seguir')
    await confirm?.trigger('click')
    expect(store.currentMode).toBe('gestion')
  })

  it('en pantalla pequeña no hay barra lateral ni indicador en la cabecera: el cajón es el selector', async () => {
    device = mockDevice({ touch: true, small: true })
    loginAsSocio()
    const { wrapper } = await mountLayout()

    expect(wrapper.find('.sidebar').exists()).toBe(false)
    expect(wrapper.find('.app-header__mode').exists()).toBe(false)
  })

  it('con el sidebar colapsado el selector sigue disponible, compacto y con nombres accesibles', async () => {
    device = mockDevice({ touch: false, small: false })
    const { wrapper } = await mountLayout()

    await wrapper.get('.sidebar__toggle').trigger('click')

    expect(wrapper.get('.sidebar__mode .ui-mode-switch').classes()).toContain('ui-mode-switch--compact')
    expect(wrapper.find('.sidebar__mode .ui-mode-switch__label').exists()).toBe(false)
    expect(modeButton(wrapper, 'Modo Venta').attributes('aria-label')).toBe('Modo Venta')
    expect(modeButton(wrapper, 'Modo Gestión').attributes('aria-label')).toBe('Modo Gestión')

    await modeButton(wrapper, 'Modo Venta').trigger('click')
    expect(indicator(wrapper)).toBe('Modo Venta')
  })
})
