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

beforeEach(() => localStorage.clear())
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
      children: [{ path: '', name: 'AppHome', component: stub }],
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

  it('el indicador dice "Modo Venta" cuando el dispositivo lo sugiere (táctil + pantalla pequeña)', async () => {
    device = mockDevice({ touch: true, small: true })
    const { wrapper } = await mountLayout()
    expect(indicator(wrapper)).toBe('Modo Venta')
    expect(modeButton(wrapper, 'Modo Venta').attributes('aria-pressed')).toBe('true')
  })

  it('respeta una preferencia guardada sobre la sugerencia del dispositivo', async () => {
    device = mockDevice({ touch: true, small: true })
    localStorage.setItem(UI_MODE_STORAGE_KEY, 'gestion')
    const { wrapper } = await mountLayout()
    expect(indicator(wrapper)).toBe('Modo Gestión')
  })

  it('cambiar de modo desde el selector actualiza el store, el indicador y lo guarda', async () => {
    device = mockDevice({ touch: false, small: false })
    const { wrapper, store } = await mountLayout()

    await modeButton(wrapper, 'Modo Venta').trigger('click')

    expect(store.currentMode).toBe('venta')
    expect(indicator(wrapper)).toBe('Modo Venta')
    expect(localStorage.getItem(UI_MODE_STORAGE_KEY)).toBe('venta')
  })

  it('en táctil + pantalla pequeña, ir a Gestión avisa y solo cambia al confirmar', async () => {
    device = mockDevice({ touch: true, small: true })
    const { wrapper, store } = await mountLayout()
    expect(store.currentMode).toBe('venta')

    await modeButton(wrapper, 'Modo Gestión').trigger('click')
    expect(wrapper.text()).toContain('¿Seguro que quieres entrar a Gestión?')
    expect(store.currentMode).toBe('venta')
    expect(indicator(wrapper)).toBe('Modo Venta')

    const confirm = wrapper.findAll('button').find((b) => b.text() === 'Entiendo, quiero seguir')
    await confirm?.trigger('click')
    expect(store.currentMode).toBe('gestion')
    expect(indicator(wrapper)).toBe('Modo Gestión')
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
