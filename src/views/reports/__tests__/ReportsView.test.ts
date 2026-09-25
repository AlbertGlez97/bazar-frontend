// Vista de reportes (contenedor): stores REALES (sesión, modo, toast) y componentes
// reales; solo se simulan la red (ReportsService, colector de ventas) y los
// exportadores (que cargan pdfmake / exceljs).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import ReportsView from '../ReportsView.vue'
import ReportsService from '@/services/reports.service'
import { collectSalesInRange } from '@/services/sales-report-collector'
import { downloadPdf } from '@/services/pdf-report'
import { downloadExcel } from '@/services/excel-report'
import { useSessionStore } from '@/stores/session.store'
import { useToastStore } from '@/stores/toast.store'
import { useUiModeStore } from '@/stores/uiMode.store'
import type { SalesByMemberReport, SalesByPeriodReport, SalesReport } from '@/types/report.types'
import type { Sale } from '@/types/sale.types'

vi.mock('@/services/reports.service', () => ({
  default: { getSalesByPeriod: vi.fn(), getSalesByMember: vi.fn() },
}))
vi.mock('@/services/sales-report-collector', () => ({ collectSalesInRange: vi.fn() }))
vi.mock('@/services/pdf-report', () => ({ downloadPdf: vi.fn() }))
vi.mock('@/services/excel-report', () => ({ downloadExcel: vi.fn() }))

const getSalesByPeriod = vi.mocked(ReportsService.getSalesByPeriod)
const getSalesByMember = vi.mocked(ReportsService.getSalesByMember)
const collect = vi.mocked(collectSalesInRange)
const pdf = vi.mocked(downloadPdf)
const excel = vi.mocked(downloadExcel)

const FROM_UTC = '2026-09-24T06:00:00.000Z'
const TO_UTC = '2026-09-25T05:59:59.999Z'

const period = (over: Partial<SalesByPeriodReport> = {}): SalesByPeriodReport => ({
  from: FROM_UTC, to: TO_UTC, totalSoldMinor: 130050, saleCount: 2, ...over,
})
const byMember = (over: Partial<SalesByMemberReport> = {}): SalesByMemberReport => ({
  from: FROM_UTC, to: TO_UTC,
  items: [
    { memberId: 'm-carlos', memberName: 'Carlos Núñez', role: 'colaborador', totalSoldMinor: 125000 },
    { memberId: 'm-ana', memberName: 'Ana', role: 'socio', totalSoldMinor: 5050 },
  ],
  ...over,
})

function sale(id: string, memberId: string, receivedAt: string, totalMinor: number): Sale {
  return {
    id, memberId, deviceId: 'd-1', occurredAt: receivedAt, receivedAt, currency: 'MXN', status: 'completada',
    totalMinor, cashReceivedMinor: totalMinor, changeMinor: 0, conflictReason: null, conflictDetectedAt: null,
    items: [{ id: `${id}-i`, productId: 'p', quantity: 1, unitPriceMinor: totalMinor, subtotalMinor: totalMinor, createdAt: receivedAt }],
  }
}
const DETAIL = [
  sale('s-2', 'm-carlos', '2026-09-24T20:05:00.000Z', 125000),
  sale('s-1', 'm-ana', '2026-09-24T18:00:00.000Z', 5050),
]

const SOCIO = { id: 'm-1', name: 'Ana', role: 'socio' as const, active: true }

