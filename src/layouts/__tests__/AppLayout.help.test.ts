import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session.store'
import { useUiModeStore } from '@/stores/uiMode.store'
import AppLayout from '../AppLayout.vue'

vi.mock('@/stores/sales-queue.store', () => ({ useSalesQueueStore: () => ({
  pendingCount: 0, needsReviewCount: 0, needsReviewRecords: [], isSyncing: false,
  start: vi.fn(), stop: vi.fn(), dismissReview: vi.fn(),
}) }))
beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
describe('shared help entry', () => {
  it.each(['socio', 'colaborador'] as const)('is available to %s in both modes even with collapsed sidebar', async (role) => {
    for (const mode of ['gestion', 'venta'] as const) {
      const pinia = createPinia()
      useSessionStore(pinia).setMember({ id: 'm', name: 'Fixture', role, active: true })
      useUiModeStore(pinia).setMode(mode)
      const stub = { template: '<div />' }
      const router = createRouter({ history: createMemoryHistory(), routes: [
        { path: '/app/productos', name: 'ProductCatalog', component: stub },
        { path: '/app/ayuda', name: 'Help', component: stub },
      ] })
      await router.push('/app/productos')
      await router.isReady()
      const wrapper = mount(AppLayout, { global: { plugins: [pinia, router], stubs: { InstallAppButton: true } } })
      await wrapper.get('.sidebar__toggle').trigger('click')
      const link = wrapper.get('.app-header a[aria-label="Ayuda"]')
      expect(link.text()).toContain('Ayuda')
      expect(link.attributes('href')).toContain('from=/app/productos')
      expect(wrapper.find('.sidebar__nav a[href*="ayuda"]').exists()).toBe(false)
      await link.trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.name).toBe('Help')
      expect(wrapper.get('.app-header__title').text()).toBe('Ayuda')
      expect(useUiModeStore(pinia).currentMode).toBe(mode)
      wrapper.unmount()
    }
  })
})
