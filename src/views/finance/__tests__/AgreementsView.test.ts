import { reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AgreementsView from '../AgreementsView.vue'
import { useFinanceAgreementsStore } from '@/stores/finance-agreements.store'
import { AGREEMENT_ID, agreementItemFixture, agreementOrigin } from '@/services/__tests__/finance-agreements.fixture'
const mocks = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), create: vi.fn(), reverse: vi.fn() }))
vi.mock('@/services/finance-agreements.service', () => ({ FinanceAgreementsService: mocks }))
const fresh = () => ({ token: 'token-a', member: { role: 'socio', active: true }, owner: { accountId: agreementOrigin.accountId, apiBase: '/api/v1' }, memberId: agreementOrigin.memberId, deviceId: agreementOrigin.deviceId, deviceToken: 'device-token', mode: 'gestion' })
const access = reactive(fresh())
vi.mock('@/stores/auth.store', () => ({ useAuthStore: () => ({ get token() { return access.token } }) }))
vi.mock('@/stores/session.store', () => ({ useSessionStore: () => access }))
vi.mock('@/stores/uiMode.store', () => ({ useUiModeStore: () => ({ get currentMode() { return access.mode } }) }))
vi.mock('@/services/queue-origin', async (importOriginal) => ({ ...(await importOriginal<object>()), currentQueueOrigin: () => ({ ...access.owner, memberId: access.memberId, deviceId: access.deviceId }) }))
beforeEach(() => { setActivePinia(createPinia()); Object.assign(access, fresh()); vi.clearAllMocks(); mocks.list.mockResolvedValue({ items: [agreementItemFixture()], nextCursor: null }) })
const mounted = async () => { const w = mount(AgreementsView, { global: { stubs: { RouterLink: RouterLinkStub } } }); await flushPromises(); return w }
describe('agreement history', () => {
  it('renders mobile cards with exact immutable summaries and detail links, never a table or fake reversal reason', async () => {
    const w = await mounted()
    expect(w.findAll('h1')).toHaveLength(1)
    expect(w.find('[data-test="agreement-card"]').text()).toContain('AC-2026-00001')
    expect(w.text()).toContain('$6,000.00')
    const description = w.find('[data-test="agreement-card"]').findAll('p').find(p => p.text().includes('personas participantes'))!.text()
    expect(description).toContain('personas participantes · Base financiera completa.')
    expect(description).not.toContain('?')
    expect(w.find('table').exists()).toBe(false)
    expect(w.findAllComponents(RouterLinkStub).some((link) => link.props('to') === '/app/finanzas/acuerdos/' + AGREEMENT_ID)).toBe(true)
    expect(mocks.get).not.toHaveBeenCalled()
    w.unmount()
  })
  it('uses exact paired exclusive periods, status and folio, and never reuses a cursor after applying new filters', async () => {
    mocks.list.mockResolvedValueOnce({ items: [agreementItemFixture()], nextCursor: 'old-cursor' })
    const w = await mounted()
    await w.find('[data-test="scope-period"]').setValue(true)
    await w.find('#agreement-from').setValue('2026-10-01')
    await w.find('#agreement-to').setValue('2026-10-31')
    await w.find('#agreement-status').setValue('voided')
    await w.find('#agreement-folio').setValue(' ac-2026-00001 ')
    expect(w.find('[data-test="more-agreements"]').attributes('disabled')).toBeDefined()
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.list.mock.calls.at(-1)?.[1]).toEqual({ status: 'voided', limit: 20, from: '2026-10-01', to: '2026-11-01', folio: 'AC-2026-00001' })
    expect(useFinanceAgreementsStore().nextCursor).toBeNull()
    await w.find('#agreement-from').setValue('')
    await w.find('form').trigger('submit')
    expect(w.find('[data-test="filter-error"]').exists()).toBe(true)
    expect(mocks.list).toHaveBeenCalledTimes(2)
    w.unmount()
  })
  it('preserves opaque cursor pagination and shows explicit empty/error/retry states', async () => {
    mocks.list.mockResolvedValueOnce({ items: [agreementItemFixture()], nextCursor: 'opaque' })
    const w = await mounted()
    await w.find('[data-test="more-agreements"]').trigger('click')
    await flushPromises()
    expect(mocks.list.mock.calls.at(-1)?.[1]).toEqual({ status: 'active', limit: 20, cursor: 'opaque' })
    mocks.list.mockRejectedValueOnce({ response: { status: 400 } })
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.find('[data-test="agreements-error"]').text()).toContain('Revisa los datos')
    mocks.list.mockResolvedValueOnce({ items: [], nextCursor: null })
    await w.find('[data-test="retry-agreements"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="agreements-empty"]').exists()).toBe(true)
    w.unmount()
  })
  it.each(['role', 'active', 'mode', 'token'])('blocks a view without %s authority', async (field) => {
    if (field === 'role') access.member.role = 'colaborador'
    if (field === 'active') access.member.active = false
    if (field === 'mode') access.mode = 'venta'
    if (field === 'token') access.token = ''
    const w = await mounted()
    expect(w.find('[data-test="agreements-page"]').exists()).toBe(false)
    expect(mocks.list).not.toHaveBeenCalled()
    w.unmount()
  })
  it('keeps a confirmed snapshot visible offline and prevents further requests', async () => {
    const w = await mounted()
    window.dispatchEvent(new Event('offline'))
    await flushPromises()
    await w.find('form').trigger('submit')
    expect(mocks.list).toHaveBeenCalledTimes(1)
    expect(w.find('[data-test="agreement-card"]').exists()).toBe(true)
    expect(w.find('[data-test="agreements-offline"]').exists()).toBe(true)
    w.unmount()
  })
})
