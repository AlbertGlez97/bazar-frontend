import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WorkShiftsView from '../WorkShiftsView.vue'
import { AppModal } from '@/components'
import { addDaysToKey, businessToday } from '@/utils/business-time'
import type { WorkShift, WorkShiftSummary } from '@/types/work-shift.types'
import type { FinanceReferences } from '@/services/contributions-records'
import type { PendingWorkShift } from '@/services/work-shift-records'

const members = [
  { id: 'ana', name: 'Ana', role: 'socio', active: true },
  { id: 'beto', name: 'Beto', role: 'colaborador', active: true },
  { id: 'old', name: 'Olga', role: 'colaborador', active: false },
]
type SummaryState = { from: string; to: string; memberId: string; value: WorkShiftSummary }
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
    reverse: vi.fn(),
    retry: vi.fn(),
  },
  session: { member: { role: 'socio' } },
  mode: { currentMode: 'gestion' },
}))
vi.mock('@/stores/work-shifts.store', () => ({ useWorkShiftsStore: () => mocks.store }))
vi.mock('@/stores/uiMode.store', () => ({ useUiModeStore: () => mocks.mode }))
vi.mock('@/stores/session.store', () => ({ useSessionStore: () => mocks.session }))

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
const origin = { accountId: 'account', apiBase: '/api/v1', memberId: 'ana', deviceId: 'device' }
const base = (state: PendingWorkShift['state']) => ({
  origin,
  scope: 'scope',
  createdAt: `${monthDay}T12:00:00.000Z`,
  state,
  attempts: state === 'pending' ? 0 : 1,
  nextAttemptAt: 0,
  ...(state === 'pending' ? {} : { lastError: 'El servidor rechazó el registro.' }),
})
const pendingCreate = (state: PendingWorkShift['state'], item = shift()): PendingWorkShift => ({
  ...base(state),
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
  id: item.id,
  key: 'k' + item.id,
})
const pendingReverse = (
  state: PendingWorkShift['state'],
  workShiftId = 's1',
  replacement?: Partial<WorkShift>,
): PendingWorkShift => ({
  ...base(state),
  kind: 'reverse',
  workShiftId,
  payload: {
    id: 'rev-' + workShiftId,
    occurredAt: '2026-10-05T12:00:00.000Z',
    reason: 'Duración incorrecta',
    createdByMemberId: 'ana',
    deviceId: 'device',
    ...(replacement
      ? {
          replacement: {
            id: 'rep-' + workShiftId,
            memberId: 'ana',
            workDate: monthDay,
            minutes: 600,
            note: null,
            createdByMemberId: 'ana',
            deviceId: 'device',
            ...replacement,
          },
        }
      : {}),
  },
  id: 'rev-' + workShiftId,
  key: 'kr' + workShiftId,
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
  mocks.store.reverse.mockResolvedValue(undefined)
  mocks.store.refresh.mockResolvedValue(undefined)
  mocks.store.refreshSummary.mockResolvedValue(null)
})

const mountView = () =>
  mount(WorkShiftsView, {
    global: {
      stubs: {
        RouterLink: RouterLinkStub,
        AppModal: { template: '<div><slot/><slot name="footer"/></div>' },
      },
    },
  })
const button = (w: ReturnType<typeof mountView>, label: string) =>
  w.findAll('button').find((b) => b.text() === label)
const rowTexts = (w: ReturnType<typeof mountView>) =>
  w.findAll('[data-test="work-shift-row"]').map((r) => r.text())
const submitCorrection = async (w: ReturnType<typeof mountView>) => {
  await w.find('#correction-form').trigger('submit')
  await flushPromises()
}

