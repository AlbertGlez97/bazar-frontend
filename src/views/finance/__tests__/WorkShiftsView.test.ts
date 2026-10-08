import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WorkShiftsView from '../WorkShiftsView.vue'
import viewSource from '../WorkShiftsView.vue?raw'
import { addDaysToKey, businessToday } from '@/utils/business-time'
import type { WorkShift, WorkShiftSummary } from '@/types/work-shift.types'
import type { FinanceReferences } from '@/services/contributions-records'
import type { PendingWorkShift } from '@/services/work-shift-records'

const members = [
  { id: 'ana', name: 'Ana', role: 'socio', active: true },
  { id: 'beto', name: 'Beto', role: 'colaborador', active: true },
  { id: 'old', name: 'Olga', role: 'colaborador', active: false },
]
type SummaryState = {
  from: string
  to: string
  memberId: string
  value: WorkShiftSummary
}
const mocks = vi.hoisted(() => ({
  store: {
    history: [] as WorkShift[],
    pending: [] as PendingWorkShift[],
    workers: [] as unknown[],
    allMembers: [] as unknown[],
    references: null as FinanceReferences | null,
    summary: null as SummaryState | null,
    syncing: false,
    error: '',
    nextCursor: null as string | null,
    load: vi.fn(),
    refresh: vi.fn(),
    refreshSummary: vi.fn(),
    create: vi.fn(),
    retry: vi.fn(),
  },
  session: { member: { role: 'socio' } },
  mode: { currentMode: 'gestion' },
}))
vi.mock('@/stores/work-shifts.store', () => ({
  useWorkShiftsStore: () => mocks.store,
}))
vi.mock('@/stores/uiMode.store', () => ({ useUiModeStore: () => mocks.mode }))
vi.mock('@/stores/session.store', () => ({
  useSessionStore: () => mocks.session,
}))

const today = businessToday()
const monthDay = `${today.slice(0, 7)}-01`
const shift = (over: Partial<WorkShift> = {}): WorkShift => ({
  id: 's1',
  memberId: 'ana',
  workDate: monthDay,
  minutes: 510,
  note: 'Turno completo',
  createdByMemberId: 'ana',
  deviceId: 'device',
  contextId: 'business',
  createdByAccountId: 'account',
  receivedAt: `${monthDay}T12:00:00.000Z`,
  reversal: null,
  ...over,
})
const pendingRecord = (
  state: PendingWorkShift['state'],
  item = shift(),
): PendingWorkShift => ({
  kind: 'create',
  payload: {
    id: item.id,
    memberId: item.memberId,
    workDate: item.workDate,
    minutes: item.minutes,
    note: item.note,
    createdByMemberId: 'ana',
    deviceId: 'device',
  },
  origin: { accountId: 'account', apiBase: '/api/v1', memberId: 'ana', deviceId: 'device' },
  id: item.id,
  key: 'k' + item.id,
  scope: 'scope',
  createdAt: item.receivedAt,
  state,
  attempts: state === 'pending' ? 0 : 1,
  nextAttemptAt: 0,
  ...(state === 'pending' ? {} : { lastError: 'El servidor rechazó el registro.' }),
})
const summaryOf = (totals: WorkShiftSummary['totals'], list: WorkShiftSummary['members'] = []): WorkShiftSummary => ({
  totals,
  members: list,
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.session.member = { role: 'socio' }
  mocks.mode.currentMode = 'gestion'
  mocks.store.history = []
  mocks.store.pending = []
  mocks.store.workers = members.filter((m) => m.active)
  mocks.store.allMembers = members
  mocks.store.references = { scope: 's', members: members as never, savedAt: '2026-10-03T12:00:00Z' }
  mocks.store.summary = null
  mocks.store.error = ''
  mocks.store.nextCursor = null
  mocks.store.create.mockResolvedValue('id')
  mocks.store.refresh.mockResolvedValue(undefined)
  mocks.store.refreshSummary.mockResolvedValue(null)
})

const mountView = () =>
  mount(WorkShiftsView, { global: { stubs: { RouterLink: RouterLinkStub } } })

async function fillValid(w: ReturnType<typeof mountView>) {
  await w.find('#work-shift-member').setValue('ana')
  await w.find('#work-shift-date').setValue(monthDay)
  await w.find('#work-shift-duration-hours').setValue('8')
  await w.find('#work-shift-duration-minutes').setValue('30')
  await w.find('#work-shift-note').setValue('  Turno completo  ')
}
const submit = async (w: ReturnType<typeof mountView>) => {
  await w.find('[data-test="create-form"]').trigger('submit')
  await flushPromises()
}

