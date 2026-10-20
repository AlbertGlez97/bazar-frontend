import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { reactive } from 'vue'
import { DOMWrapper, mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SimulatorView from '../SimulatorView.vue'
import { useFinanceDistributionStore } from '@/stores/finance-distribution.store'
import { addDaysToKey } from '@/utils/business-time'
import { simulatorPreset } from '@/utils/finance-distribution'
import { overviewFixture } from '@/services/__tests__/finance-overview.fixture'
import { ADID_ID, memberFixture, simulationFixture } from '@/services/__tests__/finance-distribution.fixture'
import AgreementCreateForm from '../components/AgreementCreateForm.vue'
import { useFinanceAgreementsStore } from '@/stores/finance-agreements.store'
import { agreementFixture } from '@/services/__tests__/finance-agreements.fixture'
import type { DistributionSimulation } from '@/types/finance-distribution.types'

const mocks = vi.hoisted(() => ({ simulate: vi.fn(), overview: vi.fn(), create: vi.fn(), list: vi.fn(), get: vi.fn(), reverse: vi.fn(), commitment: vi.fn() }))
vi.mock('@/services/finance-agreements.service', () => ({ FinanceAgreementsService: { create: mocks.create, list: mocks.list, get: mocks.get, reverse: mocks.reverse, commitment: mocks.commitment } }))
vi.mock('@/services/queue-origin', async (importOriginal) => ({ ...(await importOriginal<object>()), currentQueueOrigin: () => ({ ...access.session.owner, memberId: access.session.memberId, deviceId: access.session.deviceId }) }))
vi.mock('@/services/finance-distribution.service', () => ({
  FinanceDistributionService: { simulate: mocks.simulate },
}))
vi.mock('@/services/finance-overview.service', () => ({ FinanceOverviewService: { get: mocks.overview } }))
const freshSession = () => ({ member: { role: 'socio', active: true } as { role: string; active?: boolean } | null, memberId: 'member-a', deviceId: 'device-a', owner: { accountId: 'account-a', apiBase: '/api/v1' } })
const access = reactive({ session: freshSession(), mode: { currentMode: 'gestion' }, auth: { token: 'token-a' } })
vi.mock('@/stores/auth.store', () => ({ useAuthStore: () => access.auth }))
vi.mock('@/stores/uiMode.store', () => ({ useUiModeStore: () => access.mode }))
vi.mock('@/stores/session.store', () => ({ useSessionStore: () => access.session }))

const route = reactive({ query: {} as Record<string, string> })
vi.mock('vue-router', async (importOriginal) => ({ ...(await importOriginal<object>()), useRoute: () => route }))

const month = simulatorPreset('mes')
const monthExclusive = addDaysToKey(month.to, 1)
const http = (status: number, data: unknown = {}) => Object.assign(new Error('x'), { response: { status, data } })
function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}
function baseOverview(available = 800000, status: 'complete' | 'partial' = 'complete') {
  const o = overviewFixture()
  o.result.potentiallyAvailableMinor = available
  o.result.status = status
  return o
}

beforeEach(() => {
  setActivePinia(createPinia())
  mocks.simulate.mockReset()
  mocks.overview.mockReset()
  route.query = {}
  mocks.get.mockReset()
  mocks.create.mockReset()
  mocks.create.mockResolvedValue(agreementFixture())
  mocks.commitment.mockReset()
  mocks.commitment.mockImplementation(async (_origin: unknown, range: { from: string; to: string }) =>
    ({ ...range, availableMinor: 800000, committedMinor: 0, freeMinor: 800000, agreementCount: 0 }))
  access.session = freshSession()
  access.mode = { currentMode: 'gestion' }
  access.auth = { token: 'token-a' }
  mocks.overview.mockResolvedValue(baseOverview())
  mocks.simulate.mockResolvedValue(simulationFixture())
})

const mountView = (attach = false) =>
  mount(SimulatorView, { attachTo: attach ? document.body : undefined, global: { stubs: { RouterLink: RouterLinkStub } } })
async function mounted(attach = false) {
  const w = mountView(attach)
  await flushPromises()
  return w
}
type Wrapper = Awaited<ReturnType<typeof mounted>>
const q = (w: Wrapper, name: string) => w.find(`[data-test="${name}"]`)
const setAmount = (w: Wrapper, text: string) => w.find('#sim-amount').setValue(text)
async function setRule(w: Wrapper, partner: string, work: string) {
  await w.find('#sim-partner').setValue(partner)
  await w.find('#sim-work').setValue(work)
}
async function calculate(w: Wrapper) {
  await q(w, 'sim-form').trigger('submit')
  await flushPromises()
}
const sent = () => mocks.simulate.mock.calls.at(-1)![0]

describe('access, header and tabs', () => {
  it('lists Simulador as the active tab beside Acuerdos and has a single h1', async () => {
    const w = await mounted()
    const tabs = w.findAllComponents(RouterLinkStub)
    expect(tabs.map((t) => t.text())).toEqual(['Resumen', 'Aportaciones', 'Gastos', 'Jornadas', 'Reservas', 'Simulador', 'Acuerdos'])
    expect(tabs.at(-2)!.props('to')).toBe('/app/finanzas/simulador')
    expect(tabs.at(-2)!.attributes('aria-current')).toBe('page')
    expect(w.findAll('h1')).toHaveLength(1)
    expect(w.find('h1').text()).toBe('Simulador de reparto')
  })

  it('has one h2 per step plus the result', async () => {
    const w = await mounted()
    expect(w.findAll('h2').map((h) => h.text())).toEqual([
      'Período',
      'Base financiera',
      'Cuánto quiero simular',
      'Regla',
      'Base del trabajo',
      'Resultado de la simulación',
    ])
  })

  it.each([
    ['a colaborador', () => (access.session.member = { role: 'colaborador' })],
    ['no member', () => (access.session.member = null)],
    ['venta mode', () => (access.mode = { currentMode: 'venta' })],
  ])('blocks %s with a calm message and requests nothing', async (_name, change) => {
    change()
    const w = await mounted()
    expect(w.text()).toContain('Solo socios pueden usar el simulador de reparto en Gestión.')
    expect(w.find('h1').exists()).toBe(false)
    expect(mocks.overview).not.toHaveBeenCalled()
    expect(mocks.simulate).not.toHaveBeenCalled()
  })

  it.each(['member', 'device', 'account', 'api', 'token'])('reloads an allowed mounted view after %s attribution changes and ignores old requests', async (identity) => {
    const w = await mounted()
    await setAmount(w, '6,000')
    await setRule(w, '70', '30')
    await q(w, 'basis-KNOWN_MINUTES').setValue(true)
    await calculate(w)
    expect(q(w, 'members').exists()).toBe(true)
    const oldBase = deferred<ReturnType<typeof baseOverview>>()
    mocks.overview.mockReturnValueOnce(oldBase.promise)
    await w.find('.report-range-picker').trigger('submit')
    const oldResult = deferred<DistributionSimulation>()
    mocks.simulate.mockReturnValueOnce(oldResult.promise)
    await q(w, 'sim-form').trigger('submit')
    mocks.overview.mockResolvedValueOnce(baseOverview(900000))
    if (identity === 'token') access.auth.token = 'token-b'
    if (identity === 'member') access.session.memberId = 'member-b'
    if (identity === 'device') access.session.deviceId = 'device-b'
    if (identity === 'account') access.session.owner.accountId = 'account-b'
    if (identity === 'api') access.session.owner.apiBase = '/other/api/v1'
    await flushPromises()
    expect(mocks.overview).toHaveBeenCalledTimes(3)
    expect(q(w, 'members').exists()).toBe(false)
    expect(q(w, 'base-figure').text()).toContain('$9,000.00')
    expect((w.get('#sim-amount').element as HTMLInputElement).value).toBe('')
    expect((w.get('#sim-partner').element as HTMLInputElement).value).toBe('50')
    expect((q(w, 'basis-WORK_SHIFTS').element as HTMLInputElement).checked).toBe(true)
    oldBase.resolve(baseOverview(100000))
    oldResult.resolve(simulationFixture())
    await flushPromises()
    expect(q(w, 'base-figure').text()).toContain('$9,000.00')
    expect(q(w, 'members').exists()).toBe(false)
    w.unmount()
  })

  it('clears the old error on attribution change without fetching while disallowed', async () => {
    const w = await mounted()
    await setAmount(w, '6,000')
    mocks.simulate.mockRejectedValueOnce(http(500))
    await calculate(w)
    expect(useFinanceDistributionStore().error).not.toBe('')
    access.session.memberId = 'member-b'
    access.session.member = { role: 'colaborador' }
    await flushPromises()
    expect(mocks.overview).toHaveBeenCalledTimes(1)
    expect(useFinanceDistributionStore().error).toBe('')
    access.session.member = { role: 'socio' }
    await flushPromises()
    expect(mocks.overview).toHaveBeenCalledTimes(2)
    expect((w.get('#sim-amount').element as HTMLInputElement).value).toBe('')
    w.unmount()
  })

  it('stops showing the screen and wipes the result when access is lost', async () => {
    const w = await mounted()
    await setAmount(w, '6,000')
    await calculate(w)
    expect(q(w, 'members').exists()).toBe(true)
    access.session.member = { role: 'colaborador' }
    await flushPromises()
    expect(w.text()).toContain('Solo socios pueden usar')
    expect(useFinanceDistributionStore().result).toBeNull()
  })
})