describe('work shift reversal actions: visibility and permissions', () => {
  it('offers Corregir and Anular only on active, eligible rows', async () => {
    mocks.store.history = [
      shift({ id: 'active' }),
      shift({ id: 'void', reversal: { id: 'x', replacementWorkShiftId: null } }),
      shift({ id: 'fixed', reversal: { id: 'y', replacementWorkShiftId: 'z' } }),
      shift({ id: 'queued' }),
      shift({ id: 'review' }),
    ]
    mocks.store.pending = [pendingReverse('pending', 'queued'), pendingCreate('needs_review', shift({ id: 'review' }))]
    const w = mountView()
    await flushPromises()
    const rows = w.findAll('[data-test="work-shift-row"]')
    const actions = rows.map((r) => r.findAll('button').map((b) => b.text()).filter((t) => /^(Corregir|Anular)$/.test(t)))
    // Rows are sorted by workDate then id (descending): void, review, queued, fixed, active.
    expect(rows.map((r) => r.text().includes('Anulada'))).toEqual([true, false, false, false, false])
    expect(rows.length).toBe(5)
    const byId = Object.fromEntries(
      ['void', 'review', 'queued', 'fixed', 'active'].map((id, i) => [id, actions[i]]),
    )
    expect(byId.active).toEqual(['Corregir', 'Anular'])
    expect(byId.void).toEqual([])
    expect(byId.fixed).toEqual([])
    expect(byId.queued).toEqual([])
    expect(byId.review).toEqual([])
  })

  it('offers the actions on a still-queued original (the reversal waits for it)', async () => {
    mocks.store.pending = [pendingCreate('pending')]
    const w = mountView()
    await flushPromises()
    expect(button(w, 'Corregir')).toBeTruthy()
    expect(button(w, 'Anular')).toBeTruthy()
    expect(rowTexts(w)[0]).toContain('Pendiente')
  })

  it('gives the buttons accessible names that identify the shift', async () => {
    mocks.store.history = [shift()]
    const w = mountView()
    await flushPromises()
    const labels = w.findAll('button').map((b) => b.attributes('aria-label') ?? '')
    expect(labels.some((l) => l.startsWith('Anular jornada de Ana'))).toBe(true)
    expect(labels.some((l) => l.startsWith('Corregir jornada de Ana'))).toBe(true)
  })

  it('renders nothing for a collaborator, so no action can be reached', async () => {
    mocks.session.member = { role: 'colaborador' }
    mocks.store.history = [shift()]
    const w = mountView()
    await flushPromises()
    expect(button(w, 'Anular')).toBeUndefined()
    expect(button(w, 'Corregir')).toBeUndefined()
    expect(w.text()).toContain('Solo socios')
  })
})

describe('work shift annulment', () => {
  it('requires a nonblank reason and keeps the dialog open with an alert', async () => {
    mocks.store.history = [shift()]
    const w = mountView()
    await flushPromises()
    await button(w, 'Anular')!.trigger('click')
    await w.find('#correction-reason').setValue('    ')
    await submitCorrection(w)
    expect(mocks.store.reverse).not.toHaveBeenCalled()
    expect(w.find('[role="alert"]').text()).toContain('motivo')
  })

  it('annuls with the trimmed reason and no replacement, and says the original is kept', async () => {
    mocks.store.history = [shift()]
    const w = mountView()
    await flushPromises()
    await button(w, 'Anular')!.trigger('click')
    expect(w.find('#correction-member').exists()).toBe(false)
    await w.find('#correction-reason').setValue('  Registrada dos veces  ')
    await submitCorrection(w)
    expect(mocks.store.reverse).toHaveBeenCalledWith('s1', 'Registrada dos veces', undefined)
    expect(w.text()).toContain('Anulación guardada')
    expect(w.text()).toContain('se conserva')
  })

  it('refuses a reason longer than 1000 characters', async () => {
    mocks.store.history = [shift()]
    const w = mountView()
    await flushPromises()
    await button(w, 'Anular')!.trigger('click')
    await w.find('#correction-reason').setValue('x'.repeat(1001))
    await submitCorrection(w)
    expect(mocks.store.reverse).not.toHaveBeenCalled()
  })

  it('keeps the dialog open and reports a failed durable write without claiming success', async () => {
    mocks.store.history = [shift()]
    mocks.store.reverse.mockRejectedValue(new Error('disk full'))
    const w = mountView()
    await flushPromises()
    await button(w, 'Anular')!.trigger('click')
    await w.find('#correction-reason').setValue('Duplicada')
    await submitCorrection(w)
    expect(w.find('[role="alert"]').text()).toContain('No se pudo guardar la corrección')
    expect(w.text()).not.toContain('Anulación guardada')
  })

  it('explains a second correction attempt in plain Spanish', async () => {
    mocks.store.history = [shift()]
    mocks.store.reverse.mockRejectedValue(new Error('Work shift already has a correction'))
    const w = mountView()
    await flushPromises()
    await button(w, 'Anular')!.trigger('click')
    await w.find('#correction-reason').setValue('Duplicada')
    await submitCorrection(w)
    expect(w.find('[role="alert"]').text()).toContain('ya tiene una anulación o corrección')
  })
})

