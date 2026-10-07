import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { reactive } from 'vue'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OverviewView from '../OverviewView.vue'
import { addDaysToKey, businessToday } from '@/utils/business-time'
import { FinanceOverviewContractError } from '@/utils/finance-overview'
import { overviewFixture } from '@/services/__tests__/finance-overview.fixture'
import type { FinanceOverview } from '@/types/finance-overview.types'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  summary: vi.fn(),
  session: { member: { role: 'socio' } as { role: string } },
  mode: { currentMode: 'gestion' } as { currentMode: string },
}))
vi.mock('@/services/finance-overview.service', () => ({
  FinanceOverviewService: { get: mocks.get },
}))
vi.mock('@/services/work-shifts.service', () => ({
  WorkShiftsService: { summary: mocks.summary },
}))
vi.mock('@/services/queue-origin', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/queue-origin')>()),
  currentQueueOrigin: () => ({ accountId: 'a', apiBase: '/api/v1', memberId: 'm', deviceId: 'd' }),
}))
vi.mock('@/stores/uiMode.store', () => ({ useUiModeStore: () => mocks.mode }))
vi.mock('@/stores/session.store', () => ({ useSessionStore: () => mocks.session }))

const today = businessToday()
const monthStart = `${today.slice(0, 8)}01`
const tomorrow = addDaysToKey(today, 1)

const partnerSummary = {
  totals: { shiftCount: 4, knownMinutes: 600, unknownDurationCount: 1 },
  members: [
    { memberId: 'adid', member: { id: 'adid', name: 'Adid', role: 'socio', active: true }, shiftCount: 3, knownMinutes: 450, unknownDurationCount: 1 },
    { memberId: 'alberto', member: { id: 'alberto', name: 'Alberto', role: 'socio', active: true }, shiftCount: 1, knownMinutes: 150, unknownDurationCount: 0 },
  ],
}
const partial = (): FinanceOverview =>
  overviewFixture({
    costCoverage: {
      status: 'partial',
      totalLineCount: 25,
      knownCostLineCount: 23,
      missingCostLineCount: 2,
      missingCostUnitCount: 3,
      salesWithoutCostMinor: 12000,
      knownCostLinePercentage: 92,
    },
    result: {
      recordedOperatingResultMinor: 25000,
      potentiallyAvailableMinor: 25000,
      status: 'partial',
      isCashBalance: false,
      isWithdrawableProfit: false,
    },
    warnings: [
      { code: 'MISSING_SALE_COST', message: 'Some sold lines have no recorded cost' },
      { code: 'SYNC_TIME_COST_NO_LOT_VALUATION', message: 'snapshot' },
      { code: 'NOT_CASH_OR_WITHDRAWABLE_PROFIT', message: 'not cash' },
      { code: 'RESERVES_PENDING', message: 'pending' },
    ],
  })

beforeEach(() => {
  setActivePinia(createPinia())
  mocks.get.mockReset()
  mocks.summary.mockReset()
  mocks.session.member = { role: 'socio' }
  mocks.mode.currentMode = 'gestion'
  mocks.get.mockResolvedValue(overviewFixture())
  mocks.summary.mockResolvedValue(partnerSummary)
})

const mountView = () => mount(OverviewView, { global: { stubs: { RouterLink: RouterLinkStub } } })
async function mounted() {
  const w = mountView()
  await flushPromises()
  return w
}
const section = (w: Awaited<ReturnType<typeof mounted>>, name: string) => w.find(`[data-test="${name}"]`).text()