describe('financial base (step 2)', () => {
  it('reads the whole month with an exclusive end and shows the available amount with its explanation', async () => {
    const w = await mounted()
    expect(mocks.overview).toHaveBeenCalledTimes(1)
    expect(mocks.overview).toHaveBeenCalledWith(month.from, monthExclusive)
    expect(q(w, 'base-figure').text()).toContain('Monto potencialmente disponible')
    expect(q(w, 'base-figure').text()).toContain('$8,000.00')
    expect(q(w, 'base-note').text()).toBe(
      'Este monto proviene del resultado operativo registrado después de reservas. No representa necesariamente efectivo disponible.',
    )
    expect(q(w, 'base-partial').exists()).toBe(false)
  })

  it('warns when the starting result is partial', async () => {
    mocks.overview.mockResolvedValue(baseOverview(800000, 'partial'))
    const w = await mounted()
    expect(q(w, 'base-partial').text()).toBe(
      'Hay ventas con costos incompletos. Esta simulación parte de un resultado financiero parcial.',
    )
    expect(q(w, 'base-figure').text()).toContain('(parcial)')
  })

  it('shows a loading state, then an error with a manual retry', async () => {
    const pending = deferred<ReturnType<typeof baseOverview>>()
    mocks.overview.mockReturnValueOnce(pending.promise)
    const w = await mounted()
    expect(q(w, 'base-loading').exists()).toBe(true)
    pending.resolve(baseOverview())
    await flushPromises()
    expect(q(w, 'base-loading').exists()).toBe(false)

    mocks.overview.mockRejectedValueOnce(http(500))
    await w.find('.report-range-picker').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('No se pudo consultar el monto disponible')
    expect(q(w, 'base-retry').exists()).toBe(true)
    await q(w, 'base-retry').trigger('click')
    await flushPromises()
    expect(w.text()).not.toContain('No se pudo consultar el monto disponible')
  })

  it('does not offer a retry when the route does not exist yet', async () => {
    mocks.overview.mockRejectedValue(http(404))
    const w = await mounted()
    expect(w.text()).toContain('Esta función aún no está disponible en el servidor')
    expect(q(w, 'base-retry').exists()).toBe(false)
  })
})

describe('amount (step 3)', () => {
  it('starts with Calcular disabled and enables it with a valid amount and rule', async () => {
    const w = await mounted()
    expect(q(w, 'calculate').attributes('disabled')).toBeDefined()
    await setAmount(w, '6,000')
    expect(q(w, 'calculate').attributes('disabled')).toBeUndefined()
    expect(q(w, 'calculate').text()).toBe('Calcular simulación')
  })

  it('shows the maximum and blocks an amount above what is potentially available', async () => {
    const w = await mounted()
    expect(q(w, 'amount-max').text()).toBe('Máximo: $8,000.00')
    await setAmount(w, '8,000.01')
    expect(q(w, 'amount-error').text()).toContain('Máximo: $8,000.00')
    expect(q(w, 'calculate').attributes('disabled')).toBeDefined()
    await setAmount(w, '8,000')
    expect(q(w, 'amount-error').exists()).toBe(false)
    expect(q(w, 'calculate').attributes('disabled')).toBeUndefined()
  })

  it('rejects zero and never turns a negative-looking text into a negative amount', async () => {
    const w = await mounted()
    await setAmount(w, '0')
    expect(q(w, 'amount-error').text()).toContain('mayor que cero')
    await setAmount(w, '-20')
    expect(q(w, 'calculate').attributes('disabled')).toBeUndefined() // "-" is stripped: 20 is a valid amount
    await calculate(w)
    expect(sent().requestedAmountMinor).toBe(2000)
  })

  it('treats a non-positive available amount as a maximum of $0.00', async () => {
    mocks.overview.mockResolvedValue(baseOverview(-5000))
    const w = await mounted()
    expect(q(w, 'amount-max').text()).toBe('Máximo: $0.00')
    expect(q(w, 'base-figure').text()).toContain('-$50.00')
    await setAmount(w, '1')
    expect(q(w, 'calculate').attributes('disabled')).toBeDefined()
  })

  it('maps a 422 EXCEEDS_AVAILABLE even when the UI allowed the amount (server is the authority)', async () => {
    mocks.overview.mockRejectedValue(http(500)) // maximum unknown
    const w = await mounted()
    mocks.simulate.mockRejectedValueOnce(http(422, { code: 'FINANCE_DISTRIBUTION_EXCEEDS_AVAILABLE' }))
    await setAmount(w, '9,000')
    await calculate(w)
    expect(q(w, 'sim-error').text()).toBe('El monto supera lo potencialmente disponible del período.')
    expect(q(w, 'sim-error').attributes('role')).toBe('alert')
    expect(q(w, 'sim-error').text()).not.toMatch(/retir|sacar/i)
  })
})

