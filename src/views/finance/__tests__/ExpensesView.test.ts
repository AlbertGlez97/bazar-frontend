import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ExpensesView from '../ExpensesView.vue'
import viewSource from '../ExpensesView.vue?raw'
import AppModal from '@/components/ui/organisms/AppModal.vue'
import { businessToday } from '@/utils/business-time'
import type { Expense, ExpenseSummary } from '@/types/expense.types'
import type { FinanceReferences } from '@/services/contributions-records'
import type { PendingExpense } from '@/services/expense-records'

const members = [
  { id: 'ana', name: 'Ana', role: 'socio', active: true },
  { id: 'beto', name: 'Beto', role: 'colaborador', active: true },
  { id: 'old', name: 'Olga', role: 'colaborador', active: false },
]
const mocks = vi.hoisted(() => ({
  store: {
    history: [] as Expense[],
    pending: [] as PendingExpense[],
    payers: [] as unknown[],
    allMembers: [] as unknown[],
    references: null as FinanceReferences | null,
    summary: null as { from: string; to: string; value: ExpenseSummary } | null,
    syncing: false,
    error: '',
    nextCursor: null as string | null,
    load: vi.fn(),
    refresh: vi.fn(),
    refreshSummary: vi.fn(),
    create: vi.fn(),
    reverse: vi.fn(),
    retry: vi.fn(),
  },
  session: { member: { role: 'socio' } },
  mode: { currentMode: 'gestion' },
}))
vi.mock('@/stores/expenses.store', () => ({
  useExpensesStore: () => mocks.store,
}))
vi.mock('@/stores/uiMode.store', () => ({ useUiModeStore: () => mocks.mode }))
vi.mock('@/stores/session.store', () => ({
  useSessionStore: () => mocks.session,
}))

const today = businessToday()
const monthDay = `${today.slice(0, 7)}-01`
const expense = (over: Partial<Expense> = {}): Expense => ({
  id: 'e1',
  amountMinor: 45050,
  occurredAt: `${monthDay}T06:00:00Z`,
  nature: 'OPERATING_EXPENSE',
  category: 'transport',
  description: 'Flete del bazar',
  paidByMemberId: 'ana',
  fundsSource: 'PERSONAL',
  createdByMemberId: 'ana',
  deviceId: 'device',
  contextId: 'business',
  currency: 'MXN',
  createdByAccountId: 'account',
  receivedAt: `${monthDay}T12:00:00Z`,
  reversal: null,
  ...over,
})
const pendingRecord = (
  state: PendingExpense['state'],
  payload = expense(),
): PendingExpense => ({
  kind: 'create',
  payload,
  origin: { accountId: 'account', apiBase: '/api/v1', memberId: 'ana', deviceId: 'device' },
  id: payload.id,
  key: 'k' + payload.id,
  scope: 'scope',
  createdAt: payload.occurredAt,
  state,
  attempts: state === 'pending' ? 0 : 1,
  nextAttemptAt: 0,
  ...(state === 'pending' ? {} : { lastError: 'El servidor rechazó el registro.' }),
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.session.member = { role: 'socio' }
  mocks.mode.currentMode = 'gestion'
  mocks.store.history = []
  mocks.store.pending = []
  mocks.store.payers = members.filter((m) => m.active)
  mocks.store.allMembers = members
  mocks.store.references = { scope: 's', members: members as never, savedAt: '2026-10-03T12:00:00Z' }
  mocks.store.summary = null
  mocks.store.error = ''
  mocks.store.nextCursor = null
  mocks.store.create.mockResolvedValue('id')
  mocks.store.reverse.mockResolvedValue(undefined)
  mocks.store.refresh.mockResolvedValue(undefined)
  mocks.store.refreshSummary.mockResolvedValue(null)
})

const mountView = () =>
  mount(ExpensesView, {
    global: {
      stubs: {
        RouterLink: RouterLinkStub,
        AppModal: { template: '<div><slot/><slot name="footer"/></div>' },
      },
    },
  })

async function fillValid(w: ReturnType<typeof mountView>) {
  await w.find('#expense-category').setValue('transport')
  await w.find('#expense-amount').setValue('450.50')
  await w.find('#expense-date').setValue(monthDay)
  await w.find('#expense-payer').setValue('ana')
  await w.find('#expense-funds').setValue('PERSONAL')
  await w.find('#expense-description').setValue('  Flete del bazar  ')
}