describe('work shift correction', () => {
  async function openCorrection(item = shift()) {
    mocks.store.history = [item]
    const w = mountView()
    await flushPromises()
    await button(w, 'Corregir')!.trigger('click')
    return w
  }
  const value = (w: ReturnType<typeof mountView>, selector: string) =>
    (w.find(selector).element as HTMLInputElement).value

  it('pre-fills worker, date, hours, minutes and note from the original', async () => {
    const w = await openCorrection()
    expect(value(w, '#correction-member')).toBe('ana')
    expect(value(w, '#correction-date')).toBe(monthDay)
    expect(value(w, '#correction-duration-hours')).toBe('8')
    expect(value(w, '#correction-duration-minutes')).toBe('30')
    expect(value(w, '#correction-note')).toBe('Turno completo')
  })

  it('sends the replacement fields with the typed hours and minutes converted to minutes', async () => {
    const w = await openCorrection()
    await w.find('#correction-reason').setValue('Duración incorrecta')
    await w.find('#correction-member').setValue('beto')
    await w.find('#correction-duration-hours').setValue('1')
    await w.find('#correction-duration-minutes').setValue('5')
    await w.find('#correction-note').setValue('  Ajustada  ')
    await submitCorrection(w)
    expect(mocks.store.reverse).toHaveBeenCalledWith('s1', 'Duración incorrecta', {
      memberId: 'beto',
      workDate: monthDay,
      minutes: 65,
      note: 'Ajustada',
    })
    expect(w.text()).toContain('Corrección guardada')
  })

  it('sends null (unknown) when the duration is emptied, never 0', async () => {
    const w = await openCorrection()
    await w.find('#correction-reason').setValue('No se sabe cuánto duró')
    await w.find('#correction-duration-hours').setValue('')
    await w.find('#correction-duration-minutes').setValue('')
    await submitCorrection(w)
    expect(mocks.store.reverse.mock.calls[0]?.[2]).toMatchObject({ minutes: null })
  })

  it('pre-fills an unknown duration as empty and rejects an explicit zero', async () => {
    const w = await openCorrection(shift({ minutes: null, note: null }))
    expect(value(w, '#correction-duration-hours')).toBe('')
    expect(value(w, '#correction-duration-minutes')).toBe('')
    await w.find('#correction-reason').setValue('Motivo')
    await w.find('#correction-duration-hours').setValue('0')
    await w.find('#correction-duration-minutes').setValue('0')
    await submitCorrection(w)
    expect(mocks.store.reverse).not.toHaveBeenCalled()
    expect(w.find('[role="alert"]').text()).toContain('al menos 1 minuto')
  })

  it('pre-fills whole hours and sub-hour durations without inventing values', async () => {
    let w = await openCorrection(shift({ minutes: 60 }))
    expect(value(w, '#correction-duration-hours')).toBe('1')
    expect(value(w, '#correction-duration-minutes')).toBe('')
    w = await openCorrection(shift({ minutes: 45 }))
    expect(value(w, '#correction-duration-hours')).toBe('')
    expect(value(w, '#correction-duration-minutes')).toBe('45')
  })

  it('offers only active workers and refuses an inactive original worker', async () => {
    const w = await openCorrection(shift({ memberId: 'old' }))
    const names = w.findAll('#correction-member option').map((o) => o.text())
    expect(names).toContain('Ana')
    expect(names).not.toContain('Olga')
    await w.find('#correction-reason').setValue('Persona equivocada')
    await submitCorrection(w)
    expect(mocks.store.reverse).not.toHaveBeenCalled()
    expect(w.find('[role="alert"]').text()).toContain('quién trabajó')
  })

  it('requires a reason before saving a correction', async () => {
    const w = await openCorrection()
    await submitCorrection(w)
    expect(mocks.store.reverse).not.toHaveBeenCalled()
    expect(w.find('[role="alert"]').text()).toContain('motivo')
  })
})

