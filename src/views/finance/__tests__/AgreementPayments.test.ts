import { reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AgreementDetailView from '../AgreementDetailView.vue'
import { AGREEMENT_ID, agreementFixture, agreementOrigin, reversalFixture } from '@/services/__tests__/finance-agreements.fixture'
import { ADID_ID, ALBERTO_ID } from '@/services/__tests__/finance-distribution.fixture'
import { PAYMENT_ID, paymentFixture, paymentReceiptFixture, paymentSummaryFixture, partialSummaryFixture,
  participantSummaryFixture, voidedPaymentFixture } from '@/services/__tests__/finance-payments.fixture'
import type { AgreementPaymentSummary } from '@/types/finance-payment.types'

const agreementMocks = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), create: vi.fn(), reverse: vi.fn() }))
const paymentMocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), reverse: vi.fn(), get: vi.fn() }))
vi.mock('@/services/finance-agreements.service', () => ({ FinanceAgreementsService: agreementMocks }))
vi.mock('@/services/finance-payments.service', () => ({ FinancePaymentsService: paymentMocks }))
const fresh = () => ({ token: 'token-a', member: { role: 'socio', active: true }, owner: { accountId: agreementOrigin.accountId, apiBase: '/api/v1' }, memberId: agreementOrigin.memberId, deviceId: agreementOrigin.deviceId, deviceToken: 'device-token', mode: 'gestion' })
const access = reactive(fresh()), route = reactive({ params: { id: AGREEMENT_ID } })
vi.mock('vue-router', async (importOriginal) => ({ ...(await importOriginal<object>()), useRoute: () => route }))
vi.mock('@/stores/auth.store', () => ({ useAuthStore: () => ({ get token() { return access.token } }) }))
vi.mock('@/stores/session.store', () => ({ useSessionStore: () => access }))
vi.mock('@/stores/uiMode.store', () => ({ useUiModeStore: () => ({ get currentMode() { return access.mode } }) }))
vi.mock('@/services/queue-origin', async (importOriginal) => ({ ...(await importOriginal<object>()), currentQueueOrigin: () => ({ ...access.owner, memberId: access.memberId, deviceId: access.deviceId }) }))

const http = (status: number, code = '', extra: object = {}) => ({ response: { status, data: { code, ...extra } } })
const wrappers: ReturnType<typeof mount>[] = []
async function mounted() {
  const w = mount(AgreementDetailView, { attachTo: document.body, global: { stubs: { RouterLink: RouterLinkStub, teleport: true } } })
  wrappers.push(w); await flushPromises(); return w
}
const paidAndNotDue = (): AgreementPaymentSummary => paymentSummaryFixture({
  status: 'PAID', agreedMinor: 270000, paidMinor: 270000, pendingMinor: 0, hasPayments: true, paymentCount: 1, activePaymentCount: 1,
  participants: [
    participantSummaryFixture({ paidMinor: 270000, pendingMinor: 0, status: 'PAID' }),
    participantSummaryFixture({ memberId: ADID_ID, memberName: 'Adid', agreedMinor: 0, pendingMinor: 0, status: 'NOT_DUE' }),
  ],
})
const listWith = (items = [paymentFixture()], paymentSummary = partialSummaryFixture()) => paymentMocks.list.mockResolvedValue({ items, paymentSummary })
beforeEach(() => {
  setActivePinia(createPinia()); Object.assign(access, fresh()); route.params.id = AGREEMENT_ID
  vi.clearAllMocks()
  agreementMocks.get.mockResolvedValue(agreementFixture())
  agreementMocks.reverse.mockResolvedValue(reversalFixture())
  paymentMocks.list.mockResolvedValue({ items: [], paymentSummary: paymentSummaryFixture() })
  paymentMocks.create.mockResolvedValue(paymentReceiptFixture())
  paymentMocks.reverse.mockResolvedValue(voidedPaymentFixture({ paymentSummary: paymentSummaryFixture(), participantSummary: participantSummaryFixture() }))
})
afterEach(() => { wrappers.splice(0).forEach((w) => w.unmount()); document.body.innerHTML = ''; vi.restoreAllMocks() })