describe('expenses screen', () => {
  it('opts its correction modal into keyboard focus management', async () => {
    const w = mount(ExpensesView, {
      global: { stubs: { RouterLink: RouterLinkStub } },
    })
    await flushPromises()
    expect(w.getComponent(AppModal).props('manageFocus')).toBe(true)
    w.unmount()
  })

  it('shows the Aportaciones | Gastos tabs with Gastos active and the form fields', async () => {
    const w = mountView()
    await flushPromises()
    const tabs = w.findAllComponents(RouterLinkStub)
    expect(tabs.map((t) => t.text())).toEqual(['Aportaciones', 'Gastos'])
    expect(tabs[1]!.attributes('aria-current')).toBe('page')
    expect(w.text()).toContain('Registrar gasto')
    for (const id of ['nature', 'category', 'amount', 'date', 'payer', 'funds', 'description'])
      expect(w.find(`#expense-${id}`).exists()).toBe(true)
    expect(w.text()).toContain('Origen del dinero')
    expect(mocks.store.refresh).toHaveBeenCalled()
  })

  it('does not render for a collaborator or in sales mode and never loads data', async () => {
    mocks.session.member = { role: 'colaborador' }
    let w = mountView()
    await flushPromises()
    expect(w.find('#expense-amount').exists()).toBe(false)
    expect(w.text()).toContain('Solo socios')
    mocks.session.member = { role: 'socio' }
    mocks.mode.currentMode = 'venta'
    w = mountView()
    await flushPromises()
    expect(w.find('#expense-amount').exists()).toBe(false)
    expect(mocks.store.refresh).not.toHaveBeenCalled()
  })

  it('offers the 11 operating categories, and Inventario is forced for an inventory purchase', async () => {
    const w = mountView()
    await flushPromises()
    const labels = w.findAll('#expense-category option').map((o) => o.text())
    expect(labels).toEqual([
      'Selecciona una categoría', 'Transporte', 'Gasolina', 'Alimentos', 'Bazar / renta',
      'Almacenamiento', 'Publicidad', 'Servicios', 'Empaque / consumibles',
      'Mantenimiento', 'Pago operativo', 'Otro',
    ])
    expect(labels).not.toContain('Inventario')
    await w.find('#expense-nature').setValue('INVENTORY_PURCHASE')
    const category = w.find('#expense-category')
    expect(category.findAll('option').map((o) => o.text())).toEqual(['Inventario'])
    expect(category.attributes('disabled')).toBeDefined()
    await w.find('#expense-nature').setValue('OPERATING_EXPENSE')
    expect(w.find('#expense-category').findAll('option')).toHaveLength(12)
  })

  it('only lets active members be chosen as the payer', async () => {
    const w = mountView()
    await flushPromises()
    const names = w.findAll('#expense-payer option').map((o) => o.text())
    expect(names).toContain('Ana')
    expect(names).toContain('Beto')
    expect(names).not.toContain('Olga')
  })

  it('submits integer minor units, business-day midnight and a trimmed description', async () => {
    const w = mountView()
    await flushPromises()
    await fillValid(w)
    await w.find('[data-test="create-form"]').trigger('submit')
    await flushPromises()
    expect(mocks.store.create).toHaveBeenCalledWith({
      amountMinor: 45050,
      occurredAt: `${monthDay}T00:00:00-06:00`,
      nature: 'OPERATING_EXPENSE',
      category: 'transport',
      description: 'Flete del bazar',
      paidByMemberId: 'ana',
      fundsSource: 'PERSONAL',
    })
    expect(w.text()).toContain('Gasto guardado en este dispositivo')
  })

  it('submits an inventory purchase with the Inventario category', async () => {
    const w = mountView()
    await flushPromises()
    await fillValid(w)
    await w.find('#expense-nature').setValue('INVENTORY_PURCHASE')
    await w.find('[data-test="create-form"]').trigger('submit')
    await flushPromises()
    expect(mocks.store.create).toHaveBeenCalledWith(
      expect.objectContaining({ nature: 'INVENTORY_PURCHASE', category: 'inventory' }),
    )
  })

  it.each([
    ['a missing category', { '#expense-category': '' }, 'categoría'],
    ['an ambiguous amount', { '#expense-amount': '100,50' }, 'importe'],
    ['a zero amount', { '#expense-amount': '0' }, 'importe'],
    ['a missing payer', { '#expense-payer': '' }, 'quién pagó'],
    ['a missing funds origin', { '#expense-funds': '' }, 'origen'],
    ['a blank description', { '#expense-description': '   ' }, 'Describe'],
  ])('does not save %s and says what is wrong', async (_name, change, text) => {
    const w = mountView()
    await flushPromises()
    await fillValid(w)
    for (const [selector, value] of Object.entries(change))
      await w.find(selector).setValue(value)
    await w.find('[data-test="create-form"]').trigger('submit')
    await flushPromises()
    expect(mocks.store.create).not.toHaveBeenCalled()
    expect(w.find('[role="alert"]').text()).toContain(text)
  })

  it('does not claim success when durable storage fails', async () => {
    mocks.store.create.mockRejectedValue(new Error('disk full'))
    const w = mountView()
    await flushPromises()
    await fillValid(w)
    await w.find('[data-test="create-form"]').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('No se pudo guardar el gasto')
    expect(w.text()).not.toContain('Gasto guardado en este dispositivo')
    // the typed data is kept so nothing is lost
    expect((w.find('#expense-description').element as HTMLTextAreaElement).value).toBe('  Flete del bazar  ')
  })

  it('lists rows with date, amount, nature, category, payer, origin, state and a short description', async () => {
    mocks.store.history = [
      expense({ description: 'x'.repeat(200), id: 'long' }),
      expense({ id: 'inv', nature: 'INVENTORY_PURCHASE', category: 'inventory', fundsSource: 'BUSINESS', paidByMemberId: 'old', amountMinor: 1200000 }),
    ]
    mocks.store.pending = [pendingRecord('pending', expense({ id: 'new', category: 'fuel', amountMinor: 9900 }))]
    const w = mountView()
    await flushPromises()
    const rows = w.findAll('[data-test="expense-row"]')
    expect(rows).toHaveLength(3)
    const text = rows.map((r) => r.text()).join('|')
    expect(text).toContain('$450.50')
    expect(text).toContain('$12,000.00')
    expect(text).toContain('Compra de inventario')
    expect(text).toContain('Inventario')
    expect(text).toContain('Gasto operativo')
    expect(text).toContain('Pagó Olga')
    expect(text).toContain('Origen: Negocio')
    expect(text).toContain('Origen: Personal')
    expect(text).toContain('Sincronizado')
    expect(text).toContain('Pendiente')
    expect(text).not.toContain('x'.repeat(100)) // description is shortened
    expect(text).toContain('…')
  })

  it.each([
    ['pending', 'Pendiente', false],
    ['needs_review', 'Requiere revisión', true],
    ['paused', 'En pausa', true],
  ] as const)('shows the %s state and only offers retry when it is blocked', async (state, label, retry) => {
    mocks.store.pending = [pendingRecord(state)]
    const w = mountView()
    await flushPromises()
    expect(w.text()).toContain(label)
    const button = w.findAll('button').find((b) => b.text().startsWith('Reintentar con el origen'))
    expect(!!button).toBe(retry)
    if (button) {
      await button.trigger('click')
      expect(mocks.store.retry).toHaveBeenCalledWith(mocks.store.pending[0])
    }
  })

  it('shows a pending reversal beside its confirmed expense, never a duplicate row', async () => {
    mocks.store.history = [expense()]
    mocks.store.pending = [{
      kind: 'reverse', expenseId: 'e1',
      payload: { id: 'r1', createdByMemberId: 'ana', deviceId: 'device', occurredAt: `${monthDay}T12:00:00Z`, reason: 'Duplicado' },
      origin: { accountId: 'account', apiBase: '/api/v1', memberId: 'ana', deviceId: 'device' },
      id: 'r1', key: 'kr1', scope: 'scope', createdAt: monthDay, state: 'pending', attempts: 0, nextAttemptAt: 0,
    }]
    const w = mountView()
    await flushPromises()
    expect(w.findAll('[data-test="expense-row"]')).toHaveLength(1)
    expect(w.text()).toContain('Corrección pendiente: Duplicado')
    expect(w.findAll('button').some((b) => b.text() === 'Anular')).toBe(false)
  })

  it('shows annulled and corrected expenses with their reason', async () => {
    const reversal = (replacementExpenseId: string | null) => ({
      id: 'r', expenseId: 'e1', replacementExpenseId, reason: 'Importe incorrecto',
      occurredAt: `${monthDay}T12:00:00Z`, receivedAt: `${monthDay}T12:00:00Z`,
      createdByMemberId: 'ana', deviceId: 'device',
    })
    mocks.store.history = [expense({ id: 'e1', reversal: reversal(null) }), expense({ id: 'e2', reversal: { ...reversal('e3'), expenseId: 'e2' } })]
    const w = mountView()
    await flushPromises()
    expect(w.text()).toContain('Anulado')
    expect(w.text()).toContain('Corregido')
    expect(w.text()).toContain('Importe incorrecto')
  })

  it('refreshes with period and server-side filters and keeps them consistent with the summary', async () => {
    const w = mountView()
    await flushPromises()
    mocks.store.refresh.mockClear()
    mocks.store.refreshSummary.mockClear()
    await w.find('#expense-filter-nature').setValue('INVENTORY_PURCHASE')
    await w.find('#expense-filter-category').setValue('inventory')
    await w.find('#expense-filter-member').setValue('old')
    const dates = w.findAll('.report-range-picker input[type="date"]')
    await dates[0]!.setValue('2026-10-01')
    await dates[1]!.setValue(today)
    await w.find('.report-range-picker').trigger('submit')
    await flushPromises()
    expect(mocks.store.refresh).toHaveBeenLastCalledWith(
      expect.objectContaining({
        from: '2026-10-01T00:00:00-06:00',
        paidByMemberId: 'old',
        nature: 'INVENTORY_PURCHASE',
        category: 'inventory',
        limit: 50,
      }),
    )
    expect(mocks.store.refreshSummary).toHaveBeenCalledOnce()
  })

  it('filters the local list by nature, category and member without a request', async () => {
    mocks.store.history = [
      expense({ id: 'a', category: 'transport', paidByMemberId: 'ana' }),
      expense({ id: 'b', category: 'fuel', paidByMemberId: 'beto' }),
      expense({ id: 'c', nature: 'INVENTORY_PURCHASE', category: 'inventory', paidByMemberId: 'ana' }),
    ]
    const w = mountView()
    await flushPromises()
    const count = () => w.findAll('[data-test="expense-row"]').length
    expect(count()).toBe(3)
    await w.find('#expense-filter-nature').setValue('INVENTORY_PURCHASE')
    expect(count()).toBe(1)
    await w.find('#expense-filter-nature').setValue('')
    await w.find('#expense-filter-category').setValue('fuel')
    expect(count()).toBe(1)
    await w.find('#expense-filter-category').setValue('')
    await w.find('#expense-filter-member').setValue('ana')
    expect(count()).toBe(2)
  })

  it('does not query for an invalid period', async () => {
    const w = mountView()
    await flushPromises()
    mocks.store.refresh.mockClear()
    const dates = w.findAll('.report-range-picker input[type="date"]')
    await dates[0]!.setValue(today)
    await dates[1]!.setValue('2000-01-01')
    await w.find('.report-range-picker').trigger('submit')
    await flushPromises()
    expect(mocks.store.refresh).not.toHaveBeenCalled()
    expect(w.text()).toContain('posterior a la final')
  })

  it('shows the four summary figures from the server when they match the period, without profit or balance', async () => {
    const w = mountView()
    await flushPromises()
    const month = `${today.slice(0, 7)}-01`
    mocks.store.summary = {
      from: `${month}T00:00:00-06:00`,
      to: `${new Date(Date.parse(`${today}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)}T00:00:00-06:00`,
      value: { operatingMinor: 100000, inventoryMinor: 250000, personalMinor: 150000, businessMinor: 200000 },
    }
    const v = mountView()
    await flushPromises()
    const text = v.find('[data-test="summary"]').text()
    expect(text).toContain('Gastos operativos')
    expect(text).toContain('$1,000.00')
    expect(text).toContain('Compras de inventario')
    expect(text).toContain('$2,500.00')
    expect(text).toContain('Pagado con dinero personal')
    expect(text).toContain('Pagado con fondos del negocio')
    expect(v.text()).toContain('Totales del servidor')
    for (const forbidden of ['utilidad', 'saldo', 'reparto', 'recomend'])
      expect(v.text().toLowerCase()).not.toContain(forbidden + ' ')
    w.unmount()
  })

  it('falls back to local totals when consistent and excludes annulled expenses', async () => {
    mocks.store.history = [
      expense({ id: 'a', amountMinor: 1000 }),
      expense({ id: 'b', amountMinor: 5000, nature: 'INVENTORY_PURCHASE', category: 'inventory', fundsSource: 'BUSINESS' }),
      expense({ id: 'c', amountMinor: 700, reversal: { id: 'r', expenseId: 'c', replacementExpenseId: null, reason: 'x', occurredAt: `${monthDay}T12:00:00Z`, receivedAt: `${monthDay}T12:00:00Z`, createdByMemberId: 'ana', deviceId: 'device' } }),
    ]
    const w = mountView()
    await flushPromises()
    const text = w.find('[data-test="summary"]').text()
    expect(text).toContain('$10.00')
    expect(text).toContain('$50.00')
    expect(w.text()).toContain('guardados en este dispositivo')
  })

  it('hides local totals when a record needs review rather than showing numbers that may be wrong', async () => {
    mocks.store.pending = [pendingRecord('needs_review')]
    const w = mountView()
    await flushPromises()
    expect(w.find('[data-test="summary"]').exists()).toBe(false)
    expect(w.text()).toContain('No se muestran totales')
  })

  it('annuls an expense with a reason and no replacement', async () => {
    mocks.store.history = [expense()]
    const w = mountView()
    await flushPromises()
    await w.findAll('button').find((b) => b.text() === 'Anular')!.trigger('click')
    await w.find('#correction-reason').setValue('Registrado dos veces')
    await w.find('#correction-form').trigger('submit')
    await flushPromises()
    expect(mocks.store.reverse).toHaveBeenCalledWith('e1', 'Registrado dos veces', undefined)
    expect(mocks.store.history[0]?.amountMinor).toBe(45050)
    expect(w.text()).toContain('no se mueve dinero ni inventario')
  })

  it('corrects through one linked replacement operation', async () => {
    mocks.store.history = [expense()]
    const w = mountView()
    await flushPromises()
    await w.findAll('button').find((b) => b.text() === 'Corregir')!.trigger('click')
    await w.find('#correction-reason').setValue('Importe incorrecto')
    expect((w.find('#correction-amount').element as HTMLInputElement).value).toBe('450.50')
    await w.find('#correction-amount').setValue('600')
    await w.find('#correction-form').trigger('submit')
    await flushPromises()
    expect(mocks.store.reverse).toHaveBeenCalledWith(
      'e1',
      'Importe incorrecto',
      expect.objectContaining({ amountMinor: 60000, category: 'transport', paidByMemberId: 'ana', fundsSource: 'PERSONAL' }),
    )
  })

  it('requires a reason to annul and a selectable payer to correct', async () => {
    mocks.store.history = [expense({ paidByMemberId: 'old' })]
    const w = mountView()
    await flushPromises()
    await w.findAll('button').find((b) => b.text() === 'Corregir')!.trigger('click')
    await w.find('#correction-form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('motivo')
    await w.find('#correction-reason').setValue('Pagador equivocado')
    await w.find('#correction-form').trigger('submit')
    await flushPromises()
    expect(mocks.store.reverse).not.toHaveBeenCalled()
    expect(w.text()).toContain('quién pagó')
  })

  it('keeps the correction dialog open and reports a failed durable write', async () => {
    mocks.store.history = [expense()]
    mocks.store.reverse.mockRejectedValue(new Error('disk full'))
    const w = mountView()
    await flushPromises()
    await w.findAll('button').find((b) => b.text() === 'Anular')!.trigger('click')
    await w.find('#correction-reason').setValue('Duplicado')
    await w.find('#correction-form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('No se pudo guardar la corrección')
    expect(w.text()).not.toContain('Corrección guardada')
  })

  it('has responsive grids for mobile, tablet and desktop', () => {
    const source = viewSource
    expect(source).toMatch(/@media \(min-width: 640px\)/)
    expect(source).toMatch(/@media \(min-width: 1024px\)/)
    expect(source).toMatch(/min-width: 0/)
  })
})