describe('work shift states and summary', () => {
  it('shows the reversal reason on an annulled shift and Corregida on a corrected one', async () => {
    mocks.store.history = [
      shift({ id: 'a', reversal: { id: 'x', replacementWorkShiftId: null, reason: 'Duplicada' } }),
      shift({ id: 'b', reversal: { id: 'y', replacementWorkShiftId: 'z', reason: 'Otra persona' } }),
    ]
    const w = mountView()
    await flushPromises()
    const texts = rowTexts(w).join('|')
    expect(texts).toContain('Anulada')
    expect(texts).toContain('Motivo: Duplicada')
    expect(texts).toContain('Corregida')
    expect(texts).toContain('Motivo: Otra persona')
    expect(texts).toContain('Sincronizada')
  })

  it('shows a queued correction on the original and its replacement as Pendiente', async () => {
    mocks.store.history = [shift()]
    mocks.store.pending = [pendingReverse('pending', 's1', { minutes: 600 })]
    const w = mountView()
    await flushPromises()
    const texts = rowTexts(w)
    expect(texts).toHaveLength(2)
    expect(texts.some((t) => t.includes('Corrección pendiente: Duración incorrecta'))).toBe(true)
    expect(texts.some((t) => t.includes('Jornada de reemplazo pendiente de sincronizar') && t.includes('Pendiente'))).toBe(true)
    // Neither the original nor the queued replacement can be acted on again.
    expect(button(w, 'Anular')).toBeUndefined()
    expect(button(w, 'Corregir')).toBeUndefined()
  })

  it('shows a queued annulment as pending without a replacement row', async () => {
    mocks.store.history = [shift()]
    mocks.store.pending = [pendingReverse('pending')]
    const w = mountView()
    await flushPromises()
    expect(rowTexts(w)).toHaveLength(1)
    expect(rowTexts(w)[0]).toContain('Anulación pendiente')
  })

  it('local summary stops counting the original and counts the queued replacement', async () => {
    mocks.store.history = [shift({ minutes: 510 })]
    mocks.store.pending = [pendingReverse('pending', 's1', { minutes: 600 })]
    const w = mountView()
    await flushPromises()
    const summary = w.find('[data-test="summary"]').text()
    expect(summary).toContain('10 h')
    expect(summary).not.toContain('8 h 30 min')
  })

  it('local summary of a queued annulment excludes the original entirely', async () => {
    mocks.store.history = [shift({ minutes: 510 })]
    mocks.store.pending = [pendingReverse('pending')]
    const w = mountView()
    await flushPromises()
    expect(w.text()).toContain('No hay jornadas en este periodo')
  })

  it('shows the server summary note counting a queued correction as not yet included', async () => {
    mocks.store.history = [shift()]
    mocks.store.pending = [pendingReverse('pending')]
    mocks.store.summary = {
      from: monthDay,
      to: addDaysToKey(today, 1),
      memberId: '',
      value: { totals: { shiftCount: 1, knownMinutes: 510, unknownDurationCount: 0 }, members: [] },
    }
    const w = mountView()
    await flushPromises()
    expect(w.text()).toContain('No incluyen 1 registro(s) pendientes de sincronizar')
  })

  it('hides local totals and offers a retry when a queued correction needs review', async () => {
    mocks.store.history = [shift()]
    const record = pendingReverse('needs_review')
    mocks.store.pending = [record]
    const w = mountView()
    await flushPromises()
    expect(w.find('[data-test="summary"]').exists()).toBe(false)
    expect(w.text()).toContain('No se muestran totales')
    expect(rowTexts(w)[0]).toContain('requiere revisión')
    expect(rowTexts(w)[0]).toContain('El servidor rechazó el registro.')
    await button(w, 'Reintentar corrección')!.trigger('click')
    expect(mocks.store.retry).toHaveBeenCalledWith(record)
  })
})

describe('work shift correction dialog accessibility', () => {
  it('opts into focus management, labels its controls and keeps an alert region for errors', async () => {
    mocks.store.history = [shift()]
    const w = mount(WorkShiftsView, { global: { stubs: { RouterLink: RouterLinkStub } } })
    await flushPromises()
    expect(w.getComponent(AppModal).props('manageFocus')).toBe(true)
    w.unmount()
  })

  it('closes with Escape and returns focus to the button that opened it', async () => {
    mocks.store.history = [shift()]
    const host = document.createElement('div')
    document.body.appendChild(host)
    const w = mount(WorkShiftsView, {
      attachTo: host,
      global: { stubs: { RouterLink: RouterLinkStub } },
    })
    await flushPromises()
    const trigger = w.findAll('button').find((b) => b.text() === 'Corregir')!
    ;(trigger.element as HTMLElement).focus()
    await trigger.trigger('click')
    await flushPromises()
    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog).toBeTruthy()
    expect(document.querySelector('#correction-reason')).toBeTruthy()
    expect(dialog!.contains(document.activeElement)).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger.element)
    w.unmount()
    host.remove()
  })

  it('labels every dialog field', async () => {
    mocks.store.history = [shift()]
    const w = mountView()
    await flushPromises()
    await w.findAll('button').find((b) => b.text() === 'Corregir')!.trigger('click')
    for (const id of ['reason', 'member', 'date', 'duration-hours', 'duration-minutes', 'note']) {
      const field = w.find(`#correction-${id}`)
      expect(field.exists()).toBe(true)
      expect(w.find(`label[for="correction-${id}"]`).exists()).toBe(true)
    }
  })
})
