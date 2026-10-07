import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { reactive } from 'vue'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReservesView from '../ReservesView.vue'
import { addDaysToKey, businessToday } from '@/utils/business-time'
import {
  CANCEL_ID,
  RESERVE_ID,
  cancellationFixture,
  cancellationReceiptFixture,
  reserveItemFixture,
  reservePageFixture,
  reserveReceiptFixture,
} from '@/services/__tests__/finance-reserves.fixture'

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  cancel: vi.fn(),
  session: { member: { role: 'socio' } as { role: string } },
  mode: { currentMode: 'gestion' } as { currentMode: string },
  route: { query: {} as Record<string, unknown> },
}))
vi.mock('@/services/finance-reserves.service', () => ({
  FinanceReservesService: { list: mocks.list, create: mocks.create, cancel: mocks.cancel },
}))
vi.mock('@/services/finance-overview.service', () => ({ FinanceOverviewService: { get: vi.fn() } }))
vi.mock('@/services/work-shifts.service', () => ({ WorkShiftsService: { summary: vi.fn() } }))
vi.mock('@/services/queue-origin', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/queue-origin')>()),
  currentQueueOrigin: () => ({ accountId: 'a', apiBase: '/api/v1', memberId: 'm', deviceId: 'd' }),
}))
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRoute: () => mocks.route,
}))
vi.mock('@/stores/uiMode.store', () => ({ useUiModeStore: () => mocks.mode }))
vi.mock('@/stores/session.store', () => ({ useSessionStore: () => mocks.session }))

const today = businessToday()
const monthStart = `${today.slice(0, 8)}01`
const tomorrow = addDaysToKey(today, 1)
const monthItem = (over = {}) => reserveItemFixture({ periodFrom: monthStart, periodTo: tomorrow, ...over })
const failure = (status?: number) => Object.assign(new Error('x'), status ? { response: { status } } : {})

beforeEach(() => {
  setActivePinia(createPinia())
  mocks.list.mockReset()
  mocks.create.mockReset()
  mocks.cancel.mockReset()
  mocks.session.member = { role: 'socio' }
  mocks.mode.currentMode = 'gestion'
  mocks.route.query = {}
  mocks.list.mockResolvedValue(reservePageFixture([monthItem()]))
})