describe('rule (step 4)', () => {
  it('defaults to 50/50 and sends integer basis points', async () => {
    const w = await mounted()
    await setAmount(w, '6,000')
    expect(q(w, 'rule-total').text()).toBe('Total: 100%')
    await calculate(w)
    expect(sent()).toEqual({
      from: month.from,
      to: monthExclusive,
      requestedAmountMinor: 600000,
      partnerShareBps: 5000,
      workShareBps: 5000,
      workBasis: 'WORK_SHIFTS',
    })
  })

  it.each([
    ['70/30', '70', '30', 7000, 3000],
    ['100/0', '100', '0', 10000, 0],
    ['0/100', '0', '100', 0, 10000],
    ['33/67', '33', '67', 3300, 6700],
  ])('converts %s to basis points', async (_name, partner, work, partnerBps, workBps) => {
    const w = await mounted()
    await setAmount(w, '6,000')
    await setRule(w, partner!, work!)
    await calculate(w)
    expect(sent()).toMatchObject({ partnerShareBps: partnerBps, workShareBps: workBps })
  })

  it('applies the quick presets, marking the active one with aria-pressed', async () => {
    const w = await mounted()
    expect(q(w, 'preset-50-50').attributes('aria-pressed')).toBe('true')
    await q(w, 'preset-60-40').trigger('click')
    expect((w.find('#sim-partner').element as HTMLInputElement).value).toBe('60')
    expect((w.find('#sim-work').element as HTMLInputElement).value).toBe('40')
    expect(q(w, 'preset-60-40').attributes('aria-pressed')).toBe('true')
    expect(q(w, 'preset-50-50').attributes('aria-pressed')).toBe('false')
    for (const id of ['70-30', '100-0', '0-100']) expect(q(w, `preset-${id}`).exists()).toBe(true)
    await q(w, 'preset-0-100').trigger('click')
    expect((w.find('#sim-partner').element as HTMLInputElement).value).toBe('0')
    expect((w.find('#sim-work').element as HTMLInputElement).value).toBe('100')
  })

  it('shows the live total and blocks Calcular when it is not 100', async () => {
    const w = await mounted()
    await setAmount(w, '6,000')
    await setRule(w, '60', '50')
    expect(q(w, 'rule-total').text()).toBe('Total: 110%')
    expect(q(w, 'rule-error').text()).toBe('Los porcentajes deben sumar 100%.')
    expect(q(w, 'rule-error').attributes('role')).toBe('alert')
    expect(q(w, 'calculate').attributes('disabled')).toBeDefined()
    await q(w, 'sim-form').trigger('submit')
    await flushPromises()
    expect(mocks.simulate).not.toHaveBeenCalled()
  })

  it('rejects decimals and keeps the inputs labelled, numeric and described', async () => {
    const w = await mounted()
    await setRule(w, '50.5', '49.5')
    expect(q(w, 'rule-error').text()).toMatch(/enteros/)
    expect(q(w, 'calculate').attributes('disabled')).toBeDefined()
    for (const id of ['sim-partner', 'sim-work']) {
      const input = w.find(`#${id}`)
      expect(input.attributes('inputmode')).toBe('numeric')
      expect(w.find(`label[for="${id}"]`).exists()).toBe(true)
      expect(input.attributes('aria-describedby')).toContain('sim-rule-error')
    }
    expect(w.find('label[for="sim-partner"]').text()).toBe('Parte por ser socio (%)')
    expect(w.find('label[for="sim-work"]').text()).toBe('Parte por trabajo (%)')
  })
})

describe('work basis (step 5)', () => {
  it('offers two radios in a fieldset with legend and their explanations', async () => {
    const w = await mounted()
    expect(w.find('fieldset legend').exists()).toBe(true)
    expect(w.text()).toContain('Cada jornada registrada pesa igual.')
    expect(w.text()).toContain('Se usan únicamente los minutos registrados.')
    expect(w.findAll('input[type="radio"]')).toHaveLength(2)
    expect(w.text()).toContain('Jornadas')
    expect(w.text()).toContain('Horas registradas')
    expect((q(w, 'basis-WORK_SHIFTS').element as HTMLInputElement).checked).toBe(true)
  })

  it('maps the radios to WORK_SHIFTS and KNOWN_MINUTES', async () => {
    const w = await mounted()
    await setAmount(w, '6,000')
    await q(w, 'basis-KNOWN_MINUTES').setValue(true)
    await calculate(w)
    expect(sent().workBasis).toBe('KNOWN_MINUTES')
    await q(w, 'basis-WORK_SHIFTS').setValue(true)
    await calculate(w)
    expect(sent().workBasis).toBe('WORK_SHIFTS')
  })
})

describe('period', () => {
  it('serializes a custom period with an exclusive end across a year boundary', async () => {
    const w = await mounted()
    await setAmount(w, '1')
    const [from, to] = w.findAll('input[type="date"]')
    await from!.setValue('2026-12-01')
    await to!.setValue('2026-12-31')
    expect(q(w, 'period-pending').exists()).toBe(true)
    expect(q(w, 'calculate').attributes('disabled')).toBeDefined()
    await w.find('.report-range-picker').trigger('submit')
    await flushPromises()
    expect(mocks.overview).toHaveBeenLastCalledWith('2026-12-01', '2027-01-01')
    expect(q(w, 'period-pending').exists()).toBe(false)
    await setAmount(w, '10')
    await calculate(w)
    expect(sent()).toMatchObject({ from: '2026-12-01', to: '2027-01-01' })
  })

  it('accepts a future end (a full month) and refuses an inverted range', async () => {
    const w = await mounted()
    const [from, to] = w.findAll('input[type="date"]')
    await from!.setValue('2099-12-01')
    await to!.setValue('2099-12-31')
    expect(w.find('.report-range-picker__error').exists()).toBe(false)
    await to!.setValue('2099-11-01')
    expect(w.find('.report-range-picker__error').text()).toMatch(/posterior/)
  })
})

