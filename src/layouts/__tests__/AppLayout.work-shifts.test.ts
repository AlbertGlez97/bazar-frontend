import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session.store'
import { useUiModeStore } from '@/stores/uiMode.store'
import AppLayout from '../AppLayout.vue'

const workShifts = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  sessionChanged: vi.fn(),
}))
vi.mock('@/stores/work-shifts.store', () => ({ useWorkShiftsStore: () => workShifts }))
vi.mock('@/stores/sales-queue.store', () => ({ useSalesQueueStore: () => ({
  pendingCount: 0, needsReviewCount: 0, needsReviewRecords: [], isSyncing: false,
  start: vi.fn(), stop: vi.fn(), dismissReview: vi.fn(),
}) }))
vi.mock('@/stores/contributions.store', () => ({ useContributionsStore: () => ({
  start: vi.fn(), stop: vi.fn(), sessionChanged: vi.fn(),
}) }))
vi.mock('@/stores/expenses.store', () => ({ useExpensesStore: () => ({
  start: vi.fn(), stop: vi.fn(), sessionChanged: vi.fn(),
}) }))

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.clearAllMocks()
})

async function mountLayout(path = '/app/finanzas/jornadas') {
  const pinia = createPinia()
  const session = useSessionStore(pinia)
  session.setMember({ id: 'm', name: 'Fixture', role: 'socio', active: true })
  useUiModeStore(pinia).setMode('gestion')
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/app/finanzas/jornadas', name: 'WorkShifts', component: stub },
      { path: '/app/ayuda', name: 'Help', component: stub },
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(AppLayout, {
    global: { plugins: [pinia, router], stubs: { InstallAppButton: true } },
  })
  await flushPromises()
  return { wrapper, session }
}

describe('AppLayout work shifts lifecycle', () => {
  it('starts the work shifts scheduler with the shell and stops it on unmount', async () => {
    const { wrapper } = await mountLayout()
    expect(workShifts.start).toHaveBeenCalledOnce()
    expect(workShifts.stop).not.toHaveBeenCalled()
    wrapper.unmount()
    expect(workShifts.stop).toHaveBeenCalledOnce()
  })

  it('re-scopes the work shifts store when the selected member changes', async () => {
    const { wrapper, session } = await mountLayout()
    session.setMember({ id: 'other', name: 'Otra', role: 'socio', active: true })
    await flushPromises()
    expect(workShifts.sessionChanged).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('titles the Jornadas route as Finanzas', async () => {
    const { wrapper } = await mountLayout()
    expect(wrapper.get('.app-header__title').text()).toBe('Finanzas')
    wrapper.unmount()
  })

  it('keeps the shell usable when starting the store fails', async () => {
    workShifts.start.mockRejectedValueOnce(new Error('indexeddb unavailable'))
    const { wrapper } = await mountLayout()
    expect(wrapper.get('.app-header__title').text()).toBe('Finanzas')
    wrapper.unmount()
  })
})