describe('work shifts screen: access and navigation', () => {
  it('shows the four Finanzas tabs with Jornadas active and the form fields', async () => {
    const w = mountView()
    await flushPromises()
    const tabs = w.findAllComponents(RouterLinkStub)
    expect(tabs.map((t) => t.text())).toEqual(['Resumen', 'Aportaciones', 'Gastos', 'Jornadas', 'Reservas', 'Simulador'])
    expect(tabs[3]!.attributes('aria-current')).toBe('page')
    expect(tabs[1]!.attributes('aria-current')).toBeUndefined()
    expect(w.text()).toContain('Registrar jornada')
    for (const id of ['member', 'date', 'duration-hours', 'duration-minutes', 'note'])
      expect(w.find(`#work-shift-${id}`).exists()).toBe(true)
    expect(mocks.store.refresh).toHaveBeenCalled()
  })

  it('does not render for a collaborator or in sales mode and never loads data', async () => {
    mocks.session.member = { role: 'colaborador' }
    let w = mountView()
    await flushPromises()
    expect(w.find('#work-shift-member').exists()).toBe(false)
    expect(w.text()).toContain('Solo socios')
    mocks.session.member = { role: 'socio' }
    mocks.mode.currentMode = 'venta'
    w = mountView()
    await flushPromises()
    expect(w.find('#work-shift-member').exists()).toBe(false)
    expect(mocks.store.refresh).not.toHaveBeenCalled()
  })

  it('never mentions money, pay, percentages or distribution in the screen text', async () => {
    mocks.store.history = [shift()]
    mocks.store.summary = {
      from: monthDay,
      to: addDaysToKey(today, 1),
      memberId: '',
      value: summaryOf({ shiftCount: 1, knownMinutes: 510, unknownDurationCount: 0 }, [
        { memberId: 'ana', shiftCount: 1, knownMinutes: 510, unknownDurationCount: 0 },
      ]),
    }
    const w = mountView()
    await flushPromises()
    expect(w.text()).not.toMatch(/\$|%|comisi|reparto|sueldo|salario|lo que te toca|ganancia|utilidad/i)
  })
})

describe('work shifts screen: create', () => {
  it('only lets active members be chosen as the worker', async () => {
    const w = mountView()
    await flushPromises()
    const names = w.findAll('#work-shift-member option').map((o) => o.text())
    expect(names).toContain('Ana')
    expect(names).toContain('Beto')
    expect(names).not.toContain('Olga')
  })

  it('submits the calendar date, integer minutes and a trimmed note', async () => {
    const w = mountView()
    await flushPromises()
    await fillValid(w)
    await submit(w)
    expect(mocks.store.create).toHaveBeenCalledWith({
      memberId: 'ana',
      workDate: monthDay,
      minutes: 510,
      note: 'Turno completo',
    })
    expect(w.text()).toContain('Jornada guardada en este dispositivo')
    // The next entry keeps the date but not the worker or the duration.
    expect((w.find('#work-shift-date').element as HTMLInputElement).value).toBe(monthDay)
    expect((w.find('#work-shift-duration-hours').element as HTMLInputElement).value).toBe('')
  })

  it('submits an empty duration as null (unknown) and an empty note as null', async () => {
    const w = mountView()
    await flushPromises()
    await w.find('#work-shift-member').setValue('beto')
    await submit(w)
    expect(mocks.store.create).toHaveBeenCalledWith({
      memberId: 'beto',
      workDate: today,
      minutes: null,
      note: null,
    })
  })

  it('accepts tomorrow and sends it as-is, with no max on the date input', async () => {
    const w = mountView()
    await flushPromises()
    await w.find('#work-shift-member').setValue('beto')
    const tomorrow = addDaysToKey(today, 1)
    await w.find('#work-shift-date').setValue(tomorrow)
    await submit(w)
    expect(w.find('#work-shift-date').attributes('max')).toBeUndefined()
    expect(mocks.store.create).toHaveBeenCalledWith(expect.objectContaining({ workDate: tomorrow }))
  })

  it('submits only minutes, converting them with no hours', async () => {
    const w = mountView()
    await flushPromises()
    await w.find('#work-shift-member').setValue('beto')
    await w.find('#work-shift-duration-minutes').setValue('45')
    await submit(w)
    expect(mocks.store.create).toHaveBeenCalledWith(expect.objectContaining({ minutes: 45 }))
  })

  it.each([
    ['no worker', { '#work-shift-member': '' }, 'quién trabajó'],
    ['an empty date', { '#work-shift-date': '' }, 'fecha'],
    ['decimal hours', { '#work-shift-duration-hours': '1.5' }, 'entero'],
    ['negative minutes', { '#work-shift-duration-minutes': '-5' }, 'entero'],
    ['minutes above 59', { '#work-shift-duration-minutes': '75' }, '0 a 59'],
    ['a zero duration', { '#work-shift-duration-hours': '0', '#work-shift-duration-minutes': '0' }, 'al menos 1 minuto'],
  ])('does not save %s and says what is wrong', async (_name, change, text) => {
    const w = mountView()
    await flushPromises()
    await fillValid(w)
    for (const [selector, value] of Object.entries(change))
      await w.find(selector).setValue(value)
    await submit(w)
    expect(mocks.store.create).not.toHaveBeenCalled()
    expect(w.find('[role="alert"]').text()).toContain(text)
  })

  it('does not claim success when durable storage fails and keeps what was typed', async () => {
    mocks.store.create.mockRejectedValue(new Error('disk full'))
    const w = mountView()
    await flushPromises()
    await fillValid(w)
    await submit(w)
    expect(w.text()).toContain('No se pudo guardar la jornada')
    expect(w.text()).not.toContain('Jornada guardada en este dispositivo')
    expect((w.find('#work-shift-note').element as HTMLTextAreaElement).value).toBe('  Turno completo  ')
    expect((w.find('#work-shift-duration-hours').element as HTMLInputElement).value).toBe('8')
  })

  it('cannot register without team members and explains why', async () => {
    mocks.store.workers = []
    const w = mountView()
    await flushPromises()
    expect(w.text()).toContain('No hay miembros disponibles')
    expect(w.find('[data-test="create-form"] button[type="submit"]').attributes('disabled')).toBeDefined()
  })
})

