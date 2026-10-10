import { reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useFinanceAgreementsStore } from '@/stores/finance-agreements.store'
import AgreementDetailView from '../AgreementDetailView.vue'
import { paymentSummaryFixture } from '@/services/__tests__/finance-payments.fixture'
import { AGREEMENT_ID, agreementFixture, agreementOrigin, reversalFixture } from '@/services/__tests__/finance-agreements.fixture'
const mocks = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), create: vi.fn(), reverse: vi.fn() }))
vi.mock('@/services/finance-agreements.service', () => ({ FinanceAgreementsService: mocks }))
const paymentMocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), reverse: vi.fn(), get: vi.fn() }))
vi.mock('@/services/finance-payments.service', () => ({ FinancePaymentsService: paymentMocks }))
const fresh = () => ({ token: 'token-a', member: { role: 'socio', active: true }, owner: { accountId: agreementOrigin.accountId, apiBase: '/api/v1' }, memberId: agreementOrigin.memberId, deviceId: agreementOrigin.deviceId, deviceToken: 'device-token', mode: 'gestion' })
const access = reactive(fresh()), route = reactive({ params: { id: AGREEMENT_ID } })
vi.mock('vue-router', async (importOriginal) => ({ ...(await importOriginal<object>()), useRoute: () => route }))
vi.mock('@/stores/auth.store', () => ({ useAuthStore: () => ({ get token() { return access.token } }) }))
vi.mock('@/stores/session.store', () => ({ useSessionStore: () => access }))
vi.mock('@/stores/uiMode.store', () => ({ useUiModeStore: () => ({ get currentMode() { return access.mode } }) }))
vi.mock('@/services/queue-origin', async (importOriginal) => ({ ...(await importOriginal<object>()), currentQueueOrigin: () => ({ ...access.owner, memberId: access.memberId, deviceId: access.deviceId }) }))
beforeEach(() => { setActivePinia(createPinia()); Object.assign(access, fresh()); route.params.id = AGREEMENT_ID; vi.clearAllMocks(); paymentMocks.list.mockResolvedValue({ items: [], paymentSummary: paymentSummaryFixture() }); mocks.get.mockResolvedValue(agreementFixture()); mocks.reverse.mockResolvedValue(reversalFixture()) })
const mounted = async () => { const w = mount(AgreementDetailView, { attachTo: document.body, global: { stubs: { RouterLink: RouterLinkStub } } }); await flushPromises(); return w }
describe('immutable agreement detail', () => {
  it('shows only server-frozen names, roles, amounts, work units, rule, notice and dates', async () => {
    const original = agreementFixture()
    mocks.get.mockResolvedValueOnce(agreementFixture({ title: '<b>Frozen title</b>', participants: [
      { ...original.participants[0]!, name: 'Historical name', isActive: false, role: 'colaborador', workUnits: 91, totalMinor: 12345 },
    ], totals: { distributedMinor: 12345, undistributedMinor: 587655 } }))
    const w = await mounted()
    expect(w.find('h1').text()).toContain('<b>Frozen title</b>')
    expect(w.find('b').exists()).toBe(false)
    expect(w.text()).toContain('Historical name')
    expect(w.text()).toContain('Inactivo al crear el acuerdo')
    expect(w.text()).toContain('Colaborador')
    expect(w.text()).toContain('91 jornadas')
    expect(w.find('[data-test="agreement-distributed"]').text()).toContain('$123.45')
    expect(w.find('[data-test="agreement-notice"]').text()).toBe(original.notice)
    expect(w.text()).toContain('EQUAL')
    expect(w.find('form').exists()).toBe(false)
    expect(w.find('table').exists()).toBe(false)
    expect(document.activeElement).toBe(w.find('h1').element)
    expect(mocks.create).not.toHaveBeenCalled()
    w.unmount()
  })
  it('shows actual reversal reason and both real replacement links from detail only', async () => {
    const receipt = reversalFixture()
    const replacementId = '0190aaaa-0000-7000-8000-000000000099'
    mocks.get.mockResolvedValueOnce(agreementFixture({ status: 'voided', reversal: receipt,
      replacesAgreementId: replacementId, replacesAgreement: { id: replacementId, folio: 'AC-2026-00000' },
      replacedBy: { id: replacementId, folio: 'AC-2026-00002' } }))
    const w = await mounted()
    expect(w.find('[data-test="agreement-status"]').text()).toBe('Anulado')
    expect(w.find('[data-test="agreement-reversal"]').text()).toContain('Correction')
    const links = w.findAllComponents(RouterLinkStub)
    expect(links.filter((link) => link.props('to') === '/app/finanzas/acuerdos/' + replacementId)).toHaveLength(2)
    expect(mocks.reverse).not.toHaveBeenCalled()
    w.unmount()
  })
  it.each([400, 401, 403, 404, 409, 422])('shows a mapped %i error and can retry the same detail', async (status) => {
    mocks.get.mockRejectedValueOnce({ response: { status, data: { message: 'SERVER ENGLISH' } } })
    const w = await mounted()
    expect(w.find('[data-test="detail-error"]').exists()).toBe(true)
    expect(w.text()).not.toContain('SERVER ENGLISH')
    await w.find('[data-test="retry-detail"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="agreement-participants"]').exists()).toBe(true)
    w.unmount()
  })
  it('keeps the received document offline, but hides it immediately when selection loses access', async () => {
    const w = await mounted()
    window.dispatchEvent(new Event('offline'))
    await flushPromises()
    expect(w.find('[data-test="agreement-participants"]').exists()).toBe(true)
    expect(w.find('[data-test="detail-offline"]').exists()).toBe(true)
    access.member.role = 'colaborador'
    await flushPromises()
    expect(w.find('[data-test="agreement-detail-page"]').exists()).toBe(false)
    expect(mocks.get).toHaveBeenCalledTimes(1)
    w.unmount()
  })
  it('reuses the route component safely when the requested id changes', async () => {
    const w = await mounted()
    const id = '0190aaaa-0000-7000-8000-000000000099'
    mocks.get.mockResolvedValueOnce(agreementFixture({ id, folio: 'AC-2026-00002' }))
    route.params.id = id
    await flushPromises()
    expect(mocks.get.mock.calls.at(-1)?.[1]).toBe(id)
    expect(w.find('h1').text()).toContain('AC-2026-00002')
    w.unmount()
  })
})