describe('result', () => {
  async function withResult(over: Partial<DistributionSimulation> = {}, attach = false) {
    mocks.simulate.mockResolvedValue(simulationFixture(over))
    const w = await mounted(attach)
    await setAmount(w, '6,000')
    await calculate(w)
    return w
  }

  it('shows the disclaimer, the pools, the rule, the base and the period from the response', async () => {
    const w = await withResult()
    expect(q(w, 'disclaimer').text()).toBe('Esta es una simulación. No registra pagos, retiros ni movimientos de dinero.')
    expect(q(w, 'fig-requested').text()).toContain('Monto simulado')
    expect(q(w, 'fig-requested').text()).toContain('$6,000.00')
    expect(q(w, 'fig-partner').text()).toContain('Componente socios')
    expect(q(w, 'fig-partner').text()).toContain('$3,000.00')
    expect(q(w, 'fig-work').text()).toContain('Componente trabajo')
    expect(q(w, 'fig-work').text()).toContain('$3,000.00')
    expect(q(w, 'result-rule').text()).toContain('50% por ser socio · 50% por trabajo · Base: Jornadas')
    expect(q(w, 'result-base').text()).toContain('$8,000.00')
    expect(q(w, 'result-base').text()).toContain('$2,000.00')
    expect(q(w, 'result-period').text()).toMatch(/^Período: 01\/10\/2026 al 31\/10\/2026$/)
  })

  it('renders one card per member in response order with the worked-example amounts', async () => {
    const w = await withResult()
    const cards = w.findAll('[data-test="member-card"]')
    expect(cards).toHaveLength(2)
    expect(cards[0]!.find('h4').text()).toBe('Alberto')
    expect(cards[0]!.find('[data-test="partner-amount"]').text()).toBe('$1,500.00')
    expect(cards[0]!.find('[data-test="work-amount"]').text()).toBe('$1,200.00')
    expect(cards[0]!.find('[data-test="member-total"]').text()).toBe('$2,700.00')
    expect(cards[0]!.find('[data-test="work-how"]').text()).toContain('2 de 5 jornadas · 40%')
    expect(cards[1]!.find('h4').text()).toBe('Adid')
    expect(cards[1]!.find('[data-test="member-total"]').text()).toBe('$3,300.00')
    expect(cards[1]!.find('[data-test="work-how"]').text()).toContain('3 de 5 jornadas · 60%')
    expect(q(w, 'distributed-total').text()).toBe('$6,000.00')
    expect(q(w, 'undistributed').exists()).toBe(false)
    expect(cards[0]!.text()).toContain('Socio')
    expect(cards[0]!.text()).toContain('Por ser socio')
    expect(cards[0]!.text()).toContain('Por trabajo')
    expect(cards[0]!.text()).toContain('Total simulado')
    expect(cards[0]!.text()).toContain('Cómo se calculó el trabajo')
  })

  it('shows a socio with no work as Por trabajo $0.00', async () => {
    const w = await withResult({
      members: [
        memberFixture({ workUnits: 0, shiftCount: 0, knownMinutes: 0, workAmountMinor: 0, totalMinor: 150000 }),
        memberFixture({ memberId: ADID_ID, name: 'Adid', partnerAmountMinor: 150000, workUnits: 5, shiftCount: 5, workAmountMinor: 300000, totalMinor: 450000 }),
      ],
    })
    const first = w.findAll('[data-test="member-card"]')[0]!
    expect(first.find('[data-test="work-amount"]').text()).toBe('$0.00')
    expect(first.find('[data-test="work-how"]').text()).toContain('0 de 5 jornadas · 0%')
  })

  it('shows a colaborador with role, $0.00 as partner and the note, plus the inactive badge', async () => {
    const w = await withResult({
      members: [
        memberFixture({ partnerAmountMinor: 300000, workAmountMinor: 0, totalMinor: 300000, shiftCount: 0, workUnits: 0 }),
        memberFixture({
          memberId: 'c1',
          name: 'Carla',
          role: 'colaborador',
          isActive: false,
          partnerEligible: false,
          partnerAmountMinor: 0,
          workUnits: 2,
          shiftCount: 2,
          workAmountMinor: 300000,
          totalMinor: 300000,
        }),
      ],
    })
    const card = w.findAll('[data-test="member-card"]')[1]!
    expect(card.find('[data-test="role-badge"]').text()).toBe('Colaborador')
    expect(card.find('[data-test="inactive-badge"]').text()).toBe('Inactivo')
    expect(card.find('[data-test="partner-amount"]').text()).toBe('$0.00')
    expect(card.find('[data-test="not-partner"]').text()).toBe('No participa como socio')
    expect(card.find('[data-test="work-amount"]').text()).toBe('$3,000.00')
    expect(w.findAll('[data-test="inactive-badge"]')).toHaveLength(1)
  })

  it('explains the hours basis and the shifts without duration', async () => {
    const w = await withResult({
      rule: { partnerShareBps: 5000, workShareBps: 5000, workBasis: 'KNOWN_MINUTES', partnerMode: 'EQUAL' },
      members: [
        memberFixture({ workUnits: 90, knownMinutes: 90, shiftCount: 2, unknownDurationCount: 1 }),
        memberFixture({ memberId: ADID_ID, name: 'Adid', workUnits: 150, knownMinutes: 150, shiftCount: 3, workAmountMinor: 180000, totalMinor: 330000 }),
      ],
      warnings: [{ code: 'WORK_SHIFTS_WITHOUT_DURATION', message: '1 work shift(s)' }],
    })
    const cards = w.findAll('[data-test="member-card"]')
    expect(cards[0]!.find('[data-test="work-how"]').text()).toContain('1 h 30 min de 4 h · 38%')
    expect(cards[0]!.find('[data-test="unknown-duration"]').text()).toBe('1 jornada sin duración registrada')
    expect(cards[1]!.find('[data-test="unknown-duration"]').exists()).toBe(false)
    expect(q(w, 'result-rule').text()).toContain('Base: Horas registradas')
    expect(q(w, 'warnings').text()).toContain('1 jornada sin duración registrada')
  })

  it('puts the partial alert before any amount', async () => {
    const base = simulationFixture()
    const w = await withResult({ financialBase: { ...base.financialBase, status: 'partial' } })
    const alert = q(w, 'partial-alert')
    expect(alert.text()).toContain('Hay ventas con costos incompletos. Esta simulación parte de un resultado financiero parcial.')
    const html = q(w, 'result-section').html()
    expect(html.indexOf('data-test="partial-alert"')).toBeGreaterThan(-1)
    expect(html.indexOf('data-test="partial-alert"')).toBeLessThan(html.indexOf('data-test="fig-requested"'))
    expect(html.indexOf('data-test="disclaimer"')).toBeLessThan(html.indexOf('data-test="fig-requested"'))
  })

  it('does not show the partial alert for a complete result', async () => {
    const w = await withResult()
    expect(q(w, 'partial-alert').exists()).toBe(false)
  })

  it('renders every backend warning as friendly text, deduplicated against the copy already shown', async () => {
    const codes = [
      'SIMULATION_ONLY',
      'NOT_A_PAYMENT_OR_OBLIGATION',
      'OPERATING_RESULT_PARTIAL',
      'MISSING_SALE_COST',
      'PARTNER_ELIGIBILITY_IS_CURRENT_STATE',
      'WORK_SHIFTS_WITHOUT_DURATION',
      'INACTIVE_MEMBER_RECEIVES_WORK_AMOUNT',
      'BRAND_NEW_CODE',
    ]
    const w = await withResult({ warnings: codes.map((code) => ({ code, message: `<b>English ${code}</b>` })) })
    const items = q(w, 'warnings').findAll('li').map((li) => li.text())
    expect(items).toHaveLength(4)
    expect(items.join(' ')).toMatch(/socios activos de hoy/)
    expect(items.join(' ')).toMatch(/persona inactiva/)
    expect(items.join(' ')).toMatch(/no reconocemos/)
    expect(w.text()).not.toContain('English')
    expect(w.find('b').exists()).toBe(false) // never rendered as HTML
    expect(q(w, 'partial-alert').exists()).toBe(true) // OPERATING_RESULT_PARTIAL alone marks the result partial
    expect(w.text().match(/Esta es una simulación/g)).toHaveLength(1)
  })

  it('moves focus to the result heading inside a polite live region', async () => {
    const w = await withResult({}, true)
    expect(q(w, 'result-region').attributes('aria-live')).toBe('polite')
    expect(document.activeElement).toBe(w.find('#sim-result-title').element)
    w.unmount()
  })

  it('notes the part not assigned when the response says so', async () => {
    const w = await withResult({ totals: { distributedMinor: 599999, undistributedMinor: 1 } })
    expect(q(w, 'undistributed').text()).toContain('$0.01')
  })

  it('never recomputes money: it shows exactly what the server answered', async () => {
    const w = await withResult({
      pools: { partnerPoolMinor: 300001, workPoolMinor: 299999 },
      members: [memberFixture({ partnerAmountMinor: 150001, workAmountMinor: 119999, totalMinor: 270000 })],
      totals: { distributedMinor: 270000, undistributedMinor: 330000 },
    })
    expect(q(w, 'fig-partner').text()).toContain('$3,000.01')
    expect(w.find('[data-test="partner-amount"]').text()).toBe('$1,500.01')
    expect(w.find('[data-test="work-amount"]').text()).toBe('$1,199.99')
  })
})

