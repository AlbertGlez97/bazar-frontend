import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Contribution } from '@/types/contribution.types'
import type {
  PendingContribution,
  FinanceReferences,
} from '@/services/contributions-records'
import ContributionsView from '../ContributionsView.vue'
import AppModal from '@/components/ui/organisms/AppModal.vue'
const mocks = vi.hoisted(() => ({
  store: {
    history: [] as Contribution[],
    pending: [] as PendingContribution[],
    members: [{ id: 'socio', name: 'Alberto', role: 'socio', active: true }],
    references: null as FinanceReferences | null,
    syncing: false,
    error: '',
    nextCursor: null,
    load: vi.fn(),
    refresh: vi.fn(),
    create: vi.fn(),
    reverse: vi.fn(),
    retry: vi.fn(),
  },
  session: { member: { role: 'socio' } },
}))
vi.mock('@/stores/contributions.store', () => ({
  useContributionsStore: () => mocks.store,
}))
vi.mock('@/stores/uiMode.store', () => ({
  useUiModeStore: () => ({ currentMode: 'gestion' }),
}))
vi.mock('@/stores/session.store', () => ({
  useSessionStore: () => mocks.session,
}))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.session.member = { role: 'socio' }
  mocks.store.create.mockResolvedValue('id')
  mocks.store.history = []
  mocks.store.pending = []
  mocks.store.reverse.mockResolvedValue(undefined)
})
const mountView = () =>
  mount(ContributionsView, {
    global: {
      stubs: {
        RouterLink: RouterLinkStub,
        AppModal: { template: '<div><slot/><slot name="footer"/></div>' },
      },
    },
  })