describe('malformed detail addresses', () => {
  it('explains an invalid UUIDv7 without dispatching or showing unrelated snapshots', async () => {
    route.params.id = 'invalid-id'
    const w = await mounted()
    expect(mocks.get).not.toHaveBeenCalled()
    expect(w.find('[data-test="detail-error"]').text()).toContain('identificador del acuerdo no es válido')
    expect(w.find('[data-test="agreement-participants"]').exists()).toBe(false)
    w.unmount()
  })
})

describe('agreement reversal lifecycle', () => {
  it('recovers an uncached offline address when connectivity returns', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const w = await mounted()
    expect(mocks.get).not.toHaveBeenCalled()
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    window.dispatchEvent(new Event('online'))
    await flushPromises()
    expect(mocks.get).toHaveBeenCalledTimes(1)
    expect(w.find('[data-test="agreement-participants"]').exists()).toBe(true)
    w.unmount(); vi.restoreAllMocks()
  })
  it('requires confirmation, sends trimmed reason once and refreshes the authoritative voided projection', async () => {
    const w = await mounted()
    await w.find('[data-test="open-void"]').trigger('click')
    await flushPromises()
    const form = w.findComponent({ name: 'AgreementVoidForm' })
    mocks.get.mockResolvedValueOnce(agreementFixture({ status: 'voided', reversal: reversalFixture() }))
    form.vm.$emit('confirm', '  Correction  ')
    form.vm.$emit('confirm', '  Correction  ')
    await flushPromises()
    expect(mocks.reverse).toHaveBeenCalledTimes(1)
    expect(mocks.reverse.mock.calls[0]?.[2].reason).toBe('Correction')
    expect(mocks.get).toHaveBeenCalledTimes(2)
    expect(w.find('[data-test="agreement-reversal"]').text()).toContain('Correction')
    expect(w.find('[data-test="agreement-status"]').text()).toBe('Anulado')
    w.unmount()
  })
})