describe('stale result, new simulation and change rule', () => {
  it('keeps the result but labels it as an older configuration after any edit', async () => {
    const w = await mounted()
    await setAmount(w, '6,000')
    await calculate(w)
    expect(q(w, 'stale-note').exists()).toBe(false)
    await setAmount(w, '5,000')
    expect(q(w, 'stale-note').text()).toBe('Resultado de una configuración anterior')
    expect(q(w, 'stale-note').attributes('role')).toBe('status')
    expect(q(w, 'members').exists()).toBe(true)
    expect(q(w, 'calculate').attributes('disabled')).toBeUndefined()
    await setAmount(w, '6,000')
    expect(q(w, 'stale-note').exists()).toBe(false)
    await q(w, 'basis-KNOWN_MINUTES').setValue(true)
    expect(q(w, 'stale-note').exists()).toBe(true)
  })

  it('keeps the stale result visible and enabled to retry even when the rule becomes invalid', async () => {
    const w = await mounted()
    await setAmount(w, '6,000')
    await calculate(w)
    await setRule(w, '60', '60')
    expect(q(w, 'stale-note').exists()).toBe(true)
    expect(q(w, 'members').exists()).toBe(true)
  })

  it('marks a prior result stale after the same request is rejected and clears it on success', async () => {
    const w = await mounted()
    await setAmount(w, '6,000')
    await calculate(w)
    const originalRequest = sent()
    expect(q(w, 'members').exists()).toBe(true)
    expect(q(w, 'stale-note').exists()).toBe(false)
    mocks.simulate.mockRejectedValueOnce(http(422, { code: 'FINANCE_DISTRIBUTION_EXCEEDS_AVAILABLE' }))
    await calculate(w)
    expect(sent()).toEqual(originalRequest)
    expect(q(w, 'sim-error').exists()).toBe(true)
    expect(q(w, 'members').exists()).toBe(true)
    expect(q(w, 'stale-note').exists()).toBe(true)
    await calculate(w)
    expect(q(w, 'sim-error').exists()).toBe(false)
    expect(q(w, 'stale-note').exists()).toBe(false)
    mocks.overview.mockRejectedValueOnce(http(500))
    await w.find('.report-range-picker').trigger('submit')
    await flushPromises()
    expect(q(w, 'stale-note').exists()).toBe(true)
    w.unmount()
  })

  it('keeps the previous result when a new calculation fails', async () => {
    const w = await mounted()
    await setAmount(w, '6,000')
    await calculate(w)
    await setAmount(w, '5,000')
    mocks.simulate.mockRejectedValueOnce(http(500))
    await calculate(w)
    expect(q(w, 'sim-error').text()).toMatch(/No se guardó nada/)
    expect(q(w, 'members').exists()).toBe(true)
    expect(q(w, 'stale-note').exists()).toBe(true)
  })

  it('"Nueva simulación" clears the result and resets every input', async () => {
    const w = await mounted(true)
    await setAmount(w, '6,000')
    await setRule(w, '70', '30')
    await q(w, 'basis-KNOWN_MINUTES').setValue(true)
    await calculate(w)
    await q(w, 'new-simulation').trigger('click')
    await flushPromises()
    expect(q(w, 'members').exists()).toBe(false)
    expect(q(w, 'no-result').exists()).toBe(true)
    expect((w.find('#sim-amount').element as HTMLInputElement).value).toBe('')
    expect((w.find('#sim-partner').element as HTMLInputElement).value).toBe('50')
    expect((q(w, 'basis-WORK_SHIFTS').element as HTMLInputElement).checked).toBe(true)
    expect(document.activeElement).toBe(w.find('#sim-amount').element)
    expect(useFinanceDistributionStore().result).toBeNull()
    w.unmount()
  })

  it('"Cambiar regla" keeps the result and focuses the rule', async () => {
    const w = await mounted(true)
    await setAmount(w, '6,000')
    await calculate(w)
    await q(w, 'change-rule').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(w.find('#sim-partner').element)
    expect(q(w, 'members').exists()).toBe(true)
    w.unmount()
  })

  it('restores the inputs that produced a result still in memory, without calling it stale', async () => {
    const first = await mounted()
    await setAmount(first, '6,000')
    await setRule(first, '70', '30')
    mocks.simulate.mockResolvedValue(
      simulationFixture({ rule: { partnerShareBps: 7000, workShareBps: 3000, workBasis: 'WORK_SHIFTS', partnerMode: 'EQUAL' } }),
    )
    await calculate(first)
    first.unmount()
    const again = await mounted()
    expect((again.find('#sim-partner').element as HTMLInputElement).value).toBe('70')
    expect((again.find('#sim-amount').element as HTMLInputElement).value).toBe('6000.00')
    expect(q(again, 'members').exists()).toBe(true)
    expect(q(again, 'stale-note').exists()).toBe(false)
  })

  it('forgets the result when the session store is reset', async () => {
    const w = await mounted()
    await setAmount(w, '6,000')
    await calculate(w)
    useFinanceDistributionStore().reset()
    await flushPromises()
    expect(q(w, 'members').exists()).toBe(false)
    expect(q(w, 'no-result').exists()).toBe(true)
  })
})

describe('errors and submit control', () => {
  it.each([
    [403, {}, 'Solo socios pueden usar el simulador de reparto en Gestión.'],
    [401, {}, 'Solo socios pueden usar el simulador de reparto en Gestión.'],
    [400, { message: ['requestedAmountMinor must not be less than 1'] }, 'Revisa los datos de la simulación.'],
    [422, { code: 'FINANCE_DISTRIBUTION_NO_PARTNERS' }, 'No hay socios activos para repartir el componente de socios.'],
    [422, { code: 'FINANCE_DISTRIBUTION_NO_WORK', message: 'No active work shifts are registered in the period' }, 'No hay trabajo registrado en este período para repartir el componente de trabajo. Cambia la regla o el período.'],
    [422, { code: 'FINANCE_OVERVIEW_OVERFLOW' }, 'Los montos de este periodo son demasiado grandes'],
  ])('shows a friendly text for HTTP %i', async (status, data, expected) => {
    const w = await mounted()
    mocks.simulate.mockRejectedValueOnce(http(status, data))
    await setAmount(w, '6,000')
    await calculate(w)
    expect(q(w, 'sim-error').text()).toContain(expected)
    expect(q(w, 'members').exists()).toBe(false)
  })

  it('explains hours with no duration only for the hours basis', async () => {
    const w = await mounted()
    mocks.simulate.mockRejectedValueOnce(
      http(422, { code: 'FINANCE_DISTRIBUTION_NO_WORK', message: 'All shifts of the period lack a known duration, so KNOWN_MINUTES has no work to weigh' }),
    )
    await setAmount(w, '6,000')
    await q(w, 'basis-KNOWN_MINUTES').setValue(true)
    await calculate(w)
    expect(q(w, 'sim-error').text()).toBe('Hay jornadas, pero ninguna tiene duración registrada. Prueba con la base por jornadas.')
  })

  it('keeps a network failure calm, never implies saving, and lets the person retry manually', async () => {
    const w = await mounted()
    mocks.simulate.mockRejectedValueOnce(new Error('Network Error'))
    await setAmount(w, '6,000')
    await calculate(w)
    expect(mocks.simulate).toHaveBeenCalledTimes(1) // no automatic retry
    expect(q(w, 'sim-error').text()).toMatch(/No se guardó nada/)
    expect(q(w, 'calculate').attributes('disabled')).toBeUndefined()
    await calculate(w)
    expect(mocks.simulate).toHaveBeenCalledTimes(2)
    expect(q(w, 'sim-error').exists()).toBe(false)
  })

  it('sends one request on a double submit', async () => {
    const pending = deferred<DistributionSimulation>()
    mocks.simulate.mockReturnValueOnce(pending.promise)
    const w = await mounted()
    await setAmount(w, '6,000')
    await q(w, 'sim-form').trigger('submit')
    await q(w, 'sim-form').trigger('submit')
    await q(w, 'calculate').trigger('click')
    expect(mocks.simulate).toHaveBeenCalledTimes(1)
    expect(q(w, 'calculate').attributes('disabled')).toBeDefined()
    pending.resolve(simulationFixture())
    await flushPromises()
    expect(q(w, 'members').exists()).toBe(true)
  })

  it('never lets a slow response overwrite a newer one', async () => {
    const slow = deferred<DistributionSimulation>()
    mocks.simulate.mockReturnValueOnce(slow.promise)
    const w = await mounted()
    await setAmount(w, '6,000')
    await q(w, 'sim-form').trigger('submit')
    useFinanceDistributionStore().clearResult() // "Nueva simulación" while in flight
    slow.resolve(simulationFixture())
    await flushPromises()
    expect(q(w, 'members').exists()).toBe(false)
  })
})