async function mountView(options: { role?: 'socio' | 'colaborador'; mode?: 'gestion' | 'venta' } = {}) {
  const session = useSessionStore()
  session.setMember({ ...SOCIO, role: options.role ?? 'socio' })
  useUiModeStore().setMode(options.mode ?? 'gestion')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/app', name: 'AppHome', component: { template: '<div>home</div>' } },
      { path: '/app/reportes', name: 'Reports', component: ReportsView },
    ],
  })
  router.push('/app/reportes')
  await router.isReady()
  const wrapper = mount(ReportsView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

type Wrapper = Awaited<ReturnType<typeof mountView>>['wrapper']
const presetButton = (wrapper: Wrapper, label: string) =>
  wrapper.findAll('.report-range-picker__preset').find((b) => b.text() === label)!
const button = (wrapper: Wrapper, label: string) => wrapper.findAll('button').find((b) => b.text().includes(label))!

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActivePinia(createPinia())
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-24T18:00:00.000Z')) // jueves 12:00 en el negocio
  getSalesByPeriod.mockReset().mockResolvedValue(period())
  getSalesByMember.mockReset().mockResolvedValue(byMember())
  collect.mockReset().mockResolvedValue({ sales: DETAIL, truncated: false, pagesFetched: 1 })
  pdf.mockReset().mockResolvedValue(undefined)
  excel.mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ReportsView — carga y presentación', () => {
  it('loads "Hoy" on open using business-time dates', async () => {
    await mountView()
    expect(getSalesByPeriod).toHaveBeenCalledTimes(1)
    expect(getSalesByPeriod).toHaveBeenCalledWith({ from: '2026-09-24', to: '2026-09-24' })
    expect(getSalesByMember).toHaveBeenCalledWith({ from: '2026-09-24', to: '2026-09-24' })
  })

  it('"Hoy" follows the business day, not the device clock (02:00Z is still the 24th)', async () => {
    vi.setSystemTime(new Date('2026-09-25T02:00:00.000Z'))
    await mountView()
    expect(getSalesByPeriod).toHaveBeenCalledWith({ from: '2026-09-24', to: '2026-09-24' })
  })

  it('shows the total, sale count, range and the per-person table', async () => {
    const { wrapper } = await mountView()
    expect(wrapper.get('h1').text()).toBe('Reportes de ventas')
    expect(wrapper.get('.sales-report-summary__total').text()).toBe('$1,300.50')
    expect(wrapper.text()).toContain('2 ventas')
    expect(wrapper.text()).toContain('24/09/2026')
    const rows = wrapper.findAll('tbody tr').map((tr) => tr.findAll('td').map((td) => td.text()))
    expect(rows).toEqual([
      ['Carlos Núñez', 'Colaborador', '$1,250.00', '96.1 %'],
      ['Ana', 'Socio', '$50.50', '3.9 %'],
    ])
  })

  it('labels a multi-day range with both dates', async () => {
    getSalesByPeriod.mockResolvedValue(period({ from: '2026-09-20T06:00:00.000Z', to: '2026-09-25T05:59:59.999Z' }))
    const { wrapper } = await mountView()
    await presetButton(wrapper, 'Esta semana').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('20/09/2026 al 24/09/2026')
  })

  it('shows a skeleton while loading and removes it when the data arrives', async () => {
    let resolve!: (value: SalesByPeriodReport) => void
    getSalesByPeriod.mockReturnValue(new Promise((r) => { resolve = r }))
    const { wrapper } = await mountView()
    expect(wrapper.find('.reports-view__skeleton').exists()).toBe(true)
    expect(wrapper.find('.sales-report-summary').exists()).toBe(false)
    resolve(period())
    await flushPromises()
    expect(wrapper.find('.reports-view__skeleton').exists()).toBe(false)
    expect(wrapper.find('.sales-report-summary').exists()).toBe(true)
  })

  it('an older response never overwrites a newer one', async () => {
    let resolveFirst!: (value: SalesByPeriodReport) => void
    getSalesByPeriod.mockReturnValueOnce(new Promise((r) => { resolveFirst = r }))
    const { wrapper } = await mountView()
    getSalesByPeriod.mockResolvedValueOnce(period({ totalSoldMinor: 777, saleCount: 1 }))
    await presetButton(wrapper, 'Ayer').trigger('click')
    await flushPromises()
    resolveFirst(period({ totalSoldMinor: 999999, saleCount: 9 }))
    await flushPromises()
    expect(wrapper.get('.sales-report-summary__total').text()).toBe('$7.77')
  })
})