describe('work shifts screen: list', () => {
  it('shows member, date, duration, note and sync state in a card per shift', async () => {
    mocks.store.history = [
      shift({ id: 'a', minutes: 510 }),
      shift({ id: 'b', memberId: 'old', minutes: 480, note: null }),
      shift({ id: 'c', memberId: 'beto', minutes: null, note: 'x'.repeat(300) }),
      shift({ id: 'd', memberId: 'beto', minutes: 45 }),
    ]
    mocks.store.pending = [pendingRecord('pending', shift({ id: 'new', memberId: 'beto', minutes: 60 }))]
    const w = mountView()
    await flushPromises()
    const rows = w.findAll('[data-test="work-shift-row"]')
    expect(rows).toHaveLength(5)
    const text = rows.map((r) => r.text()).join('|')
    expect(text).toContain('8 h 30 min')
    expect(text).toContain('8 h')
    expect(text).toContain('45 min')
    expect(text).toContain('1 h')
    expect(text).toContain('Duración no registrada')
    expect(text).toContain('Olga')
    expect(text).toContain(`01/${today.slice(5, 7)}/${today.slice(0, 4)}`)
    expect(text).toContain('Turno completo')
    expect(text).toContain('Sincronizada')
    expect(text).toContain('Pendiente')
    expect(text).not.toContain('x'.repeat(200))
    expect(text).toContain('…')
    expect(text).not.toMatch(/\b0 min\b/)
  })

  it('shows an unknown duration as text, never as 0', async () => {
    mocks.store.history = [shift({ minutes: null })]
    const w = mountView()
    await flushPromises()
    const text = w.find('[data-test="work-shift-row"]').text()
    expect(text).toContain('Duración no registrada')
    expect(text).not.toMatch(/\b0\b/)
  })

  it('falls back to the historical name embedded in the list item, then to a neutral label', async () => {
    mocks.store.allMembers = []
    mocks.store.history = [
      shift({ id: 'a', memberId: 'gone', member: { id: 'gone', name: 'Gabo', active: false, role: 'colaborador' } }),
      shift({ id: 'b', memberId: 'ghost' }),
    ]
    const w = mountView()
    await flushPromises()
    const text = w.text()
    expect(text).toContain('Gabo')
    expect(text).toContain('Miembro (referencia histórica)')
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

  it('does not duplicate a shift that is both confirmed and still in the queue', async () => {
    mocks.store.history = [shift()]
    mocks.store.pending = [pendingRecord('pending')]
    const w = mountView()
    await flushPromises()
    expect(w.findAll('[data-test="work-shift-row"]')).toHaveLength(1)
  })

  it('shows the same-day warning only when the stored receipt carries it', async () => {
    mocks.store.history = [
      shift({ id: 'warn', warnings: [{ code: 'MULTIPLE_SHIFTS_SAME_DAY', existingActiveShiftCount: 1 }] }),
      shift({ id: 'many', warnings: [{ code: 'MULTIPLE_SHIFTS_SAME_DAY', existingActiveShiftCount: 3 }] }),
      shift({ id: 'clean', warnings: [] }),
      shift({ id: 'listed' }),
    ]
    const w = mountView()
    await flushPromises()
    const warnings = w.findAll('[data-test="same-day-warning"]').map((e) => e.text())
    expect(warnings).toHaveLength(2)
    expect(warnings.some((t) => t.includes('otra jornada'))).toBe(true)
    expect(warnings.some((t) => t.includes('3 jornadas'))).toBe(true)
  })

  it('shows Anulada and Corregida only from the list item reversal marker', async () => {
    mocks.store.history = [
      shift({ id: 'r1', reversal: { id: 'x', replacementWorkShiftId: null } }),
      shift({ id: 'r2', reversal: { id: 'y', replacementWorkShiftId: 'z' } }),
      shift({ id: 'ok' }),
    ]
    const w = mountView()
    await flushPromises()
    const text = w.text()
    expect(text).toContain('Anulada')
    expect(text).toContain('Corregida')
    // No correction controls exist yet.
    expect(w.findAll('button').some((b) => /Anular|Corregir/.test(b.text()))).toBe(false)
  })

  it('shows an empty state without rows', async () => {
    const w = mountView()
    await flushPromises()
    expect(w.text()).toContain('No hay jornadas guardadas')
  })

  it('offers loading more only for the filters the cursor belongs to', async () => {
    mocks.store.nextCursor = 'next'
    const w = mountView()
    await flushPromises()
    expect(w.findAll('button').some((b) => b.text() === 'Cargar más')).toBe(true)
    await w.find('#work-shift-filter-member').setValue('beto')
    expect(w.findAll('button').some((b) => b.text() === 'Cargar más')).toBe(false)
  })
})

describe('work shifts screen: period and filters', () => {
  it('refreshes with calendar dates (inclusive start, exclusive end) and the member, then the summary', async () => {
    const w = mountView()
    await flushPromises()
    mocks.store.refresh.mockClear()
    mocks.store.refreshSummary.mockClear()
    await w.find('#work-shift-filter-member').setValue('old')
    const dates = w.findAll('.report-range-picker input[type="date"]')
    await dates[0]!.setValue('2026-10-01')
    await dates[1]!.setValue(today)
    await w.find('.report-range-picker').trigger('submit')
    await flushPromises()
    const to = addDaysToKey(today, 1)
    expect(mocks.store.refresh).toHaveBeenLastCalledWith({
      from: '2026-10-01',
      to,
      memberId: 'old',
      limit: 50,
    })
    expect(mocks.store.refreshSummary).toHaveBeenCalledOnce()
    expect(mocks.store.refreshSummary).toHaveBeenCalledWith({ from: '2026-10-01', to, memberId: 'old' })
  })

  it('uses plain dates with no time or offset in the requests', async () => {
    mountView()
    await flushPromises()
    const [filter] = mocks.store.refresh.mock.calls.at(-1)!
    expect(filter.from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(filter.to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(filter).not.toHaveProperty('memberId')
  })

  it('applies a quick preset and requests again', async () => {
    const w = mountView()
    await flushPromises()
    mocks.store.refresh.mockClear()
    await w.find('.report-range-picker__preset').trigger('click') // Hoy
    await flushPromises()
    expect(mocks.store.refresh).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: today, to: addDaysToKey(today, 1) }),
    )
  })

  it('filters the local list by member and by period without a request', async () => {
    mocks.store.history = [
      shift({ id: 'a', memberId: 'ana' }),
      shift({ id: 'b', memberId: 'beto' }),
      shift({ id: 'c', memberId: 'beto' }),
      shift({ id: 'old-one', memberId: 'beto', workDate: '2020-01-01' }),
    ]
    const w = mountView()
    await flushPromises()
    const count = () => w.findAll('[data-test="work-shift-row"]').length
    expect(count()).toBe(3) // the 2020 shift is outside the default month
    await w.find('#work-shift-filter-member').setValue('beto')
    expect(count()).toBe(2)
    await w.find('#work-shift-filter-member').setValue('ana')
    expect(count()).toBe(1)
  })

  it('includes a shift on the last day and excludes the day after it', async () => {
    mocks.store.history = [
      shift({ id: 'last', workDate: today }),
      shift({ id: 'next', workDate: addDaysToKey(today, 1) }),
    ]
    const w = mountView()
    await flushPromises()
    expect(w.findAll('[data-test="work-shift-row"]')).toHaveLength(1)
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

  it('keeps the local copy and warns when the refresh fails', async () => {
    mocks.store.refresh.mockRejectedValue(new Error('offline'))
    mocks.store.history = [shift()]
    const w = mountView()
    await flushPromises()
    expect(w.text()).toContain('copia local disponible')
    expect(w.findAll('[data-test="work-shift-row"]')).toHaveLength(1)
  })
})

describe('work shifts screen: summary', () => {
  const server = (memberId = ''): SummaryState => ({
    from: monthDay,
    to: addDaysToKey(today, 1),
    memberId,
    value: summaryOf({ shiftCount: 5, knownMinutes: 1230, unknownDurationCount: 2 }, [
      { memberId: 'ana', shiftCount: 3, knownMinutes: 1230, unknownDurationCount: 0 },
      { memberId: 'beto', shiftCount: 2, knownMinutes: 0, unknownDurationCount: 2 },
    ]),
  })

  it('shows server figures per member as "N jornadas · X registradas · Z sin duración" when they match', async () => {
    mocks.store.summary = server()
    const w = mountView()
    await flushPromises()
    const text = w.find('[data-test="summary"]').text()
    expect(text).toContain('20 h 30 min')
    const members = w.findAll('[data-test="summary-member"]').map((e) => e.text())
    expect(members[0]).toContain('Ana')
    expect(members[0]).toContain('3 jornadas · 20 h 30 min registradas · 0 sin duración')
    expect(members[1]).toContain('Beto')
    expect(members[1]).toContain('2 jornadas · 0 h registradas · 2 sin duración')
    expect(w.text()).toContain('Totales del servidor')
  })

  it('ignores server figures that belong to another member filter', async () => {
    mocks.store.summary = server('beto')
    mocks.store.history = [shift({ id: 'a', minutes: 60 })]
    const w = mountView()
    await flushPromises()
    expect(w.text()).not.toContain('Totales del servidor')
    expect(w.text()).toContain('guardados en este dispositivo')
    expect(w.find('[data-test="summary"]').text()).toContain('1 jornada · 1 h registradas · 0 sin duración')
  })

  it('falls back to local figures, counts unknown durations apart and excludes annulled shifts', async () => {
    mocks.store.history = [
      shift({ id: 'a', minutes: 480 }),
      shift({ id: 'b', minutes: 30 }),
      shift({ id: 'c', minutes: null }),
      shift({ id: 'r', minutes: 999, reversal: { id: 'rv', replacementWorkShiftId: null } }),
    ]
    const w = mountView()
    await flushPromises()
    const text = w.find('[data-test="summary"]').text()
    expect(text).toContain('3 jornadas · 8 h 30 min registradas · 1 sin duración')
    expect(w.text()).toContain('puede estar incompleto')
    expect(text).not.toContain('999')
  })

  it('hides local figures when a record needs review rather than showing numbers that may be wrong', async () => {
    mocks.store.pending = [pendingRecord('needs_review')]
    const w = mountView()
    await flushPromises()
    expect(w.find('[data-test="summary"]').exists()).toBe(false)
    expect(w.text()).toContain('No se muestran totales')
  })

  it('shows zero shifts for an empty period instead of inventing hours', async () => {
    const w = mountView()
    await flushPromises()
    const text = w.find('[data-test="summary"]').text()
    expect(text).toContain('No hay jornadas en este periodo')
    expect(w.findAll('[data-test="summary-member"]')).toHaveLength(0)
  })

  it('lists the queued shifts the server totals do not include', async () => {
    mocks.store.summary = server()
    mocks.store.pending = [pendingRecord('pending', shift({ id: 'q' }))]
    const w = mountView()
    await flushPromises()
    expect(w.text()).toContain('No incluyen 1 registro(s) pendientes')
  })
})

describe('work shifts screen: responsive layout', () => {
  it('has responsive grids for mobile, tablet and desktop and lets cards shrink', () => {
    expect(viewSource).toMatch(/@media \(min-width: 640px\)/)
    expect(viewSource).toMatch(/@media \(min-width: 1024px\)/)
    expect(viewSource).toMatch(/min-width: 0/)
    expect(viewSource).toMatch(/overflow-wrap: anywhere/)
  })

  it('uses cards, not a wide table', () => {
    expect(viewSource).not.toMatch(/<table/)
  })
})