describe('content rules and layout', () => {
  it('uses cards, never a table, and none of the forbidden wording', async () => {
    const w = await mounted()
    await setAmount(w, '6,000')
    await calculate(w)
    expect(w.find('table').exists()).toBe(false)
    expect(w.findAll('li[data-test="member-card"]').length).toBeGreaterThan(0)
    const text = w.text().toLowerCase()
    for (const forbidden of ['repartir dinero', 'pagar', 'confirmar reparto', 'ganancia para repartir']) {
      expect(text).not.toContain(forbidden)
    }
    const source = readFileSync(resolve(__dirname, '../SimulatorView.vue'), 'utf8').toLowerCase()
    for (const forbidden of ['repartir dinero', 'pagar', 'confirmar reparto', 'ganancia para repartir']) {
      expect(source).not.toContain(forbidden)
    }
  })

  it('splits into two columns only from 1024px (jsdom has no layout, so the stylesheet is asserted)', () => {
    const source = readFileSync(resolve(__dirname, '../SimulatorView.vue'), 'utf8')
    expect(source).toMatch(/@media \(min-width: 1024px\)/)
    expect(source).not.toMatch(/min-width: 768px/)
    expect(source).toMatch(/grid-template-columns: minmax\(0, 5fr\) minmax\(0, 6fr\)/)
  })

  it('adds no device warning of its own and persists nothing', () => {
    const files = ['../SimulatorView.vue', '../components/SimulatorRuleForm.vue', '../components/SimulatorMemberResult.vue']
    for (const file of files) {
      const source = readFileSync(resolve(__dirname, file), 'utf8')
      expect(source).not.toMatch(/laptop|computadora|localStorage|sessionStorage|indexedDB/i)
    }
  })

  it('wires ids to labels and describes the amount maximum', async () => {
    const w = await mounted()
    expect(w.find('label[for="sim-amount"]').text()).toBe('Monto a simular')
    expect(w.find('#sim-amount-hint').text()).toBe('Máximo: $8,000.00')
    expect(w.get('#sim-amount').attributes('aria-describedby')).toBe('sim-amount-hint')
    await setAmount(w, '100,50')
    expect(w.get('#sim-amount').attributes('aria-describedby')).toBe('sim-amount-hint sim-amount-error')
    useFinanceDistributionStore().reset()
    await flushPromises()
    expect(w.find('#sim-amount-hint').exists()).toBe(false)
    expect(w.get('#sim-amount').attributes('aria-describedby')).toBe('sim-amount-error')
    await setAmount(w, '')
    expect(w.get('#sim-amount').attributes('aria-describedby')).toBeUndefined()
    expect(w.find('fieldset').exists()).toBe(true)
  })

})

describe('agreement-ready freshness boundary', () => {
  it('marks pending and invalid dates stale before applying them', async () => {
    const w = await mounted()
    await setAmount(w, '6,000')
    await calculate(w)
    const picker = w.findComponent({ name: 'ReportRangePicker' })
    picker.vm.$emit('update:from', addDaysToKey(month.from, 1))
    await flushPromises()
    expect(q(w, 'period-pending').exists()).toBe(true)
    expect(q(w, 'stale-note').exists()).toBe(true)
    picker.vm.$emit('update:from', '')
    await flushPromises()
    expect(q(w, 'stale-note').exists()).toBe(true)
    w.unmount()
  })

  it('keeps a failed retry stale across remount and a successful base refresh', async () => {
    const first = await mounted()
    await setAmount(first, '6,000')
    await calculate(first)
    mocks.simulate.mockRejectedValueOnce(http(500))
    await calculate(first)
    first.unmount()
    const again = await mounted()
    expect(q(again, 'stale-note').exists()).toBe(true)
    await calculate(again)
    expect(q(again, 'stale-note').exists()).toBe(false)
    again.unmount()
  })

  it('explains offline blocking without losing the result or creating a pending attempt and requires fresh calculation after reconnect', async () => {
    const w = await mounted()
    try {
      await setAmount(w, '6,000')
      await calculate(w)
      const original = useFinanceDistributionStore().result
      window.dispatchEvent(new Event('offline'))
      await flushPromises()
      expect(q(w, 'offline-note').text()).toBe('Necesitas conexión para calcular una simulación y crear un acuerdo. Vuelve a conectarte e inténtalo de nuevo.')
      expect(q(w, 'offline-note').attributes('role')).toBe('status')
      expect(q(w, 'calculate').attributes('disabled')).toBeDefined()
      expect(q(w, 'create-agreement').attributes('disabled')).toBeDefined()
      expect(q(w, 'stale-note').exists()).toBe(true)
      await calculate(w)
      await q(w, 'create-agreement').trigger('click')
      expect(mocks.simulate).toHaveBeenCalledTimes(1)
      expect(mocks.create).not.toHaveBeenCalled()
      expect(useFinanceAgreementsStore().pendingCreate).toBeNull()
      expect(useFinanceAgreementsStore().created).toBeNull()
      expect(useFinanceDistributionStore().result).toEqual(original)
      window.dispatchEvent(new Event('online'))
      await flushPromises()
      expect(q(w, 'offline-note').exists()).toBe(false)
      expect(q(w, 'calculate').attributes('disabled')).toBeUndefined()
      expect(q(w, 'create-agreement').attributes('disabled')).toBeDefined()
      expect(q(w, 'stale-note').exists()).toBe(true)
      expect(mocks.create).not.toHaveBeenCalled()
      await calculate(w)
      expect(q(w, 'stale-note').exists()).toBe(false)
      expect(q(w, 'create-agreement').attributes('disabled')).toBeUndefined()
      expect(mocks.simulate).toHaveBeenCalledTimes(2)
      expect(mocks.create).not.toHaveBeenCalled()
    } finally { w.unmount() }
  })

  it('blocks an initial navigator offline state without submitting', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const w = await mounted()
    expect(q(w, 'offline-note').text()).toContain('Necesitas conexión')
    await setAmount(w, '6,000')
    await calculate(w)
    expect(mocks.simulate).not.toHaveBeenCalled()
    expect(q(w, 'calculate').attributes('disabled')).toBeDefined()
    w.unmount()
    online.mockRestore()
  })
})

describe('refreshed result freshness', () => {
  it('blocks a displayed result during recalculation and financial refresh, then invalidates changed status', async () => {
    const w = await mounted()
    await setAmount(w, '6,000')
    await calculate(w)
    const pendingSim = deferred<DistributionSimulation>()
    mocks.simulate.mockReturnValueOnce(pendingSim.promise)
    await q(w, 'sim-form').trigger('submit')
    expect(q(w, 'stale-note').exists()).toBe(true)
    pendingSim.resolve(simulationFixture())
    await flushPromises()
    expect(q(w, 'stale-note').exists()).toBe(false)
    const pendingBase = deferred<ReturnType<typeof overviewFixture>>()
    mocks.overview.mockReturnValueOnce(pendingBase.promise)
    await w.find('.report-range-picker').trigger('submit')
    expect(q(w, 'calculate').attributes('disabled')).toBeDefined()
    expect(q(w, 'stale-note').exists()).toBe(true)
    pendingBase.resolve(baseOverview())
    await flushPromises()
    expect(q(w, 'stale-note').exists()).toBe(false)
    mocks.overview.mockResolvedValueOnce(baseOverview(800000, 'partial'))
    await w.find('.report-range-picker').trigger('submit')
    await flushPromises()
    expect(q(w, 'stale-note').exists()).toBe(true)
    mocks.simulate.mockResolvedValueOnce(simulationFixture({
      financialBase: { ...simulationFixture().financialBase, status: 'partial' },
    }))
    await calculate(w)
    expect(q(w, 'stale-note').exists()).toBe(false)
    w.unmount()
  })
})