describe('overview screen: access, tabs and request', () => {
  it('lists Resumen as the first, active tab and has a single h1', async () => {
    const w = await mounted()
    const tabs = w.findAllComponents(RouterLinkStub).slice(0, 5) // the tab nav; the reserves link comes later
    expect(tabs.map((t) => t.text())).toEqual(['Resumen', 'Aportaciones', 'Gastos', 'Jornadas', 'Reservas'])
    expect(tabs[0]!.attributes('aria-current')).toBe('page')
    expect(w.findAll('h1')).toHaveLength(1)
    expect(w.find('h1').text()).toBe('Resumen')
  })

  it('loads the month so far with an exclusive end and asks the partner summary for the same period', async () => {
    await mounted()
    expect(mocks.get).toHaveBeenCalledTimes(1)
    expect(mocks.get).toHaveBeenCalledWith(monthStart, tomorrow)
    expect(mocks.summary).toHaveBeenCalledTimes(1)
    expect(mocks.summary.mock.calls[0]![1]).toEqual({ from: monthStart, to: tomorrow })
  })

  it('requests the overview exactly once when access becomes allowed after mount', async () => {
    mocks.session = reactive({ member: { role: 'colaborador' } })
    mocks.mode = reactive({ currentMode: 'gestion' })
    const w = await mounted()
    expect(w.text()).toContain('Solo socios')
    expect(mocks.get).not.toHaveBeenCalled()
    mocks.session.member = { role: 'socio' }
    await flushPromises()
    expect(mocks.get).toHaveBeenCalledTimes(1)
    expect(mocks.get).toHaveBeenCalledWith(monthStart, tomorrow)
    expect(w.find('[data-test="operating"]').exists()).toBe(true)
  })

  it('does not request when access returns but the range is invalid', async () => {
    mocks.session = reactive({ member: { role: 'socio' } })
    const w = await mounted()
    mocks.get.mockClear()
    const inputs = w.findAll('input[type="date"]')
    await inputs[0]!.setValue(today)
    await inputs[1]!.setValue(addDaysToKey(today, -3))
    mocks.session.member = { role: 'colaborador' }
    await flushPromises()
    mocks.session.member = { role: 'socio' }
    await flushPromises()
    expect(mocks.get).not.toHaveBeenCalled()
  })

  it('does not render nor load for a collaborator or in sales mode', async () => {
    mocks.session.member = { role: 'colaborador' }
    let w = await mounted()
    expect(w.text()).toContain('Solo socios')
    mocks.session.member = { role: 'socio' }
    mocks.mode.currentMode = 'venta'
    w = await mounted()
    expect(w.text()).toContain('Solo socios')
    expect(mocks.get).not.toHaveBeenCalled()
  })
})