const mountView = (attach = false) =>
  mount(ReservesView, {
    attachTo: attach ? document.body : undefined,
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
async function mounted(attach = false) {
  const w = mountView(attach)
  await flushPromises()
  return w
}
type Wrapper = Awaited<ReturnType<typeof mounted>>
const q = (w: Wrapper, name: string) => w.find(`[data-test="${name}"]`)
async function fillForm(w: Wrapper, name: string, amount: string, note = '') {
  await w.find('#reserve-name').setValue(name)
  await w.find('#reserve-amount').setValue(amount)
  if (note) await w.find('#reserve-note').setValue(note)
}

describe('reserves screen: access, tabs and request', () => {
  it('lists Reservas as the last, active tab and has a single h1', async () => {
    const w = await mounted()
    const tabs = w.findAllComponents(RouterLinkStub)
    expect(tabs.map((t) => t.text())).toEqual(['Resumen', 'Aportaciones', 'Gastos', 'Jornadas', 'Reservas'])
    expect(tabs.at(-1)!.attributes('aria-current')).toBe('page')
    expect(w.findAll('h1')).toHaveLength(1)
    expect(w.find('h1').text()).toBe('Reservas')
  })

  it('loads the month so far once, asking for the EXACT period with an exclusive end', async () => {
    await mounted()
    expect(mocks.list).toHaveBeenCalledTimes(1)
    expect(mocks.list.mock.calls[0]![1]).toEqual({ status: 'active', limit: 20, from: monthStart, to: tomorrow })
  })

  it('starts on the period linked from the overview when it is valid', async () => {
    const from = addDaysToKey(today, -3)
    mocks.route.query = { from, to: today }
    const w = await mounted()
    expect(mocks.list.mock.calls[0]![1]).toMatchObject({ from, to: tomorrow })
    expect(q(w, 'form-period').text()).toContain('al')
  })

  it('ignores a malformed linked period', async () => {
    mocks.route.query = { from: 'x', to: tomorrow }
    await mounted()
    expect(mocks.list.mock.calls[0]![1]).toMatchObject({ from: monthStart, to: tomorrow })
  })

  it('accepts a linked period that ends in the future', async () => {
    mocks.route.query = { from: '2099-12-01', to: '2099-12-31' }
    await mounted()
    expect(mocks.list.mock.calls[0]![1]).toMatchObject({ from: '2099-12-01', to: '2100-01-01' })
  })

  it('does not render nor load for a collaborator or in sales mode', async () => {
    mocks.session.member = { role: 'colaborador' }
    let w = await mounted()
    expect(w.text()).toContain('Solo socios')
    mocks.session.member = { role: 'socio' }
    mocks.mode.currentMode = 'venta'
    w = await mounted()
    expect(w.text()).toContain('Solo socios')
    expect(mocks.list).not.toHaveBeenCalled()
  })

  it('requests once when access becomes allowed after mount', async () => {
    mocks.session = reactive({ member: { role: 'colaborador' } })
    const w = await mounted()
    expect(mocks.list).not.toHaveBeenCalled()
    mocks.session.member = { role: 'socio' }
    await flushPromises()
    expect(mocks.list).toHaveBeenCalledTimes(1)
    expect(w.find('[data-test="form-section"]').exists()).toBe(true)
  })

  it('makes one request per period change and one per filter change', async () => {
    const w = await mounted()
    mocks.list.mockClear()
    await w.findAll('.report-range-picker__preset')[0]!.trigger('click') // Hoy
    await flushPromises()
    expect(mocks.list).toHaveBeenCalledTimes(1)
    expect(mocks.list.mock.calls[0]![1]).toMatchObject({ from: today, to: tomorrow })
    mocks.list.mockClear()
    await q(w, 'scope-all').trigger('click')
    await flushPromises()
    expect(mocks.list).toHaveBeenCalledTimes(1)
    expect(mocks.list.mock.calls[0]![1]).not.toHaveProperty('from')
    mocks.list.mockClear()
    await w.find('#reserve-status').setValue('reversed')
    await flushPromises()
    expect(mocks.list).toHaveBeenCalledTimes(1)
    expect(mocks.list.mock.calls[0]![1]).toMatchObject({ status: 'reversed' })
  })

  it('does not request while the range is invalid', async () => {
    const w = await mounted()
    mocks.list.mockClear()
    const inputs = w.findAll('input[type="date"]')
    await inputs[0]!.setValue(today)
    await inputs[1]!.setValue(addDaysToKey(today, -3))
    await q(w, 'scope-all').trigger('click')
    await flushPromises()
    expect(mocks.list).not.toHaveBeenCalled()
  })
})

describe('reserves screen: list', () => {
  it('shows stacked cards (never a table) with name, big amount, inclusive period, note and status', async () => {
    mocks.list.mockResolvedValue(reservePageFixture([monthItem({ note: 'Esperando cotización' })]))
    const w = await mounted()
    expect(w.find('table').exists()).toBe(false)
    const cards = w.findAll('[data-test="reserve-card"]')
    expect(cards).toHaveLength(1)
    const text = cards[0]!.text()
    expect(text).toContain('Renta del local')
    expect(text).toContain('$5,000.00')
    expect(text).toContain('Esperando cotización')
    expect(text).toContain('Activa')
    expect(text).toMatch(/Período: 01\/\d{2}\/\d{4}/)
    expect(w.find('ul[data-test="reserve-list"]').exists()).toBe(true)
  })

  it('shows the period end as an inclusive day, not the stored exclusive one', async () => {
    mocks.list.mockResolvedValue(reservePageFixture([reserveItemFixture()]))
    const w = await mounted()
    expect(q(w, 'reserve-card').text()).toContain('01/10/2026 al 31/10/2026')
  })

  it('totals only active reserves of the selected period and keeps other periods apart', async () => {
    const other = reserveItemFixture({ id: CANCEL_ID, name: 'Mes pasado', periodFrom: '2026-09-01', periodTo: '2026-10-01', amountMinor: 90000 })
    mocks.list.mockResolvedValue(reservePageFixture([monthItem(), monthItem({ id: RESERVE_ID.replace(/1$/, '3'), amountMinor: 250 }), other]))
    const w = await mounted()
    await q(w, 'scope-all').trigger('click')
    await flushPromises()
    expect(q(w, 'total-period').text()).toContain('$5,002.50')
    expect(q(w, 'total-other').text()).toContain('$900.00')
    const flagged = w.findAll('[data-test="not-counted"]')
    expect(flagged).toHaveLength(1)
    expect(flagged[0]!.text()).toBe('No cuentan en este período')
    expect(flagged[0]!.element.closest('[data-test="reserve-card"]')!.textContent).toContain('Mes pasado')
  })

  it('shows a cancelled reserve with its reason and date, and no Anular button', async () => {
    mocks.list.mockResolvedValue(
      reservePageFixture([monthItem({ status: 'reversed', reversal: cancellationFixture({ reason: 'Ya no se necesita' }) })]),
    )
    const w = await mounted()
    await w.find('#reserve-status').setValue('reversed')
    await flushPromises()
    const card = q(w, 'reserve-card')
    expect(card.text()).toContain('Anulada')
    expect(q(w, 'reversal').text()).toMatch(/Anulada el 08\/10\/2026\. Motivo: Ya no se necesita/)
    expect(q(w, 'cancel-open').exists()).toBe(false)
    expect(q(w, 'totals').exists()).toBe(false)
  })

  it('shows a loading skeleton, then an empty state', async () => {
    let resolve!: (v: unknown) => void
    mocks.list.mockReturnValueOnce(new Promise((r) => (resolve = r)))
    const w = mountView()
    await flushPromises()
    expect(q(w, 'skeleton').exists()).toBe(true)
    resolve(reservePageFixture([]))
    await flushPromises()
    expect(q(w, 'skeleton').exists()).toBe(false)
    expect(q(w, 'empty').text()).toBe('No hay reservas activas para este período.')
  })

  it('shows a calm error with retry and keeps the last loaded list', async () => {
    const w = await mounted()
    mocks.list.mockRejectedValueOnce(failure())
    await q(w, 'scope-all').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('No se pudo actualizar la lista')
    expect(w.text()).toContain('Se conserva la última lista cargada')
    expect(w.findAll('[data-test="reserve-card"]')).toHaveLength(1)
    mocks.list.mockResolvedValueOnce(reservePageFixture([monthItem()]))
    await q(w, 'retry').trigger('click')
    await flushPromises()
    expect(w.text()).not.toContain('No se pudo actualizar la lista')
  })

  it('loads more with the cursor unchanged', async () => {
    mocks.list.mockResolvedValueOnce(reservePageFixture([monthItem()], 'cursor-1=='))
    const w = await mounted()
    expect(q(w, 'total-period').element.parentElement!.textContent).toContain('Hay más reservas por cargar')
    mocks.list.mockResolvedValueOnce(
      reservePageFixture([monthItem({ id: '0199a600-0000-7000-8000-0000000000aa', name: 'Luz' })], null),
    )
    await q(w, 'load-more').trigger('click')
    await flushPromises()
    expect(mocks.list.mock.calls[1]![1]).toMatchObject({ cursor: 'cursor-1==' })
    expect(w.findAll('[data-test="reserve-card"]')).toHaveLength(2)
    expect(q(w, 'load-more').exists()).toBe(false)
  })

  it('explains that only the exact period is subtracted from the potentially available amount', async () => {
    const w = await mounted()
    expect(q(w, 'exact-note').text()).toBe(
      'Solo las reservas creadas para exactamente este período se restan del monto potencialmente disponible.',
    )
  })
})

describe('reserves screen: create', () => {
  it('validates before calling the API', async () => {
    const w = await mounted()
    await q(w, 'create-form').trigger('submit')
    expect(q(w, 'form-error').text()).toBe('Escribe un nombre para la reserva.')
    await fillForm(w, 'Renta', '0')
    await q(w, 'create-form').trigger('submit')
    expect(q(w, 'form-error').text()).toContain('mayor que cero')
    await fillForm(w, 'Renta', '10.5')
    await w.find('#reserve-note').setValue('n'.repeat(1001))
    await q(w, 'create-form').trigger('submit')
    expect(q(w, 'form-error').text()).toContain('La nota admite')
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('creates a reserve for the applied period with the exclusive end, then clears the form and announces it', async () => {
    mocks.create.mockResolvedValue(reserveReceiptFixture({ name: 'Renta' }))
    const w = await mounted(true)
    await fillForm(w, '  Renta  ', '1,500.00', ' Esperando cotización ')
    mocks.list.mockClear()
    await q(w, 'create-form').trigger('submit')
    await flushPromises()
    const body = mocks.create.mock.calls[0]![1]
    expect(body).toMatchObject({
      name: 'Renta',
      amountMinor: 150000,
      periodFrom: monthStart,
      periodTo: tomorrow,
      note: 'Esperando cotización',
      createdByMemberId: 'm',
      deviceId: 'd',
    })
    expect(mocks.list).toHaveBeenCalledTimes(1) // refreshed
    expect(q(w, 'saved').text()).toContain('Reserva guardada: Renta')
    expect(q(w, 'status').attributes('aria-live')).toBe('polite')
    expect((w.find('#reserve-name').element as HTMLInputElement).value).toBe('')
    expect(document.activeElement).toBe(q(w, 'status').element)
    w.unmount()
  })

  it('on a network failure shows the calm message, keeps what was typed and retries with the same id', async () => {
    mocks.create.mockRejectedValueOnce(failure()).mockResolvedValue(reserveReceiptFixture())
    const w = await mounted()
    await fillForm(w, 'Renta', '1500')
    await q(w, 'create-form').trigger('submit')
    await flushPromises()
    expect(q(w, 'form-error').text()).toBe('No pudimos guardar la reserva. Revisa tu conexión; si reintentas no se duplicará.')
    expect(q(w, 'saved').exists()).toBe(false)
    expect((w.find('#reserve-name').element as HTMLInputElement).value).toBe('Renta')
    await q(w, 'create-form').trigger('submit')
    await flushPromises()
    expect(mocks.create.mock.calls[1]![1].id).toBe(mocks.create.mock.calls[0]![1].id)
    expect(q(w, 'saved').exists()).toBe(true)
  })

  it('shows a clear non-technical message on a 409 conflict', async () => {
    mocks.create.mockRejectedValue(failure(409))
    const w = await mounted()
    await fillForm(w, 'Renta', '1500')
    await q(w, 'create-form').trigger('submit')
    await flushPromises()
    expect(q(w, 'form-error').text()).toContain('Revisa la lista')
    expect(q(w, 'form-error').text()).not.toMatch(/409|conflict/i)
  })

  it('tells the person to apply changed dates before they are used for the reserve', async () => {
    const w = await mounted()
    const inputs = w.findAll('input[type="date"]')
    await inputs[0]!.setValue(addDaysToKey(today, -5))
    expect(q(w, 'period-pending').exists()).toBe(true)
    mocks.create.mockResolvedValue(reserveReceiptFixture())
    await fillForm(w, 'Renta', '1500')
    await q(w, 'create-form').trigger('submit')
    await flushPromises()
    expect(mocks.create.mock.calls[0]![1].periodFrom).toBe(monthStart) // still the applied period
  })
})

describe('reserves screen: cancel', () => {
  it('opens a confirm panel that requires a reason and explains cancel-and-recreate', async () => {
    const w = await mounted(true)
    const open = q(w, 'cancel-open')
    expect(open.element.tagName).toBe('BUTTON')
    expect(open.attributes('aria-label')).toBe('Anular reserva Renta del local')
    await open.trigger('click')
    await flushPromises()
    const panel = q(w, 'cancel-panel')
    expect(panel.attributes('role')).toBe('group')
    expect(panel.text()).toContain('anula esta reserva y crea una nueva')
    expect(document.activeElement?.tagName).toBe('TEXTAREA')
    await panel.trigger('submit')
    expect(panel.text()).toContain('Escribe el motivo de la anulación.')
    expect(mocks.cancel).not.toHaveBeenCalled()
    w.unmount()
  })

  it('cancels with a NEW id and the reason, announces it and refreshes the list', async () => {
    mocks.cancel.mockResolvedValue(cancellationReceiptFixture())
    const w = await mounted(true)
    await q(w, 'cancel-open').trigger('click')
    await flushPromises()
    await q(w, 'cancel-reason').find('textarea').setValue('  Ya no se necesita ')
    mocks.list.mockClear()
    mocks.list.mockResolvedValueOnce(reservePageFixture([]))
    await q(w, 'cancel-panel').trigger('submit')
    await flushPromises()
    const [, reserveId, body] = mocks.cancel.mock.calls[0]!
    expect(reserveId).toBe(RESERVE_ID)
    expect(body.reason).toBe('Ya no se necesita')
    expect(body.id).not.toBe(RESERVE_ID)
    expect(q(w, 'cancelled').text()).toContain('Reserva anulada: Renta del local')
    expect(mocks.list).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(q(w, 'status').element)
    w.unmount()
  })

  it('keeps the panel open with a calm error when cancelling fails, and returns focus when dismissed', async () => {
    mocks.cancel.mockRejectedValue(failure())
    const w = await mounted(true)
    await q(w, 'cancel-open').trigger('click')
    await flushPromises()
    await q(w, 'cancel-reason').find('textarea').setValue('motivo')
    await q(w, 'cancel-panel').trigger('submit')
    await flushPromises()
    expect(q(w, 'cancel-error').text()).toContain('No pudimos anular la reserva')
    expect(q(w, 'cancelled').exists()).toBe(false)
    await q(w, 'cancel-dismiss').trigger('click')
    await flushPromises()
    expect(q(w, 'cancel-panel').exists()).toBe(false)
    expect(document.activeElement).toBe(q(w, 'cancel-open').element)
    w.unmount()
  })
})

describe('reserves screen: period hint and future period end', () => {
  async function apply(w: Wrapper, from: string, to: string) {
    const inputs = w.findAll('input[type="date"]')
    await inputs[0]!.setValue(from)
    await inputs[1]!.setValue(to)
    await w.find('form.report-range-picker').trigger('submit')
    await flushPromises()
  }

  it('shows a calm hint for the month-to-date default, linked to the period text', async () => {
    const w = await mounted()
    const hint = q(w, 'period-hint')
    expect(hint.exists()).toBe(true)
    expect(hint.text()).toContain('solo cuenta cuando consultas exactamente este período')
    expect(hint.attributes('role')).toBe('status')
    expect(hint.attributes('id')).toBeTruthy()
    expect(q(w, 'form-period').attributes('aria-describedby')).toBe(hint.attributes('id'))
  })

  it('hides the hint for a closed full-month period (even a past one) and shows it again for a partial one', async () => {
    const w = await mounted()
    await apply(w, '2026-09-01', '2026-09-30')
    expect(q(w, 'period-hint').exists()).toBe(false)
    expect(q(w, 'form-period').attributes('aria-describedby')).toBeUndefined()
    await apply(w, '2026-09-01', '2026-09-15')
    expect(q(w, 'period-hint').exists()).toBe(true)
  })

  it('accepts a future month end and sends the exclusive end across a month boundary', async () => {
    const w = await mounted()
    mocks.list.mockClear()
    await apply(w, '2099-04-01', '2099-04-30')
    expect(w.find('.report-range-picker__error').exists()).toBe(false)
    expect(mocks.list).toHaveBeenCalledTimes(1)
    expect(mocks.list.mock.calls[0]![1]).toMatchObject({ from: '2099-04-01', to: '2099-05-01' })
    expect(q(w, 'period-hint').exists()).toBe(false)
  })

  it('creates a reserve for a future full month with the exclusive end across a year boundary', async () => {
    mocks.create.mockResolvedValue(reserveReceiptFixture())
    const w = await mounted()
    await apply(w, '2099-12-01', '2099-12-31')
    await fillForm(w, 'Aguinaldo', '1000')
    await q(w, 'create-form').trigger('submit')
    await flushPromises()
    expect(mocks.create.mock.calls[0]![1]).toMatchObject({ periodFrom: '2099-12-01', periodTo: '2100-01-01' })
  })

  it('still rejects an inverted range', async () => {
    const w = await mounted()
    mocks.list.mockClear()
    await apply(w, '2099-12-31', '2099-12-01')
    expect(mocks.list).not.toHaveBeenCalled()
    expect(w.text()).toContain('La fecha inicial es posterior a la final')
  })

  it('does not cap the date inputs at today', async () => {
    const w = await mounted()
    for (const input of w.findAll('input[type="date"]')) expect(input.attributes('max')).toBeUndefined()
  })
})

describe('reserves screen: two open cancel panels', () => {
  const second = () =>
    reserveItemFixture({ id: '0199a600-0000-7000-8000-0000000000aa', name: 'Luz', periodFrom: monthStart, periodTo: tomorrow })
  const confirmFor = (w: Wrapper, index: number) => w.findAll('[data-test="cancel-confirm"]')[index]!
  async function openBoth(w: Wrapper) {
    for (const button of w.findAll('[data-test="cancel-open"]').slice().reverse()) await button.trigger('click')
    await flushPromises()
    const reasons = w.findAll('[data-test="cancel-reason"] textarea')
    expect(reasons).toHaveLength(2)
    for (const r of reasons) await r.setValue('motivo')
  }

  it('blocks the second confirm while the first is in flight and keeps busy on the first card only', async () => {
    mocks.list.mockResolvedValue(reservePageFixture([monthItem(), second()]))
    let finish!: (v: unknown) => void
    mocks.cancel.mockReturnValueOnce(new Promise((res) => (finish = res)))
    const w = await mounted()
    await openBoth(w)
    await w.findAll('[data-test="cancel-panel"]')[0]!.trigger('submit')
    await flushPromises()
    expect(mocks.cancel).toHaveBeenCalledTimes(1)
    expect(confirmFor(w, 1).attributes('disabled')).toBeDefined()
    expect(w.findAll('[data-test="cancel-blocked"]')).toHaveLength(1)
    expect(w.findAll('[data-test="cancel-blocked"]')[0]!.text()).toContain('Espera a que termine la anulación en curso.')
    await w.findAll('[data-test="cancel-panel"]')[1]!.trigger('submit')
    await flushPromises()
    expect(mocks.cancel).toHaveBeenCalledTimes(1)
    expect(w.findAll('[data-test="cancel-dismiss"]')[0]!.attributes('disabled')).toBeDefined()
    expect(w.findAll('[data-test="cancel-dismiss"]')[1]!.attributes('disabled')).toBeUndefined()
    finish(cancellationReceiptFixture())
    await flushPromises()
  })

  it('shows the failure of the first only on the first card, then lets the second be confirmed', async () => {
    mocks.list.mockResolvedValue(reservePageFixture([monthItem(), second()]))
    mocks.cancel.mockRejectedValueOnce(failure()).mockResolvedValue(cancellationReceiptFixture())
    const w = await mounted()
    await openBoth(w)
    await w.findAll('[data-test="cancel-panel"]')[0]!.trigger('submit')
    await flushPromises()
    const panels = w.findAll('[data-test="cancel-panel"]')
    expect(panels[0]!.find('[data-test="cancel-error"]').exists()).toBe(true)
    expect(panels[1]!.find('[data-test="cancel-error"]').exists()).toBe(false)
    expect(confirmFor(w, 1).attributes('disabled')).toBeUndefined()
    await panels[1]!.trigger('submit')
    await flushPromises()
    expect(mocks.cancel).toHaveBeenCalledTimes(2)
    expect(mocks.cancel.mock.calls[1]![1]).toBe(second().id)
    expect(q(w, 'cancelled').text()).toContain('Luz')
  })
})

describe('reserves screen: structure and accessibility', () => {
  it('puts the form before the list in a two-column layout hook and labels every field', async () => {
    const w = await mounted()
    const layout = w.find('.reserves-layout')
    expect(layout.exists()).toBe(true)
    expect(layout.findAll('section').map((s) => s.attributes('data-test'))).toEqual(['form-section', 'list-section'])
    expect(w.findAll('h2').map((h) => h.text())).toEqual(['Nueva reserva', 'Reservas registradas'])
    for (const id of ['reserve-name', 'reserve-amount', 'reserve-note', 'reserve-status'])
      expect(w.find(`label[for="${id}"]`).exists(), id).toBe(true)
    expect(q(w, 'save').element.tagName).toBe('BUTTON')
    expect(q(w, 'scope-period').attributes('aria-pressed')).toBe('true')
  })

  it('never uses forbidden wording or distribution/percentage controls', async () => {
    const w = await mounted()
    expect(w.text()).not.toMatch(/ganancia para repartir|reparto|comisi[oó]n|sueldo/i)
    expect(w.find('input[type="range"]').exists()).toBe(false)
    expect(w.text()).toContain('no mueve dinero')
  })

  it('keeps the form and the list stacked until a wide viewport (the sidebar leaves narrow columns)', () => {
    // jsdom has no layout engine, so the breakpoint is asserted on the stylesheet itself.
    const source = readFileSync(resolve(process.cwd(), 'src/views/finance/ReservesView.vue'), 'utf8')
    const twoColumn = source.match(/@media \(min-width: (\d+)px\)\s*\{\s*\.reserves-layout\s*\{[^}]*grid-template-columns/)
    expect(twoColumn).not.toBeNull()
    expect(Number(twoColumn![1])).toBeGreaterThanOrEqual(1024)
  })
})