describe('agreement creation readiness', () => {
  it('offers creation only after a valid current simulation and disables it for pending dates', async () => {
    const w = await mounted()
    expect(q(w, 'create-agreement').exists()).toBe(false)
    await setAmount(w, '6,000')
    await calculate(w)
    expect(q(w, 'create-agreement').attributes('disabled')).toBeUndefined()
    w.findComponent({ name: 'ReportRangePicker' }).vm.$emit('update:from', addDaysToKey(month.from, 1))
    await flushPromises()
    expect(q(w, 'create-agreement').attributes('disabled')).toBeDefined()
    w.unmount()
  })
})


describe('agreement commitment notice', () => {
  const openForm = async (w: Wrapper) => {
    await setAmount(w, '6,000')
    await calculate(w)
    await q(w, 'create-agreement').trigger('click')
    await flushPromises()
    return w.findComponent(AgreementCreateForm)
  }

  it('al abrir la confirmación consulta lo comprometido del período de ESA simulación y se lo pasa al formulario', async () => {
    const w = await mounted(true)
    const form = await openForm(w)

    expect(mocks.commitment).toHaveBeenCalledTimes(1)
    expect(mocks.commitment.mock.calls[0][1]).toEqual({ from: form.props('request')!.from, to: form.props('request')!.to })
    expect(form.props('commitment')).toMatchObject({ availableMinor: 800000, freeMinor: 800000 })
    expect(document.body.querySelector('.commitment-summary')).not.toBeNull()
    w.unmount()
  })

  it('si lo libre no alcanza, el formulario deshabilita crear y explica por qué', async () => {
    mocks.commitment.mockImplementation(async (_origin: unknown, range: { from: string; to: string }) =>
      ({ ...range, availableMinor: 800000, committedMinor: 500000, freeMinor: 300000, agreementCount: 1 }))
    const w = await mounted(true)
    await openForm(w)
    await new DOMWrapper(document.body.querySelector('#agreement-title')!).setValue('Octubre')

    expect(document.body.querySelector('[data-test="commitment-block"]')!.textContent).toContain('Faltan $3,000.00.')
    expect(document.body.querySelector('[data-test="confirm-agreement"]')!.hasAttribute('disabled')).toBe(true)
    w.unmount()
  })

  it('si la consulta falla, no estorba: se puede crear y el servidor decide', async () => {
    mocks.commitment.mockRejectedValue(http(500))
    const w = await mounted(true)
    const form = await openForm(w)
    await new DOMWrapper(document.body.querySelector('#agreement-title')!).setValue('Octubre')

    expect(form.props('commitment')).toBeNull()
    expect(form.props('commitmentError')).toContain('No pudimos consultar')
    expect(document.body.querySelector('[data-test="confirm-agreement"]')!.hasAttribute('disabled')).toBe(false)
    w.unmount()
  })

  it('si el servidor rechaza por no alcanzar, muestra su mensaje en español y no queda un intento pendiente', async () => {
    const message = 'No alcanza el disponible del período: hay $8,000.00 disponibles.'
    mocks.create.mockRejectedValueOnce(http(422, { code: 'FINANCE_AGREEMENT_EXCEEDS_UNCOMMITTED', message }))
    const w = await mounted()
    const form = await openForm(w)

    form.vm.$emit('create', { ...sent(), title: 'October agreement', simulationFingerprint: simulationFixture().simulationFingerprint })
    await flushPromises()

    expect(form.props('error')).toBe(message)
    expect(form.props('pending')).toBeNull()
    w.unmount()
  })
})

describe('agreement confirmation integration', () => {
  it('closes without a write and only submits reviewed fields after explicit confirmation', async () => {
    const w = await mounted()
    await setAmount(w, '6,000')
    await calculate(w)
    await q(w, 'create-agreement').trigger('click')
    const form = w.findComponent(AgreementCreateForm)
    expect(form.props('eligible')).toBe(true)
    expect(mocks.create).not.toHaveBeenCalled()
    form.vm.$emit('update:modelValue', false)
    await flushPromises()
    expect(form.props('modelValue')).toBe(false)
    await q(w, 'create-agreement').trigger('click')
    form.vm.$emit('create', { ...sent(), title: 'October agreement', note: '', simulationFingerprint: simulationFixture().simulationFingerprint })
    await flushPromises()
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(useFinanceAgreementsStore().created?.folio).toBe('AC-2026-00001')
    w.unmount()
  })
  it('invalidates displayed simulation on drift and only restores confirmation after recalculation', async () => {
    const w = await mounted()
    await setAmount(w, '6,000')
    await calculate(w)
    await q(w, 'create-agreement').trigger('click')
    const form = w.findComponent(AgreementCreateForm)
    mocks.create.mockRejectedValueOnce(http(409, { code: 'FINANCE_AGREEMENT_SIMULATION_CHANGED' }))
    form.vm.$emit('create', { ...sent(), title: 'October agreement', simulationFingerprint: simulationFixture().simulationFingerprint })
    await flushPromises()
    expect(form.props('error')).toContain('Los datos cambiaron. Calcula una nueva simulación')
    expect(form.props('eligible')).toBe(false)
    expect(q(w, 'stale-note').exists()).toBe(true)
    form.vm.$emit('update:modelValue', false)
    await flushPromises()
    await calculate(w)
    expect(useFinanceAgreementsStore().simulationChanged).toBe(false)
    expect(q(w, 'create-agreement').attributes('disabled')).toBeUndefined()
    w.unmount()
  })
  it('retries an uncertain original body rather than creating a changed draft', async () => {
    const w = await mounted()
    await setAmount(w, '6,000')
    await calculate(w)
    await q(w, 'create-agreement').trigger('click')
    const form = w.findComponent(AgreementCreateForm)
    mocks.create.mockRejectedValueOnce(new Error('lost'))
    form.vm.$emit('create', { ...sent(), title: 'Original title', simulationFingerprint: simulationFixture().simulationFingerprint })
    await flushPromises()
    const original = mocks.create.mock.calls[0]
    form.vm.$emit('update:modelValue', false)
    await flushPromises()
    await setAmount(w, '5,000')
    expect(q(w, 'create-agreement').exists()).toBe(false)
    await q(w, 'recover-agreement').trigger('click')
    expect(form.props('pending')?.title).toBe('Original title')
    form.vm.$emit('retry')
    await flushPromises()
    expect(mocks.create.mock.calls[1]).toEqual(original)
    w.unmount()
  })
  it('closes confirmation and ignores its pending success when attribution changes', async () => {
    const w = await mounted()
    await setAmount(w, '6,000')
    await calculate(w)
    await q(w, 'create-agreement').trigger('click')
    const form = w.findComponent(AgreementCreateForm)
    const pending = deferred<ReturnType<typeof agreementFixture>>()
    mocks.create.mockReturnValueOnce(pending.promise)
    form.vm.$emit('create', { ...sent(), title: 'Original title', simulationFingerprint: simulationFixture().simulationFingerprint })
    await flushPromises()
    access.session.memberId = 'another-member'
    await flushPromises()
    expect(form.props('modelValue')).toBe(false)
    pending.resolve(agreementFixture())
    await flushPromises()
    expect(useFinanceAgreementsStore().created).toBeNull()
    w.unmount()
  })
  it('blocks creation and retry when offline or the selected socio is inactive', async () => {
    const w = await mounted()
    await setAmount(w, '6,000')
    await calculate(w)
    window.dispatchEvent(new Event('offline'))
    await flushPromises()
    expect(q(w, 'create-agreement').attributes('disabled')).toBeDefined()
    window.dispatchEvent(new Event('online'))
    await flushPromises()
    await calculate(w)
    access.session.member!.active = false
    await flushPromises()
    expect(q(w, 'create-agreement').attributes('disabled')).toBeDefined()
    expect(mocks.create).not.toHaveBeenCalled()
    w.unmount()
  })
})