describe('overview screen: hierarchy and figures', () => {
  it('shows the sections in the intended order with an h2 each', async () => {
    const w = await mounted()
    const text = w.text()
    const order = [
      'Ventas',
      'Costo vendido registrado',
      'Margen bruto registrado',
      'Gastos operativos',
      'Resultado operativo registrado',
      'Compras de inventario',
      'Capital aportado registrado',
      'Trabajo registrado',
      'Reservas',
      'Monto potencialmente disponible',
    ]
    let last = -1
    for (const label of order) {
      const at = text.indexOf(label, last + 1)
      expect(at, label).toBeGreaterThan(last)
      last = at
    }
    expect(w.findAll('h2').map((h) => h.text())).toEqual([
      'Resultado operativo registrado',
      'Compras de inventario',
      'Capital aportado registrado',
      'Trabajo registrado',
      'Reservas',
      'Monto potencialmente disponible',
    ])
  })

  it('keeps inventory purchases apart from operating expenses and the result', async () => {
    const w = await mounted()
    const operating = section(w, 'operating')
    expect(operating).toContain('$150.00') // operating expenses
    expect(operating).toContain('$250.00') // result = 1000 - 600 - 150
    expect(operating).not.toContain('$300.00') // inventory purchases
    const inventory = section(w, 'inventory')
    expect(inventory).toContain('$300.00')
    expect(inventory).toContain('no se suman a los gastos operativos')
  })

  it('never adds capital contributions to income or the result', async () => {
    const w = await mounted()
    expect(section(w, 'operating')).not.toContain('$500.00')
    const capital = section(w, 'contributions')
    expect(capital).toContain('$500.00')
    expect(capital).toContain('2 aportaciones')
    expect(capital).toContain('No es ingreso ni se suma al resultado operativo')
  })

  it('marks the result prominent and reads a negative amount with words', async () => {
    const o = overviewFixture()
    o.result.recordedOperatingResultMinor = -5000
    o.result.potentiallyAvailableMinor = -5000
    mocks.get.mockResolvedValue(o)
    const w = await mounted()
    const prominent = w.find('.overview-figure--prominent')
    expect(prominent.text()).toContain('-$50.00')
    expect(prominent.text()).toContain('menos $50.00')
    expect(prominent.classes()).toContain('overview-figure--negative')
  })

  it('shows per-partner jornadas with hours and no money', async () => {
    const w = await mounted()
    const work = section(w, 'work')
    expect(work).toContain('4 jornadas')
    expect(w.findAll('[data-test="partner"]').map((p) => p.find('h3').text())).toEqual(['Adid', 'Alberto'])
    expect(work).toContain('3 jornadas · 7 h 30 min registradas · 1 sin duración')
    expect(work).not.toMatch(/\$|%/)
  })

  it('degrades to the overview work totals when the partner summary is unavailable', async () => {
    mocks.summary.mockRejectedValue(new Error('offline'))
    const w = await mounted()
    expect(w.find('[data-test="partners-unavailable"]').exists()).toBe(true)
    expect(section(w, 'work')).toContain('4 jornadas')
    expect(w.find('[data-test="operating"]').exists()).toBe(true)
  })

  it('shows real reserves for the exact period, links to manage them and keeps the prudent disclaimer', async () => {
    mocks.get.mockResolvedValue(
      overviewFixture({
        reserves: { activeCount: 2, plannedMinor: 150000, matching: 'EXACT_PERIOD' },
        result: {
          recordedOperatingResultMinor: 25000,
          potentiallyAvailableMinor: -125000,
          status: 'complete',
          isCashBalance: false,
          isWithdrawableProfit: false,
        },
      }),
    )
    const w = await mounted()
    const text = section(w, 'reserves')
    expect(text).toContain('Reservas planeadas para este periodo')
    expect(text).toContain('$1,500.00')
    expect(text).toContain('2 reservas activas')
    expect(text).toContain('exactamente este período')
    expect(text).toContain('una reserva de otro período no cambia esta cifra')
    const explain = w.find('[data-test="reserves-explain"]').text()
    expect(explain).toMatch(/\(\d{2}\/\d{2}\/\d{4} al \d{2}\/\d{2}\/\d{4}\): una reserva de otro período/)
    expect(explain).not.toMatch(/\s:/)
    expect(text).not.toMatch(/próximamente|aún no se pueden configurar/i)
    expect(w.find('[data-test="reserves-none"]').exists()).toBe(false)
    const link = w.findAllComponents(RouterLinkStub).find((l) => l.text() === 'Administrar reservas')!
    expect(link.props('to')).toEqual({ path: '/app/finanzas/reservas', query: { from: monthStart, to: today } })
    expect(section(w, 'available')).toContain('-$1,250.00')
    expect(w.find('[data-test="available-disclaimer"]').text()).toBe(
      'Este cálculo considera el resultado operativo registrado y las reservas configuradas. No representa necesariamente efectivo disponible ni una recomendación de retiro.',
    )
  })

  it('says there are no reserves yet (without a coming-soon note) and still offers the link', async () => {
    const w = await mounted()
    expect(w.find('[data-test="reserves-none"]').text()).toBe('Todavía no hay reservas activas para este período.')
    expect(section(w, 'reserves')).not.toMatch(/próximamente/i)
    expect(w.findAllComponents(RouterLinkStub).some((l) => l.text() === 'Administrar reservas')).toBe(true)
  })

  it('shows the full overview, not the empty state, when the period only has reserves', async () => {
    mocks.get.mockResolvedValue(
      overviewFixture({
        sales: { saleCount: 0, salesMinor: 0, recordedCostMinor: 0, recordedGrossMarginMinor: 0 },
        expenses: { operatingMinor: 0, inventoryPurchasesMinor: 0 },
        contributions: { amountMinor: 0, count: 0 },
        workShifts: { shiftCount: 0, knownMinutes: 0, unknownDurationCount: 0 },
        reserves: { activeCount: 1, plannedMinor: 5000, matching: 'EXACT_PERIOD' },
      }),
    )
    const w = await mounted()
    expect(w.find('[data-test="empty"]').exists()).toBe(false)
    expect(w.find('[data-test="reserves"]').exists()).toBe(true)
  })

  it('never uses distribution wording', async () => {
    const w = await mounted()
    expect(w.text()).not.toMatch(/ganancia para repartir|reparto|repartir|comisi|sueldo|salario/i)
  })

  it('uses stacked cards and grid hooks, never a table', async () => {
    const w = await mounted()
    expect(w.find('table').exists()).toBe(false)
    expect(w.find('.overview-grid').exists()).toBe(true)
    expect(w.find('.overview-flow').exists()).toBe(true)
    expect(w.findAll('[data-test="figure"]').length).toBeGreaterThanOrEqual(8)
  })
})