describe('ReportsView — rangos', () => {
  it.each([
    ['Ayer', { from: '2026-09-23', to: '2026-09-23' }],
    ['Esta semana', { from: '2026-09-20', to: '2026-09-24' }],
    ['Este mes', { from: '2026-09-01', to: '2026-09-24' }],
    ['Hoy', { from: '2026-09-24', to: '2026-09-24' }],
  ])('preset "%s" queries %j right away', async (label, expected) => {
    const { wrapper } = await mountView()
    getSalesByPeriod.mockClear()
    getSalesByMember.mockClear()
    await presetButton(wrapper, label).trigger('click')
    await flushPromises()
    expect(getSalesByPeriod).toHaveBeenCalledWith(expected)
    expect(getSalesByMember).toHaveBeenCalledWith(expected)
    expect(presetButton(wrapper, label).attributes('aria-pressed')).toBe('true')
    const [from, to] = wrapper.findAll('input[type="date"]')
    expect((from.element as HTMLInputElement).value).toBe(expected.from)
    expect((to.element as HTMLInputElement).value).toBe(expected.to)
  })

  it('custom dates are queried only when Actualizar is pressed, and unselect the preset', async () => {
    const { wrapper } = await mountView()
    getSalesByPeriod.mockClear()
    const [from, to] = wrapper.findAll('input[type="date"]')
    await from.setValue('2026-09-10')
    await to.setValue('2026-09-15')
    expect(getSalesByPeriod).not.toHaveBeenCalled()
    expect(wrapper.findAll('.report-range-picker__preset').every((b) => b.attributes('aria-pressed') === 'false')).toBe(true)
    await wrapper.get('.report-range-picker__apply').trigger('click')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(getSalesByPeriod).toHaveBeenCalledWith({ from: '2026-09-10', to: '2026-09-15' })
  })

  it('refuses an inverted range: says why, disables Actualizar and never calls the service', async () => {
    const { wrapper } = await mountView()
    getSalesByPeriod.mockClear()
    const [from, to] = wrapper.findAll('input[type="date"]')
    await from.setValue('2026-09-20')
    await to.setValue('2026-09-10')
    expect(wrapper.get('.report-range-picker__error').text()).toBe('La fecha inicial es posterior a la final. Cámbialas para ver el reporte.')
    expect(wrapper.get('.report-range-picker__apply').attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(getSalesByPeriod).not.toHaveBeenCalled()
  })

  it('refuses a future end date and an empty date', async () => {
    const { wrapper } = await mountView()
    getSalesByPeriod.mockClear()
    const [from, to] = wrapper.findAll('input[type="date"]')
    await to.setValue('2026-09-25')
    expect(wrapper.get('.report-range-picker__error').text()).toContain('hoy')
    await from.setValue('')
    expect(wrapper.get('.report-range-picker__error').text()).toContain('dos fechas')
    await wrapper.get('form').trigger('submit')
    expect(getSalesByPeriod).not.toHaveBeenCalled()
  })

  it('limits the date inputs to today in business time', async () => {
    const { wrapper } = await mountView()
    expect(wrapper.findAll('input[type="date"]').map((i) => i.attributes('max'))).toEqual(['2026-09-24', '2026-09-24'])
  })
})

describe('ReportsView — vacío y errores', () => {
  it('empty period: says so and disables both downloads', async () => {
    getSalesByPeriod.mockResolvedValue(period({ totalSoldMinor: 0, saleCount: 0 }))
    getSalesByMember.mockResolvedValue(byMember({ items: [] }))
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('Todavía no hay ventas en este periodo.')
    expect(button(wrapper, 'Descargar PDF').attributes('disabled')).toBeDefined()
    expect(button(wrapper, 'Descargar Excel').attributes('disabled')).toBeDefined()
  })

  it('network failure: friendly alert with retry, no raw error', async () => {
    getSalesByPeriod.mockRejectedValueOnce({ isAxiosError: true, request: {} })
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('No pudimos conectarnos. Revisa tu internet e intenta de nuevo.')
    expect(wrapper.find('.sales-report-summary').exists()).toBe(false)
    expect(button(wrapper, 'Descargar PDF').attributes('disabled')).toBeDefined()

    await button(wrapper, 'Intentar de nuevo').trigger('click')
    await flushPromises()
    expect(wrapper.find('.sales-report-summary').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('No pudimos conectarnos')
  })

  it('a 403 says the report is for socios only', async () => {
    getSalesByMember.mockRejectedValueOnce({ isAxiosError: true, response: { status: 403, data: { message: 'Only socios may access this resource' } } })
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('Este reporte es solo para socios.')
    expect(wrapper.text()).not.toContain('Only socios')
  })

  it('a server failure shows the generic message', async () => {
    getSalesByPeriod.mockRejectedValueOnce({ isAxiosError: true, response: { status: 500 } })
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('No pudimos cargar el reporte. Intenta de nuevo en un momento.')
  })
})

describe('ReportsView — descargas', () => {
  it('PDF: collects the detail for the normalized range, builds the report and downloads it with the range file name', async () => {
    const { wrapper } = await mountView()
    await button(wrapper, 'Descargar PDF').trigger('click')
    await flushPromises()

    expect(collect).toHaveBeenCalledTimes(1)
    expect(collect).toHaveBeenCalledWith({ from: FROM_UTC, to: TO_UTC })
    expect(pdf).toHaveBeenCalledTimes(1)
    const [report, filename] = pdf.mock.calls[0] as [SalesReport, string]
    expect(filename).toBe('ventas-la-marchanta-2026-09-24.pdf')
    expect(report.businessName).toBe('La Marchanta')
    expect(report.rows.map((r) => r.id)).toEqual(['s-1', 's-2']) // cronológico
    expect(report.totals.totalMinor).toBe(130050)
    expect(report.consistency.ok).toBe(true)
    expect(report.range).toMatchObject({ fromDay: '2026-09-24', toDay: '2026-09-24' })
    expect(excel).not.toHaveBeenCalled()
  })

  it('Excel: uses the range file name for a multi-day range', async () => {
    getSalesByPeriod.mockResolvedValue(period({ from: '2026-09-20T06:00:00.000Z', to: '2026-09-25T05:59:59.999Z' }))
    const { wrapper } = await mountView()
    await presetButton(wrapper, 'Esta semana').trigger('click')
    await flushPromises()
    await button(wrapper, 'Descargar Excel').trigger('click')
    await flushPromises()
    expect(excel.mock.calls[0][1]).toBe('ventas-la-marchanta-2026-09-20_a_2026-09-24.xlsx')
  })

  it('reuses the collected detail for the second file of the same range', async () => {
    const { wrapper } = await mountView()
    await button(wrapper, 'Descargar PDF').trigger('click')
    await flushPromises()
    await button(wrapper, 'Descargar Excel').trigger('click')
    await flushPromises()
    expect(collect).toHaveBeenCalledTimes(1)
    expect(excel.mock.calls[0][0]).toBe(pdf.mock.calls[0][0])
  })

  it('collects again after the range changes', async () => {
    const { wrapper } = await mountView()
    await button(wrapper, 'Descargar PDF').trigger('click')
    await flushPromises()
    await presetButton(wrapper, 'Ayer').trigger('click')
    await flushPromises()
    await button(wrapper, 'Descargar PDF').trigger('click')
    await flushPromises()
    expect(collect).toHaveBeenCalledTimes(2)
  })

  it('does not fetch the detail just to view the totals', async () => {
    await mountView()
    expect(collect).not.toHaveBeenCalled()
  })

  it('while preparing: says "Preparando tu archivo…", disables downloads and the range controls', async () => {
    let finish!: () => void
    pdf.mockReturnValue(new Promise<void>((r) => { finish = r }))
    const { wrapper } = await mountView()
    await button(wrapper, 'Descargar PDF').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Preparando tu archivo…')
    expect(button(wrapper, 'Descargar PDF').attributes('disabled')).toBeDefined()
    expect(button(wrapper, 'Descargar Excel').attributes('disabled')).toBeDefined()
    expect(presetButton(wrapper, 'Ayer').attributes('disabled')).toBeDefined()
    finish()
    await flushPromises()
    expect(wrapper.text()).not.toContain('Preparando tu archivo…')
    expect(button(wrapper, 'Descargar PDF').attributes('disabled')).toBeUndefined()
  })

  it('confirms the download with the file name in a toast', async () => {
    const { wrapper } = await mountView()
    await button(wrapper, 'Descargar PDF').trigger('click')
    await flushPromises()
    const toasts = useToastStore().toasts
    expect(toasts.at(-1)).toMatchObject({ type: 'success', message: 'Listo, se descargó ventas-la-marchanta-2026-09-24.pdf.' })
  })

  it('a failed generation shows a friendly toast and leaves the buttons usable', async () => {
    pdf.mockRejectedValueOnce(new Error('pdfmake exploded'))
    const { wrapper } = await mountView()
    await button(wrapper, 'Descargar PDF').trigger('click')
    await flushPromises()
    expect(useToastStore().toasts.at(-1)).toMatchObject({ type: 'error', message: 'No pudimos preparar tu archivo. Intenta de nuevo en un momento.' })
    expect(button(wrapper, 'Descargar PDF').attributes('disabled')).toBeUndefined()
    expect(wrapper.text()).not.toContain('Preparando tu archivo…')
  })

  it('a network failure while collecting the detail says so and allows another try', async () => {
    collect.mockRejectedValueOnce({ isAxiosError: true, request: {} })
    const { wrapper } = await mountView()
    await button(wrapper, 'Descargar Excel').trigger('click')
    await flushPromises()
    expect(useToastStore().toasts.at(-1)).toMatchObject({ type: 'error', message: 'No pudimos conectarnos. Revisa tu internet e intenta de nuevo.' })
    expect(excel).not.toHaveBeenCalled()
    await button(wrapper, 'Descargar Excel').trigger('click')
    await flushPromises()
    expect(excel).toHaveBeenCalledTimes(1)
  })

  it('warns gently when the file detail does not match the on-screen totals', async () => {
    collect.mockResolvedValue({ sales: [DETAIL[0]], truncated: false, pagesFetched: 1 })
    const { wrapper } = await mountView()
    expect(wrapper.text()).not.toContain('ya no coinciden')
    await button(wrapper, 'Descargar PDF').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Mientras preparábamos tu archivo se registraron ventas')
    expect(wrapper.text()).toContain('Actualizar')
    // Al actualizar desaparece el aviso.
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).not.toContain('ya no coinciden')
  })

  it('warns when the detail hit the page cap', async () => {
    collect.mockResolvedValue({ sales: DETAIL, truncated: true, pagesFetched: 100 })
    const { wrapper } = await mountView()
    await button(wrapper, 'Descargar PDF').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('más ventas de las que caben en un archivo')
    expect(pdf.mock.calls[0][0].truncated).toBe(true)
  })
})

describe('ReportsView — permisos vivos', () => {
  it('leaves for the app home when the mode changes to Venta', async () => {
    const { router } = await mountView()
    expect(router.currentRoute.value.name).toBe('Reports')
    useUiModeStore().setMode('venta')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('AppHome')
  })

  it('leaves for the app home when the person is no longer a socio', async () => {
    const { router } = await mountView()
    useSessionStore().setMember({ ...SOCIO, role: 'colaborador' })
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('AppHome')
  })

  it('stays put while nothing changes', async () => {
    const { router } = await mountView()
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('Reports')
  })
})
