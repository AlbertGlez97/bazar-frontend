import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
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

const cases: [string, string, string, string][] = [
  ['Contributions', '/app/finanzas', '/app/finanzas', 'Finanzas'],
  ['FinanceOverview', '/app/finanzas/resumen', '/app/finanzas/resumen', 'Resumen'],
  ['Expenses', '/app/finanzas/gastos', '/app/finanzas/gastos', 'Gastos'],
  ['WorkShifts', '/app/finanzas/jornadas', '/app/finanzas/jornadas', 'Jornadas'],
  ['FinanceReserves', '/app/finanzas/reservas', '/app/finanzas/reservas', 'Reservas'],
  ['FinanceSimulator', '/app/finanzas/simulador', '/app/finanzas/simulador', 'Simulador'],
  ['FinanceAgreements', '/app/finanzas/acuerdos', '/app/finanzas/acuerdos', 'Acuerdos'],
  ['FinanceAgreementDetail', '/app/finanzas/acuerdos/:id', '/app/finanzas/acuerdos/abc', 'Detalle del acuerdo'],
]

describe('finance route titles', () => {
  it.each(cases)('titles %s', async (name, path, url, title) => {
    const pinia = createPinia()
    useSessionStore(pinia).setMember({ id: 'm', name: 'Fixture', role: 'socio', active: true })
    useUiModeStore(pinia).setMode('gestion')
    const stub = { template: '<div />' }
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path, name, component: stub }] })
    await router.push(url)
    await router.isReady()
    const wrapper = mount(AppLayout, { global: { plugins: [pinia, router], stubs: { InstallAppButton: true } } })
    expect(wrapper.get('.app-header__title').text()).toBe(title)
    wrapper.unmount()
  })
})