describe('overview screen: cost coverage', () => {
  it('shows complete coverage without alarm or partial labels', async () => {
    const w = await mounted()
    expect(w.find('[data-test="coverage-partial"]').exists()).toBe(false)
    expect(w.find('[data-test="coverage-complete"]').text()).toBe('Cobertura de costos: 100%')
    expect(w.text()).not.toContain('(parcial)')
    expect(w.text()).not.toContain('Hay ventas sin costo registrado')
  })

  it('explains partial coverage calmly and labels dependent figures as partial', async () => {
    mocks.get.mockResolvedValue(partial())
    const w = await mounted()
    const notice = w.find('[data-test="coverage-partial"]')
    expect(notice.text()).toContain('Hay ventas sin costo registrado.')
    expect(notice.text()).toContain('Cobertura de costos: 92%')
    expect(notice.text()).toContain('8% de las líneas no tienen costo conocido.')
    expect(notice.text()).toContain('$120.00')
    expect(w.find('[data-test="status"]').attributes('aria-live')).toBe('polite')
    // cost, margin, result and potentially available are labelled, sales and expenses are not
    expect(w.findAll('[data-test="partial-label"]')).toHaveLength(4)
    expect(section(w, 'available')).toContain('(parcial)')
  })

  it('does not repeat backend warnings the screen already explains', async () => {
    mocks.get.mockResolvedValue(partial())
    const w = await mounted()
    const warnings = section(w, 'warnings')
    expect(warnings).toContain('valuación por lote')
    expect(warnings).not.toContain('Some sold lines')
    expect(warnings).not.toContain('not cash')
    expect(warnings).not.toContain('pending')
  })

  it('says there are no sale lines when coverage is null', async () => {
    const o = overviewFixture()
    o.costCoverage = { ...o.costCoverage, totalLineCount: 0, knownCostLineCount: 0, knownCostLinePercentage: null }
    mocks.get.mockResolvedValue(o)
    const w = await mounted()
    expect(w.find('[data-test="coverage-complete"]').text()).toBe('Cobertura de costos: Sin líneas de venta')
  })
})

describe('overview screen: freshness and states', () => {
  it('shows the generation time in business time and that local pending records are excluded', async () => {
    const w = await mounted()
    expect(w.find('[data-test="freshness"]').text()).toContain('Última actualización: 07/10/2026 12:00')
    expect(w.find('[data-test="pending-note"]').text()).toContain('pendientes de sincronizar')
    expect(w.find('[data-test="pending-note"]').text()).toContain('no están incluidos')
  })

  it('shows a skeleton while the first load is pending', async () => {
    mocks.get.mockReturnValue(new Promise(() => undefined))
    const w = mountView()
    await flushPromises()
    expect(w.find('[data-test="skeleton"]').exists()).toBe(true)
    expect(w.find('[data-test="operating"]').exists()).toBe(false)
  })

  it('shows an empty state when nothing was recorded in the period', async () => {
    mocks.get.mockResolvedValue(
      overviewFixture({
        sales: { saleCount: 0, salesMinor: 0, recordedCostMinor: 0, recordedGrossMarginMinor: 0 },
        expenses: { operatingMinor: 0, inventoryPurchasesMinor: 0 },
        contributions: { amountMinor: 0, count: 0 },
        workShifts: { shiftCount: 0, knownMinutes: 0, unknownDurationCount: 0 },
        result: {
          recordedOperatingResultMinor: 0,
          potentiallyAvailableMinor: 0,
          status: 'complete',
          isCashBalance: false,
          isWithdrawableProfit: false,
        },
      }),
    )
    const w = await mounted()
    expect(w.find('[data-test="empty"]').text()).toContain('No hay ventas ni movimientos registrados')
    expect(w.find('[data-test="operating"]').exists()).toBe(false)
  })

  it('shows an error with retry when there is no previous data, and retry loads it', async () => {
    mocks.get.mockRejectedValueOnce({ response: { status: 422, data: { code: 'FINANCE_OVERVIEW_OVERFLOW' } } })
    const w = await mounted()
    expect(w.text()).toContain('No se pudo actualizar el resumen')
    expect(w.text()).toContain('periodo más corto')
    expect(w.find('[data-test="operating"]').exists()).toBe(false)
    await w.find('[data-test="retry"]').trigger('click')
    await flushPromises()
    expect(mocks.get).toHaveBeenCalledTimes(2)
    expect(w.find('[data-test="operating"]').exists()).toBe(true)
    expect(w.text()).not.toContain('No se pudo actualizar el resumen')
  })

  it('keeps the last confirmed data labelled as such when a refresh fails, never as updated', async () => {
    const w = await mounted()
    mocks.get.mockRejectedValueOnce(new Error('Network Error'))
    const refreshButton = w.findAll('button').find((b) => b.text() === 'Este mes')!
    await refreshButton.trigger('click')
    await flushPromises()
    const freshness = w.find('[data-test="freshness"]').text()
    expect(freshness).toContain('Último resumen confirmado: 07/10/2026 12:00')
    expect(freshness).not.toContain('Última actualización')
    expect(w.text()).toContain('No pudimos conectarnos')
    expect(w.text()).toContain('no es una actualización nueva')
    expect(w.find('[data-test="operating"]').exists()).toBe(true)
  })
})