describe('uncertain attempt survives UI-only navigation changes', () => {
  it('preserves the original request through leaving and returning to Gestion mode', async () => {
    const w = await mounted()
    await setAmount(w, '6,000')
    await calculate(w)
    await q(w, 'create-agreement').trigger('click')
    const form = w.findComponent(AgreementCreateForm)
    mocks.create.mockRejectedValueOnce(new Error('lost'))
    form.vm.$emit('create', { ...sent(), title: 'Original title', simulationFingerprint: simulationFixture().simulationFingerprint })
    await flushPromises()
    const first = mocks.create.mock.calls[0]
    access.mode.currentMode = 'venta'
    await flushPromises()
    expect(useFinanceAgreementsStore().pendingCreate).not.toBeNull()
    access.mode.currentMode = 'gestion'
    await flushPromises()
    await q(w, 'recover-agreement').trigger('click')
    w.findComponent(AgreementCreateForm).vm.$emit('retry')
    await flushPromises()
    expect(mocks.create.mock.calls[1]).toEqual(first)
    w.unmount()
  })
})

describe('replacement confirmation', () => {
  it('validates the voided target, requires a new simulation and submits only its authoritative id', async () => {
    const target = agreementFixture({ status: 'voided' })
    route.query = { replacesAgreementId: target.id }
    mocks.get.mockResolvedValue(target)
    const w = await mounted()
    expect(q(w, 'replacement-target').text()).toContain(target.folio)
    expect(q(w, 'replacement-target').text()).toContain('nueva simulación')
    await setAmount(w, '6000'); await calculate(w)
    await q(w, 'create-agreement').trigger('click'); await flushPromises()
    const form = w.findComponent(AgreementCreateForm)
    expect(form.props('replacement')).toEqual({ id: target.id, folio: target.folio })
    form.vm.$emit('create', { ...sent(), title: 'Replacement', simulationFingerprint: simulationFixture().simulationFingerprint })
    await flushPromises()
    expect(mocks.create.mock.calls[0]?.[1].replacesAgreementId).toBe(target.id)
    w.unmount()
  })
  it.each(['not-a-uuid', agreementFixture().id])('never silently creates against an invalid or active target %s', async id => {
    route.query = { replacesAgreementId: id }; mocks.get.mockResolvedValue(agreementFixture())
    const w = await mounted()
    await setAmount(w, '6000'); await calculate(w)
    expect(q(w, 'replacement-error').exists()).toBe(true)
    expect(q(w, 'create-agreement').attributes('disabled')).toBeDefined()
    expect(mocks.create).not.toHaveBeenCalled()
    if (id === 'not-a-uuid') expect(mocks.get).not.toHaveBeenCalled()
    w.unmount()
  })
})

it('rejects an already-replaced target and shows backend replacement rejection without retrying a new write', async () => {
  const target = agreementFixture({ status: 'voided', replacedBy: { id: agreementFixture().id, folio: 'AC-2026-00002' } })
  route.query = { replacesAgreementId: target.id }; mocks.get.mockResolvedValueOnce(target)
  const w = await mounted()
  expect(q(w, 'replacement-error').text()).toContain('no tenga sustituto')
  mocks.get.mockResolvedValueOnce(agreementFixture({ status: 'voided' }))
  await q(w, 'replacement-error').find('button').trigger('click'); await flushPromises()
  await setAmount(w, '6000'); await calculate(w)
  await q(w, 'create-agreement').trigger('click'); await flushPromises()
  mocks.create.mockRejectedValueOnce(http(422, { code: 'FINANCE_AGREEMENT_REPLACEMENT_INVALID' }))
  w.findComponent(AgreementCreateForm).vm.$emit('create', { ...sent(), title: 'Replacement', simulationFingerprint: simulationFixture().simulationFingerprint })
  await flushPromises()
  expect(useFinanceAgreementsStore().saveError).toContain('no tenga reemplazo')
  expect(useFinanceAgreementsStore().pendingCreate).toBeNull()
  expect(mocks.create).toHaveBeenCalledTimes(1)
  w.unmount()
})

it('closes substitution confirmation on target changes and rejects a late forced confirmation', async () => {
  const target = agreementFixture({ status: 'voided' })
  route.query = { replacesAgreementId: target.id }; mocks.get.mockResolvedValue(target)
  const w = await mounted()
  await setAmount(w, '6000'); await calculate(w)
  await q(w, 'create-agreement').trigger('click'); await flushPromises()
  route.query = { replacesAgreementId: 'invalid-target' }; await flushPromises()
  expect(w.findComponent(AgreementCreateForm).props('modelValue')).toBe(false)
  w.findComponent(AgreementCreateForm).vm.$emit('create', { ...sent(), title: 'Replacement', simulationFingerprint: simulationFixture().simulationFingerprint })
  await flushPromises()
  expect(mocks.create).not.toHaveBeenCalled()
  w.unmount()
})

it('exports the confirmed created agreement only and never the displayed simulation', async () => {
  const w = await mounted()
  await setAmount(w, '6000'); await calculate(w)
  await q(w, 'create-agreement').trigger('click'); await flushPromises()
  const form = w.findComponent(AgreementCreateForm)
  form.vm.$emit('create', { ...sent(), title: 'Created', simulationFingerprint: simulationFixture().simulationFingerprint }); await flushPromises()
  const store = useFinanceAgreementsStore(), exportPdf = vi.spyOn(store, 'exportPdf').mockResolvedValue(true)
  form.vm.$emit('pdf'); await flushPromises()
  expect(exportPdf).toHaveBeenCalledWith(agreementFixture().id, expect.any(Function))
  expect(mocks.simulate).toHaveBeenCalledTimes(1)
  access.auth.token = ''; await flushPromises(); form.vm.$emit('pdf'); await flushPromises()
  expect(exportPdf).toHaveBeenCalledTimes(1)
  w.unmount()
})

it('cancels PDF delivery after the simulator unmounts even if the selected session remains valid', async () => {
  const w = await mounted()
  await setAmount(w, '6000'); await calculate(w)
  await q(w, 'create-agreement').trigger('click'); await flushPromises()
  const form = w.findComponent(AgreementCreateForm)
  form.vm.$emit('create', { ...sent(), title: 'Created', simulationFingerprint: simulationFixture().simulationFingerprint }); await flushPromises()
  const store = useFinanceAgreementsStore(), exportPdf = vi.spyOn(store, 'exportPdf').mockResolvedValue(true)
  form.vm.$emit('pdf'); await flushPromises()
  const canDeliver = exportPdf.mock.calls[0]![1]!
  expect(canDeliver()).toBe(true)
  w.unmount()
  expect(canDeliver()).toBe(false)
})