describe('contribution management', () => {
  it('offers the Resumen | Aportaciones | Gastos | Jornadas | Reservas tab navigation with Aportaciones active', async () => {
    const w = mountView()
    await flushPromises()
    const tabs = w.findAllComponents(RouterLinkStub)
    expect(tabs.map((t) => t.text())).toEqual(['Resumen', 'Aportaciones', 'Gastos', 'Jornadas', 'Reservas', 'Simulador', 'Acuerdos'])
    expect(tabs.map((t) => t.props('to'))).toEqual([
      '/app/finanzas/resumen',
      '/app/finanzas',
      '/app/finanzas/gastos',
      '/app/finanzas/jornadas',
      '/app/finanzas/reservas',
      '/app/finanzas/simulador',
      '/app/finanzas/acuerdos',
    ])
    expect(tabs[1]!.attributes('aria-current')).toBe('page')
    expect(tabs[0]!.attributes('aria-current')).toBeUndefined()
  })
  it('opts its correction modal into keyboard focus management', async () => {
    const wrapper = mount(ContributionsView, {
      global: { stubs: { RouterLink: RouterLinkStub } },
    })
    await flushPromises()
    expect(wrapper.getComponent(AppModal).props('manageFocus')).toBe(true)
    wrapper.unmount()
  })
  it('shows a simple capital-only form and meaning disclaimer', async () => {
    const w = mountView()
    await flushPromises()
    expect(w.text()).toContain('Aportaciones')
    expect(w.text()).toContain('no es utilidad')
    expect(w.find('#contribution-amount').exists()).toBe(true)
    expect(mocks.store.refresh).toHaveBeenCalled()
  })
  it('prevents collaborator administration', async () => {
    mocks.session.member = { role: 'colaborador' }
    const w = mountView()
    await flushPromises()
    expect(w.find('#contribution-amount').exists()).toBe(false)
    expect(mocks.store.refresh).not.toHaveBeenCalled()
  })
  it('submits integer cents and economic midnight without floats', async () => {
    const w = mountView()
    await flushPromises()
    await w.find('#contribution-member').setValue('socio')
    await w.find('#contribution-amount').setValue('8,000.00')
    await w.find('#contribution-date').setValue('2026-10-03')
    await w.find('[data-test="create-form"]').trigger('submit')
    await flushPromises()
    expect(mocks.store.create).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: 'socio',
        amountMinor: 800000,
        occurredAt: '2026-10-03T00:00:00-06:00',
      }),
    )
  })
  it('does not claim success if durable storage fails', async () => {
    mocks.store.create.mockRejectedValue(new Error('disk full'))
    const w = mountView()
    await flushPromises()
    await w.find('#contribution-member').setValue('socio')
    await w.find('#contribution-amount').setValue('100')
    await w.find('[data-test="create-form"]').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('No se pudo guardar')
    expect(w.text()).not.toContain('Aportación guardada en este dispositivo')
  })
  it('validates money instead of rounding invalid amounts', async () => {
    const w = mountView()
    await flushPromises()
    await w.find('#contribution-member').setValue('socio')
    await w.find('#contribution-amount').setValue('10.005')
    await w.find('[data-test="create-form"]').trigger('submit')
    await flushPromises()
    expect(mocks.store.create).not.toHaveBeenCalled()
    expect(w.text()).toContain('Selecciona un socio')
  })
  it('uses economic inclusive/exclusive period filters', async () => {
    const w = mountView()
    await flushPromises()
    await w.find('#finance-from').setValue('2026-10-01')
    await w.find('#finance-to').setValue('2026-10-03')
    await w.find('.finance-filters').trigger('submit')
    await flushPromises()
    expect(mocks.store.refresh).toHaveBeenLastCalledWith(
      expect.objectContaining({
        from: '2026-10-01T00:00:00-06:00',
        to: '2026-10-04T00:00:00-06:00',
      }),
    )
  })
  it('annuls a confirmed or pending original without changing its amount', async () => {
    mocks.store.history = [
      {
        id: 'original',
        memberId: 'socio',
        amountMinor: 800000,
        occurredAt: '2026-10-03T06:00:00Z',
        note: 'Initial',
        createdByMemberId: 'socio',
        deviceId: 'device',
        createdByAccountId: 'account',
        contextId: 'business',
        currency: 'MXN',
        receivedAt: '2026-10-03T12:00:00Z',
        reversal: null,
      },
    ]
    const w = mountView()
    await flushPromises()
    await w.find('#finance-from').setValue('2026-10-01')
    await w.find('#finance-to').setValue('2026-10-31')
    await w
      .findAll('button')
      .find((b) => b.text() === 'Anular')!
      .trigger('click')
    await w.find('#correction-reason').setValue('Incorrect registration')
    await w.find('#correction-form').trigger('submit')
    await flushPromises()
    expect(mocks.store.reverse).toHaveBeenCalledWith(
      'original',
      'Incorrect registration',
      undefined,
    )
    expect(mocks.store.history[0]?.amountMinor).toBe(800000)
    expect(w.text()).toContain('no se devuelve capital')
  })
  it('corrects through one linked replacement operation', async () => {
    mocks.store.history = [
      {
        id: 'original',
        memberId: 'socio',
        amountMinor: 800000,
        occurredAt: '2026-10-03T06:00:00Z',
        note: 'Initial',
        createdByMemberId: 'socio',
        deviceId: 'device',
        createdByAccountId: 'account',
        contextId: 'business',
        currency: 'MXN',
        receivedAt: '2026-10-03T12:00:00Z',
      },
    ]
    const w = mountView()
    await flushPromises()
    await w.find('#finance-from').setValue('2026-10-01')
    await w.find('#finance-to').setValue('2026-10-31')
    await w
      .findAll('button')
      .find((b) => b.text() === 'Corregir')!
      .trigger('click')
    await w.find('#correction-reason').setValue('Wrong amount')
    await w.find('#correction-amount').setValue('6000')
    await w.find('#correction-form').trigger('submit')
    await flushPromises()
    expect(mocks.store.reverse).toHaveBeenCalledWith(
      'original',
      'Wrong amount',
      expect.objectContaining({ amountMinor: 600000, memberId: 'socio' }),
    )
  })
  it.each(['paused', 'needs_review', 'pending'] as const)(
    'requires explicit correction retry for %s state',
    async (state) => {
      const payload = {
        id: 'original',
        memberId: 'socio',
        amountMinor: 800000,
        occurredAt: '2026-10-03T06:00:00Z',
        note: null,
        createdByMemberId: 'socio',
        deviceId: 'device',
      }
      mocks.store.history = [
        {
          ...payload,
          contextId: 'business',
          currency: 'MXN',
          createdByAccountId: 'account',
          receivedAt: payload.occurredAt,
        },
      ]
      const correction: PendingContribution = {
        kind: 'reverse',
        contributionId: payload.id,
        payload: {
          id: 'reversal',
          createdByMemberId: 'socio',
          deviceId: 'device',
          occurredAt: payload.occurredAt,
          reason: 'Correction',
        },
        origin: {
          accountId: 'account',
          apiBase: '/api/v1',
          memberId: 'socio',
          deviceId: 'device',
        },
        id: 'reversal',
        key: 'key',
        scope: 'scope',
        createdAt: payload.occurredAt,
        state,
        attempts: 1,
        nextAttemptAt: 0,
      }
      mocks.store.pending = [correction]
      const w = mountView()
      await flushPromises()
      await w.find('#finance-from').setValue('2026-10-01')
      await w.find('#finance-to').setValue('2026-10-31')
      const button = w
        .findAll('button')
        .find((b) => b.text() === 'Reintentar correcci\u00f3n')
      expect(!!button).toBe(state !== 'pending')
      expect(mocks.store.retry).not.toHaveBeenCalled()
      if (button) {
        await button.trigger('click')
        await flushPromises()
        expect(mocks.store.retry).toHaveBeenCalledWith(correction)
      }
    },
  )
})