describe('overview screen: retry labelling and contract errors', () => {
  it('keeps the last-confirmed label while a retry is pending and flips it after success', async () => {
    const w = await mounted()
    mocks.get.mockRejectedValueOnce(new Error('Network Error'))
    await w.findAll('button').find((b) => b.text() === 'Este mes')!.trigger('click')
    await flushPromises()
    let release!: (o: FinanceOverview) => void
    mocks.get.mockReturnValueOnce(new Promise<FinanceOverview>((r) => (release = r)))
    await w.find('[data-test="retry"]').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Actualizando el resumen')
    const pending = w.find('[data-test="freshness"]').text()
    expect(pending).toContain('Último resumen confirmado')
    expect(pending).not.toContain('Última actualización')
    release(overviewFixture())
    await flushPromises()
    const done = w.find('[data-test="freshness"]').text()
    expect(done).toContain('Última actualización')
    expect(done).not.toContain('Último resumen confirmado')
  })

  it('explains an invalid payload without a network message and without a retry button', async () => {
    mocks.get.mockRejectedValueOnce(new FinanceOverviewContractError())
    const w = await mounted()
    expect(w.text()).toContain('formato inesperado')
    expect(w.text()).not.toContain('No pudimos conectarnos')
    expect(w.find('[data-test="retry"]').exists()).toBe(false)
    expect(w.find('[data-test="operating"]').exists()).toBe(false)
  })
})

describe('overview figure layout', () => {
  it('packs rows at the top so an amount never drifts down in a card that has no note line', () => {
    // jsdom has no layout engine: assert the stylesheet rule that stops grid rows from stretching.
    const source = readFileSync(resolve(process.cwd(), 'src/views/finance/components/OverviewFigure.vue'), 'utf8')
    const rule = source.match(/\.overview-figure\s*\{([^}]*)\}/)
    expect(rule).not.toBeNull()
    expect(rule![1]).toMatch(/align-content:\s*start/)
  })
})

describe('overview screen: period changes', () => {
  it('requests the new period once, with the exclusive end, for the overview and the partners', async () => {
    const w = await mounted()
    mocks.get.mockClear()
    mocks.summary.mockClear()
    await w.findAll('button').find((b) => b.text() === 'Hoy')!.trigger('click')
    await flushPromises()
    expect(mocks.get).toHaveBeenCalledTimes(1)
    expect(mocks.get).toHaveBeenCalledWith(today, tomorrow)
    expect(mocks.summary).toHaveBeenCalledTimes(1)
    expect(mocks.summary.mock.calls[0]![1]).toEqual({ from: today, to: tomorrow })
  })

  it('accepts a future month end and requests it with the exclusive end across a year boundary', async () => {
    const w = await mounted()
    mocks.get.mockClear()
    mocks.summary.mockClear()
    const inputs = w.findAll('input[type="date"]')
    for (const input of inputs) expect(input.attributes('max')).toBeUndefined()
    await inputs[0]!.setValue('2099-12-01')
    await inputs[1]!.setValue('2099-12-31')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.find('.report-range-picker__error').exists()).toBe(false)
    expect(mocks.get).toHaveBeenCalledTimes(1)
    expect(mocks.get).toHaveBeenCalledWith('2099-12-01', '2100-01-01')
    expect(mocks.summary.mock.calls[0]![1]).toEqual({ from: '2099-12-01', to: '2100-01-01' })
  })

  it('does not query an invalid range', async () => {
    const w = await mounted()
    mocks.get.mockClear()
    const inputs = w.findAll('input[type="date"]')
    await inputs[0]!.setValue(today)
    await inputs[1]!.setValue(addDaysToKey(today, -3))
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.get).not.toHaveBeenCalled()
    expect(w.text()).toContain('La fecha inicial es posterior a la final')
  })

  it('ignores a slow response for the previous period', async () => {
    let releaseSlow!: (o: FinanceOverview) => void
    mocks.get.mockReset()
    mocks.get.mockReturnValueOnce(new Promise<FinanceOverview>((r) => (releaseSlow = r)))
    const w = mountView()
    await flushPromises()
    mocks.get.mockResolvedValueOnce(
      overviewFixture({ expenses: { operatingMinor: 77700, inventoryPurchasesMinor: 0 } }),
    )
    // The picker is disabled while loading; the store still guards a newer request.
    const { useFinanceOverviewStore } = await import('@/stores/finance-overview.store')
    await useFinanceOverviewStore().load({ from: today, to: today })
    await flushPromises()
    releaseSlow(overviewFixture({ expenses: { operatingMinor: 11100, inventoryPurchasesMinor: 0 } }))
    await flushPromises()
    expect(section(w, 'operating')).toContain('$777.00')
    expect(section(w, 'operating')).not.toContain('$111.00')
  })
})