describe('payment summary inside the agreement detail', () => {
  it('shows agreed, paid and pending per frozen participant with an agreement badge separate from Activo/Anulado', async () => {
    listWith()
    const w = await mounted()
    expect(w.find('[data-test="agreement-payments"]').exists()).toBe(true)
    expect(w.find('[data-test="agreement-status"]').text()).toBe('Activo')
    expect(w.find('[data-test="payment-status"]').text()).toBe('Pago parcial')
    const people = w.findAll('[data-test="payment-person"]')
    expect(people).toHaveLength(2)
    expect(people[0]!.text()).toContain('Alberto')
    expect(people[0]!.find('[data-test="participant-payment-status"]').text()).toBe('Pago parcial')
    expect(people[0]!.find('[data-test="person-agreed"]').text()).toBe('$2,700.00')
    expect(people[0]!.find('[data-test="person-paid"]').text()).toBe('$1,000.00')
    expect(people[0]!.find('[data-test="person-pending"]').text()).toBe('$1,700.00')
    expect(people[1]!.find('[data-test="participant-payment-status"]').text()).toBe('Sin pagar')
    expect(w.find('[data-test="summary-pending"]').text()).toBe('$5,000.00')
    expect(w.find('[data-test="payments-intro"]').text()).toContain('no mueve dinero')
  })
  it('shows Pagado without a register button and Sin monto acordado for a participant with nothing agreed', async () => {
    listWith([paymentFixture({ amountMinor: 270000 })], paidAndNotDue())
    const w = await mounted()
    const [alberto, adid] = w.findAll('[data-test="payment-person"]')
    expect(w.find('[data-test="payment-status"]').text()).toBe('Pagado')
    expect(alberto!.find('[data-test="participant-payment-status"]').text()).toBe('Pagado')
    expect(adid!.find('[data-test="participant-payment-status"]').text()).toBe('Sin monto acordado')
    expect(w.findAll('[data-test="open-register-payment"]')).toHaveLength(0)
    expect(adid!.text()).toContain('no tiene un monto acordado')
  })
  it('lists payment history with date, note, author and ANULADO plus reason for voided payments', async () => {
    listWith([
      voidedPaymentFixture({ id: '0190bbbb-0000-7000-8000-000000000010', amountMinor: 50000, note: 'Se equivocó el monto' }),
      paymentFixture({ note: 'Transferencia' }),
    ])
    const w = await mounted()
    const rows = w.findAll('[data-test="payment-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('$500.00')
    expect(rows[0]!.text()).toContain('9 oct 2026')
    expect(rows[0]!.find('[data-test="payment-voided-badge"]').text()).toBe('ANULADO')
    expect(rows[0]!.find('[data-test="payment-reversal-reason"]').text()).toBe('Motivo: Monto equivocado')
    expect(rows[0]!.text()).toContain('Registrado por Alberto')
    expect(rows[0]!.find('[data-test="open-reverse-payment"]').exists()).toBe(false)
    expect(rows[1]!.text()).toContain('Nota: Transferencia')
    expect(rows[1]!.find('[data-test="payment-voided-badge"]').exists()).toBe(false)
    expect(rows[1]!.find('[data-test="open-reverse-payment"]').exists()).toBe(true)
  })
  it('hides register buttons on a voided agreement, explains it and still lists the historical payments', async () => {
    agreementMocks.get.mockResolvedValue(agreementFixture({ status: 'voided', reversal: reversalFixture() }))
    listWith([paymentFixture()])
    const w = await mounted()
    expect(w.find('[data-test="agreement-status"]').text()).toBe('Anulado')
    expect(w.find('[data-test="payment-status"]').text()).toBe('Pago parcial')
    expect(w.find('[data-test="payments-voided-notice"]').text()).toBe('Este acuerdo está anulado. Los pagos registrados previamente se conservan como historial.')
    expect(w.findAll('[data-test="open-register-payment"]')).toHaveLength(0)
    expect(w.findAll('[data-test="payment-row"]')).toHaveLength(1)
    expect(w.find('[data-test="open-reverse-payment"]').exists()).toBe(true)
  })
})

describe('permissions and read failures', () => {
  it('never reads payments for a collaborator and hides the whole section', async () => {
    access.member.role = 'colaborador'
    const w = await mounted()
    expect(w.find('[data-test="agreement-payments"]').exists()).toBe(false)
    expect(paymentMocks.list).not.toHaveBeenCalled()
  })
  it('maps a 403 read to Spanish, offers a retry and exposes no register button', async () => {
    paymentMocks.list.mockRejectedValueOnce(http(403))
    const w = await mounted()
    expect(w.find('[data-test="payments-error"]').text()).toContain('personas socias')
    expect(w.findAll('[data-test="open-register-payment"]')).toHaveLength(0)
    listWith()
    await w.find('[data-test="retry-payments"]').trigger('click'); await flushPromises()
    expect(w.find('[data-test="payments-error"]').exists()).toBe(false)
    expect(w.findAll('[data-test="payment-person"]')).toHaveLength(2)
  })
  it('keeps the agreement readable and explains a payments read that fails with 401', async () => {
    paymentMocks.list.mockRejectedValueOnce(http(401))
    const w = await mounted()
    expect(w.find('[data-test="agreement-participants"]').exists()).toBe(true)
    expect(w.find('[data-test="payments-error"]').text()).toContain('sesión venció')
  })
})

describe('register payment dialog', () => {
  async function openDialog(index = 0) {
    const w = await mounted()
    await w.findAll('[data-test="open-register-payment"]')[index]!.trigger('click'); await flushPromises()
    return w
  }
  it('shows the participant figures, an empty amount and wording that only records an external payment', async () => {
    listWith()
    const w = await openDialog()
    expect(w.find('[data-test="form-participant"]').text()).toBe('Alberto')
    expect(w.find('[data-test="form-agreed"]').text()).toBe('$2,700.00')
    expect(w.find('[data-test="form-paid"]').text()).toBe('$1,000.00')
    expect(w.find('[data-test="form-pending"]').text()).toBe('$1,700.00')
    expect((w.find('#payment-amount').element as HTMLInputElement).value).toBe('')
    expect(w.find('[data-test="payment-records-only"]').text()).toContain('solo registra que este pago ya se hizo fuera del sistema')
    expect(w.find('label[for="payment-amount"]').exists()).toBe(true)
    expect(w.find('label[for="payment-when"]').exists()).toBe(true)
    expect(w.find('label[for="payment-note"]').exists()).toBe(true)
    expect(w.find('[data-test="submit-payment"]').text()).toBe('Registrar pago')
    expect(w.text()).not.toMatch(/\bPagar\b/)
  })
  it('Usar pendiente completo only fills the amount and never submits', async () => {
    listWith()
    const w = await openDialog()
    await w.find('[data-test="use-pending"]').trigger('click')
    expect((w.find('#payment-amount').element as HTMLInputElement).value).toBe('1700.00')
    expect(paymentMocks.create).not.toHaveBeenCalled()
  })
  it('sends the exact strict body once, then refreshes the summary and detail from the server', async () => {
    listWith([], partialSummaryFixture())
    const w = await openDialog()
    listWith([paymentFixture({ amountMinor: 50000 }), paymentFixture({ id: '0190bbbb-0000-7000-8000-000000000011' })], partialSummaryFixture())
    await w.find('#payment-amount').setValue('500')
    await w.find('#payment-note').setValue('  Efectivo  ')
    await w.find('form').trigger('submit'); await flushPromises()
    expect(paymentMocks.create).toHaveBeenCalledTimes(1)
    const [origin, agreementId, body] = paymentMocks.create.mock.calls[0]!
    expect(origin.memberId).toBe(agreementOrigin.memberId)
    expect(agreementId).toBe(AGREEMENT_ID)
    expect(Object.keys(body).sort()).toEqual(['amountMinor', 'createdByMemberId', 'deviceId', 'id', 'note', 'occurredAt', 'participantMemberId'])
    expect(body).toMatchObject({ participantMemberId: ALBERTO_ID, amountMinor: 50000, note: 'Efectivo' })
    expect(body.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(Date.parse(body.occurredAt)).toBeLessThanOrEqual(Date.now())
    expect(paymentMocks.list).toHaveBeenCalledTimes(2)
    expect(agreementMocks.get).toHaveBeenCalledTimes(2)
    expect(w.find('[data-test="submit-payment"]').exists()).toBe(false)
    expect(w.find('[data-test="payment-notice"]').text()).toContain('Pago registrado')
    expect(w.findAll('[data-test="payment-row"]')).toHaveLength(2)
  })
  it.each([
    ['0', 'mayor a cero'], ['abc', 'monto válido'], ['1,70', 'monto válido'], ['1700.01', 'Pendiente: $1,700.00'],
  ])('rejects amount %j in the form without sending anything', async (amount, fragment) => {
    listWith()
    const w = await openDialog()
    await w.find('#payment-amount').setValue(amount)
    await w.find('form').trigger('submit'); await flushPromises()
    expect(w.find('[data-test="payment-error"]').text()).toContain(fragment)
    expect(paymentMocks.create).not.toHaveBeenCalled()
  })
  it('rejects a future date and an empty date without sending anything', async () => {
    listWith()
    const w = await openDialog()
    await w.find('#payment-amount').setValue('10')
    await w.find('#payment-when').setValue('2999-01-01T10:00')
    await w.find('form').trigger('submit'); await flushPromises()
    expect(w.find('[data-test="payment-error"]').text()).toContain('futuro')
    await w.find('#payment-when').setValue('')
    await w.find('form').trigger('submit'); await flushPromises()
    expect(w.find('[data-test="payment-error"]').text()).toContain('fecha y hora válidas')
    expect(paymentMocks.create).not.toHaveBeenCalled()
  })
  it('shows the exact backend overpayment message with its numbers and does not keep the attempt', async () => {
    listWith()
    paymentMocks.create.mockRejectedValueOnce(http(422, 'FINANCE_PAYMENT_EXCEEDS_PENDING', { agreedMinor: 270000, paidMinor: 150000, pendingMinor: 120000 }))
    const w = await openDialog()
    await w.find('#payment-amount').setValue('1500')
    await w.find('form').trigger('submit'); await flushPromises()
    const message = w.find('[data-test="payment-error"]').text()
    for (const amount of ['$2,700.00', '$1,500.00', '$1,200.00']) expect(message).toContain(amount)
    expect(w.find('[data-test="retry-payment"]').exists()).toBe(false)
    expect(w.find('[data-test="pending-payment-alert"]').exists()).toBe(false)
  })
  it('keeps the same id and body for a manual retry after an uncertain failure and never auto-sends', async () => {
    listWith()
    paymentMocks.create.mockRejectedValueOnce(new Error('Network Error'))
    const w = await openDialog()
    await w.find('#payment-amount').setValue('500')
    await w.find('form').trigger('submit'); await flushPromises()
    expect(paymentMocks.create).toHaveBeenCalledTimes(1)
    expect(w.find('[data-test="payment-pending-notice"]').exists()).toBe(true)
    expect(w.find('[data-test="pending-payment-alert"]').exists()).toBe(true)
    expect((w.find('#payment-amount').element as HTMLInputElement).disabled).toBe(true)
    expect(w.find('[data-test="submit-payment"]').exists()).toBe(false)
    await w.find('[data-test="retry-payment"]').trigger('click'); await flushPromises()
    expect(paymentMocks.create).toHaveBeenCalledTimes(2)
    expect(paymentMocks.create.mock.calls[1]![2]).toEqual(paymentMocks.create.mock.calls[0]![2])
    expect(w.find('[data-test="pending-payment-alert"]').exists()).toBe(false)
    expect(w.find('[data-test="retry-payment"]').exists()).toBe(false)
  })
  it('blocks other register buttons while an uncertain payment is unresolved and reopens the same attempt', async () => {
    listWith()
    paymentMocks.create.mockRejectedValueOnce(http(503))
    const w = await openDialog(1)
    await w.find('#payment-amount').setValue('500')
    await w.find('form').trigger('submit'); await flushPromises()
    await w.find('[data-test="cancel-payment"]').trigger('click'); await flushPromises()
    expect(w.find('[data-test="retry-payment"]').exists()).toBe(false)
    for (const button of w.findAll('[data-test="open-register-payment"]')) expect(button.attributes('disabled')).toBeDefined()
    await w.find('[data-test="open-pending-payment"]').trigger('click'); await flushPromises()
    expect(w.find('[data-test="form-participant"]').text()).toBe('Adid')
    expect((w.find('#payment-amount').element as HTMLInputElement).value).toBe('500.00')
  })
})

describe('reverse payment dialog', () => {
  async function openReverse() {
    listWith([paymentFixture()])
    const w = await mounted()
    await w.find('[data-test="open-reverse-payment"]').trigger('click'); await flushPromises()
    return w
  }
  it('explains the correction path, requires a reason and sends it trimmed once before refreshing', async () => {
    const w = await openReverse()
    expect(w.find('[data-test="reverse-summary"]').text()).toContain('anula el pago y luego registra el pago correcto')
    expect(w.find('[data-test="confirm-payment-reverse"]').attributes('disabled')).toBeDefined()
    await w.find('#payment-reverse-reason').setValue('  Monto equivocado  ')
    listWith([voidedPaymentFixture()], paymentSummaryFixture({ hasPayments: true, paymentCount: 1 }))
    await w.find('form').trigger('submit'); await flushPromises()
    expect(paymentMocks.reverse).toHaveBeenCalledTimes(1)
    const [, paymentId, body] = paymentMocks.reverse.mock.calls[0]!
    expect(paymentId).toBe(PAYMENT_ID)
    expect(body).toMatchObject({ reason: 'Monto equivocado', createdByMemberId: agreementOrigin.memberId })
    expect(paymentMocks.list).toHaveBeenCalledTimes(2)
    expect(w.find('[data-test="confirm-payment-reverse"]').exists()).toBe(false)
    expect(w.find('[data-test="payment-notice"]').text()).toContain('ANULADO')
    expect(w.find('[data-test="payment-voided-badge"]').exists()).toBe(true)
  })
  it('keeps an uncertain reversal for manual retry with the same id', async () => {
    paymentMocks.reverse.mockRejectedValueOnce(new Error('lost'))
    const w = await openReverse()
    await w.find('#payment-reverse-reason').setValue('Motivo')
    await w.find('form').trigger('submit'); await flushPromises()
    expect(w.find('[data-test="pending-reversal-alert"]').exists()).toBe(true)
    expect((w.find('#payment-reverse-reason').element as HTMLTextAreaElement).disabled).toBe(true)
    await w.find('[data-test="retry-payment-reverse"]').trigger('click'); await flushPromises()
    expect(paymentMocks.reverse).toHaveBeenCalledTimes(2)
    expect(paymentMocks.reverse.mock.calls[1]![2]).toEqual(paymentMocks.reverse.mock.calls[0]![2])
  })
  it('shows a mapped message when the payment was already voided', async () => {
    paymentMocks.reverse.mockRejectedValueOnce(http(409, 'FINANCE_PAYMENT_ALREADY_VOIDED'))
    const w = await openReverse()
    await w.find('#payment-reverse-reason').setValue('Motivo')
    await w.find('form').trigger('submit'); await flushPromises()
    expect(w.find('[data-test="reverse-error"]').text()).toContain('ya estaba anulado')
    expect(w.find('[data-test="reverse-error"]').attributes('role')).toBe('alert')
  })
})

describe('offline', () => {
  afterEach(() => { vi.restoreAllMocks() })
  it('blocks registering with the exact copy and sends, queues and stores nothing', async () => {
    listWith()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const open = vi.fn(); vi.stubGlobal('indexedDB', { open })
    const w = await mounted()
    await w.find('[data-test="open-register-payment"]').trigger('click'); await flushPromises()
    await w.find('#payment-amount').setValue('500')
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    window.dispatchEvent(new Event('offline')); await flushPromises()
    expect(w.find('[data-test="payment-offline"]').text()).toBe('Necesitas conexión para registrar un pago.')
    expect(w.find('[data-test="submit-payment"]').attributes('disabled')).toBeDefined()
    await w.find('form').trigger('submit'); await flushPromises()
    expect(paymentMocks.create).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
    expect(w.text()).not.toMatch(/Pendiente de enviar|cola/i)
    vi.unstubAllGlobals()
  })
  it('blocks reversing with an equivalent message', async () => {
    listWith([paymentFixture()])
    const w = await mounted()
    await w.find('[data-test="open-reverse-payment"]').trigger('click'); await flushPromises()
    await w.find('#payment-reverse-reason').setValue('Motivo')
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    window.dispatchEvent(new Event('offline')); await flushPromises()
    expect(w.find('[data-test="reverse-offline"]').text()).toBe('Necesitas conexión para anular un pago.')
    await w.find('form').trigger('submit'); await flushPromises()
    expect(paymentMocks.reverse).not.toHaveBeenCalled()
  })
  it('explains that payments cannot be read without a connection', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const w = await mounted()
    expect(paymentMocks.list).not.toHaveBeenCalled()
    expect(w.find('[data-test="detail-offline"]').exists()).toBe(true)
  })
})

describe('void agreement confirmation', () => {
  it('warns that linked payments exist and will be kept as history when hasPayments is true', async () => {
    listWith([paymentFixture()])
    const w = await mounted()
    await w.find('[data-test="open-void"]').trigger('click'); await flushPromises()
    expect(w.find('[data-test="void-payments-warning"]').text()).toContain('pagos registrados')
    expect(w.find('[data-test="void-payments-warning"]').text()).toContain('se conservan como historial')
  })
  it('shows no payments warning when the agreement has no payments, voided ones included in hasPayments', async () => {
    const w = await mounted()
    await w.find('[data-test="open-void"]').trigger('click'); await flushPromises()
    expect(w.find('[data-test="void-payments-warning"]').exists()).toBe(false)
    expect(w.find('[data-test="void-payments-unknown"]').exists()).toBe(false)
  })
  it('warns when only voided payments exist because they are still history', async () => {
    listWith([voidedPaymentFixture()], paymentSummaryFixture({ hasPayments: true, paymentCount: 1, activePaymentCount: 0 }))
    const w = await mounted()
    await w.find('[data-test="open-void"]').trigger('click'); await flushPromises()
    expect(w.find('[data-test="void-payments-warning"]').exists()).toBe(true)
  })
  it('says it could not check payments when the summary is unavailable, and still allows the unchanged void', async () => {
    paymentMocks.list.mockRejectedValueOnce(new Error('Network Error'))
    const w = await mounted()
    await w.find('[data-test="open-void"]').trigger('click'); await flushPromises()
    expect(w.find('[data-test="void-payments-unknown"]').exists()).toBe(true)
    await w.find('#agreement-void-reason').setValue('Motivo')
    await w.find('form').trigger('submit'); await flushPromises()
    expect(agreementMocks.reverse).toHaveBeenCalledTimes(1)
  })
  it('falls back to a valid paymentSummary of the agreement detail when the payments read has not answered', async () => {
    paymentMocks.list.mockRejectedValueOnce(new Error('Network Error'))
    agreementMocks.get.mockResolvedValue(agreementFixture({ paymentSummary: partialSummaryFixture() }))
    const w = await mounted()
    await w.find('[data-test="open-void"]').trigger('click'); await flushPromises()
    expect(w.find('[data-test="void-payments-warning"]').exists()).toBe(true)
  })
  it('ignores a malformed paymentSummary in the agreement detail', async () => {
    paymentMocks.list.mockRejectedValueOnce(new Error('Network Error'))
    agreementMocks.get.mockResolvedValue(agreementFixture({ paymentSummary: { ...partialSummaryFixture(), status: 'PAID' } }))
    const w = await mounted()
    await w.find('[data-test="open-void"]').trigger('click'); await flushPromises()
    expect(w.find('[data-test="void-payments-warning"]').exists()).toBe(false)
    expect(w.find('[data-test="void-payments-unknown"]').exists()).toBe(true)
  })
})

describe('focus and keyboard', () => {
  it('moves focus into the dialog, closes with Escape and returns focus to the trigger', async () => {
    listWith()
    const w = await mounted()
    const trigger = w.find('[data-test="open-register-payment"]').element as HTMLElement
    trigger.focus()
    await w.find('[data-test="open-register-payment"]').trigger('click'); await flushPromises()
    expect(document.activeElement).toBe(w.find('#payment-amount').element)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await flushPromises()
    expect(w.find('[data-test="submit-payment"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })
  it('traps Tab inside the dialog and blocks Escape while a request is in flight', async () => {
    listWith()
    let finish!: (value: unknown) => void
    paymentMocks.create.mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
    const w = await mounted()
    await w.find('[data-test="open-register-payment"]').trigger('click'); await flushPromises()
    ;(w.find('[data-test="cancel-payment"]').element as HTMLElement).focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Cerrar')
    await w.find('#payment-amount').setValue('500')
    await w.find('form').trigger('submit'); await flushPromises()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await flushPromises()
    expect(w.find('#payment-amount').exists()).toBe(true)
    finish(paymentReceiptFixture()); await flushPromises()
    expect(w.find('#payment-amount').exists()).toBe(false)
  })
  it('moves focus to the section heading when the trigger disappears after reversing', async () => {
    listWith([paymentFixture()])
    const w = await mounted()
    const trigger = w.find('[data-test="open-reverse-payment"]').element as HTMLElement
    trigger.focus()
    await w.find('[data-test="open-reverse-payment"]').trigger('click'); await flushPromises()
    await w.find('#payment-reverse-reason').setValue('Motivo')
    listWith([voidedPaymentFixture()], paymentSummaryFixture({ hasPayments: true, paymentCount: 1, activePaymentCount: 0 }))
    await w.find('form').trigger('submit'); await flushPromises()
    expect(document.activeElement?.id).toBe('agreement-payments-title')
  })
})

describe('stale snapshot after a definitive rejection', () => {
  const staleSummary = () => paymentSummaryFixture({
    status: 'PARTIALLY_PAID', paidMinor: 120000, pendingMinor: 480000, hasPayments: true, paymentCount: 1, activePaymentCount: 1,
    participants: [
      participantSummaryFixture({ paidMinor: 120000, pendingMinor: 150000, status: 'PARTIALLY_PAID' }),
      participantSummaryFixture({ memberId: ADID_ID, memberName: 'Adid', agreedMinor: 330000, pendingMinor: 330000 }),
    ],
  })
  it('refreshes the dialog header, the page summary and the detail after EXCEEDS_PENDING and keeps the error', async () => {
    const w = await mounted()
    await w.find('[data-test="open-register-payment"]').trigger('click'); await flushPromises()
    expect(w.find('[data-test="form-pending"]').text()).toBe('$2,700.00')
    paymentMocks.list.mockResolvedValue({ items: [paymentFixture({ amountMinor: 120000 })], paymentSummary: staleSummary() })
    paymentMocks.create.mockRejectedValueOnce(http(422, 'FINANCE_PAYMENT_EXCEEDS_PENDING', { agreedMinor: 270000, paidMinor: 120000, pendingMinor: 150000 }))
    await w.find('#payment-amount').setValue('2000')
    await w.find('form').trigger('submit'); await flushPromises()
    expect(w.find('[data-test="payment-error"]').text()).toContain('$1,500.00')
    expect(w.find('[data-test="form-paid"]').text()).toBe('$1,200.00')
    expect(w.find('[data-test="form-pending"]').text()).toBe('$1,500.00')
    expect(w.find('[data-test="person-pending"]').text()).toBe('$1,500.00')
    expect(w.find('[data-test="payment-status"]').text()).toBe('Pago parcial')
    expect(agreementMocks.get).toHaveBeenCalledTimes(2)
    expect(w.find('[data-test="pending-payment-alert"]').exists()).toBe(false)
  })
  it('closes the dialog and shows the voided notice when the agreement was voided elsewhere', async () => {
    const w = await mounted()
    await w.find('[data-test="open-register-payment"]').trigger('click'); await flushPromises()
    agreementMocks.get.mockResolvedValue(agreementFixture({ status: 'voided', reversal: reversalFixture() }))
    paymentMocks.create.mockRejectedValueOnce(http(409, 'FINANCE_PAYMENT_AGREEMENT_VOIDED'))
    await w.find('#payment-amount').setValue('100')
    await w.find('form').trigger('submit'); await flushPromises()
    expect(w.find('[data-test="submit-payment"]').exists()).toBe(false)
    expect(w.find('[data-test="payments-voided-notice"]').exists()).toBe(true)
    expect(w.findAll('[data-test="open-register-payment"]')).toHaveLength(0)
  })
  it('shows ANULADO on the payment row after ALREADY_VOIDED', async () => {
    listWith([paymentFixture()])
    const w = await mounted()
    await w.find('[data-test="open-reverse-payment"]').trigger('click'); await flushPromises()
    listWith([voidedPaymentFixture()])
    paymentMocks.reverse.mockRejectedValueOnce(http(409, 'FINANCE_PAYMENT_ALREADY_VOIDED'))
    await w.find('#payment-reverse-reason').setValue('Motivo')
    await w.find('form').trigger('submit'); await flushPromises()
    expect(w.find('[data-test="payment-voided-badge"]').text()).toBe('ANULADO')
    expect(w.find('[data-test="reverse-error"]').text()).toContain('ya estaba anulado')
    expect(agreementMocks.get).toHaveBeenCalledTimes(2)
  })
  it('does not refresh anything after an uncertain failure', async () => {
    const w = await mounted()
    await w.find('[data-test="open-register-payment"]').trigger('click'); await flushPromises()
    paymentMocks.create.mockRejectedValueOnce(new Error('Network Error'))
    await w.find('#payment-amount').setValue('100')
    await w.find('form').trigger('submit'); await flushPromises()
    expect(paymentMocks.list).toHaveBeenCalledTimes(1)
    expect(agreementMocks.get).toHaveBeenCalledTimes(1)
    expect(w.find('[data-test="retry-payment"]').exists()).toBe(true)
  })
})