describe('reversal recovery and access', () => {
  it('preserves the entire uncertain body and locks its reason for explicit recovery', async () => {
    mocks.reverse.mockRejectedValueOnce(new Error('Network Error'))
    const w = await mounted()
    await w.find('[data-test="open-void"]').trigger('click'); await flushPromises()
    const form = w.findComponent({ name: 'AgreementVoidForm' })
    form.vm.$emit('confirm', 'Correction'); await flushPromises()
    const original = mocks.reverse.mock.calls[0]
    expect(form.props('pending').reason).toBe('Correction')
    expect(form.props('error')).not.toBe('')
    mocks.get.mockResolvedValueOnce(agreementFixture({ status: 'voided', reversal: reversalFixture() }))
    form.vm.$emit('retry'); await flushPromises()
    expect(mocks.reverse.mock.calls[1]).toEqual(original)
    expect(w.find('[data-test="void-notice"]').text()).toContain('confirmada')
    w.unmount()
  })
  it('refreshes an already-voided conflict without sending another reversal', async () => {
    mocks.reverse.mockRejectedValueOnce({ response: { status: 409, data: { code: 'FINANCE_AGREEMENT_ALREADY_VOIDED' } } })
    const w = await mounted()
    mocks.get.mockResolvedValueOnce(agreementFixture({ status: 'voided', reversal: reversalFixture() }))
    await w.find('[data-test="open-void"]').trigger('click'); await flushPromises()
    w.findComponent({ name: 'AgreementVoidForm' }).vm.$emit('confirm', 'Correction'); await flushPromises()
    expect(mocks.reverse).toHaveBeenCalledTimes(1)
    expect(w.find('[data-test="void-notice"]').text()).toContain('ya fue anulado')
    expect(w.find('[data-test="open-void"]').exists()).toBe(false)
    expect(w.find('[data-test="create-replacement"]').exists()).toBe(true)
    w.unmount()
  })
  it('keeps frozen figures after a confirmed reversal whose detail refresh fails, without allowing another reversal', async () => {
    const w = await mounted()
    mocks.get.mockRejectedValueOnce(new Error('Network Error'))
    await w.find('[data-test="open-void"]').trigger('click'); await flushPromises()
    w.findComponent({ name: 'AgreementVoidForm' }).vm.$emit('confirm', 'Correction'); await flushPromises()
    expect(w.find('[data-test="agreement-participants"]').exists()).toBe(true)
    expect(w.find('[data-test="open-void"]').exists()).toBe(false)
    expect(w.find('[data-test="detail-error"]').exists()).toBe(true)
    w.unmount()
  })
  it('blocks offline confirmation and closes it immediately on access loss', async () => {
    const w = await mounted()
    await w.find('[data-test="open-void"]').trigger('click'); await flushPromises()
    const form = w.findComponent({ name: 'AgreementVoidForm' })
    window.dispatchEvent(new Event('offline')); await flushPromises()
    form.vm.$emit('confirm', 'Correction'); await flushPromises()
    expect(mocks.reverse).not.toHaveBeenCalled()
    access.member.role = 'colaborador'; await flushPromises()
    expect(w.find('[data-test="agreement-detail-page"]').exists()).toBe(false)
    expect(document.querySelector('[data-test="confirm-void"]')).toBeNull()
    w.unmount()
  })
})

it('routes PDF through guarded authoritative export and exposes failures/offline restrictions', async () => {
  const w = await mounted(), store = useFinanceAgreementsStore()
  const exportPdf = vi.spyOn(store, 'exportPdf').mockImplementation(async () => { store.pdfError = 'No se pudo actualizar el estado'; return false })
  await w.find('[data-test="detail-pdf"]').trigger('click'); await flushPromises()
  expect(exportPdf).toHaveBeenCalledWith(AGREEMENT_ID, expect.any(Function))
  const canDeliver = exportPdf.mock.calls[0]![1]!
  expect(w.find('[data-test="detail-pdf-error"]').text()).toContain('actualizar')
  window.dispatchEvent(new Event('offline')); await flushPromises()
  expect(w.find('[data-test="detail-pdf"]').attributes('disabled')).toBeDefined()
  w.unmount()
  expect(canDeliver()).toBe(false)
})
