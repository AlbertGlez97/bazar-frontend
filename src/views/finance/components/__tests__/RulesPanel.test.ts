import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RulesPanel from '../RulesPanel.vue'
import { defaultRulesConfig } from '@/utils/finance-rules'
import { ANA, BETO, RULE_SET_ID, overviewFixture, ruleSet } from '@/services/__tests__/finance-rules.fixture'
import type { RulesOverview } from '@/types/finance-rules.types'

const mocks = vi.hoisted(() => ({
  overview: vi.fn(), saveDraft: vi.fn(), discard: vi.fn(), submit: vi.fn(), withdraw: vi.fn(), approve: vi.fn(), remind: vi.fn(),
}))
vi.mock('@/services/finance-rules.service', () => ({ FinanceRulesService: mocks }))
vi.mock('@/stores/auth.store', () => ({ useAuthStore: () => ({ token: 't' }) }))
vi.mock('@/stores/session.store', () => ({ useSessionStore: () => ({ member: { role: 'socio', active: true } }) }))
vi.mock('@/services/queue-origin', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  currentQueueOrigin: () => ({ accountId: 'a', memberId: 'm', deviceId: 'd', apiBase: '/api/v1' }),
}))

const pendingSet = (over = {}) => ruleSet({
  status: 'pendiente', submittedAt: '2026-10-20T16:00:00.000Z', proposedBy: BETO,
  approvals: [{ ...BETO, approvedAt: '2026-10-20T16:05:00.000Z', origin: { kind: 'own_account' as const, accountCreatedAt: '2026-09-01T12:00:00.000Z' } }],
  missing: [ANA], ...over,
})
const pendingOverview = (over: Partial<RulesOverview> = {}) => {
  const pending = pendingSet()
  return overviewFixture({ state: 'pendiente', pending, history: [pending], ...over })
}
const show = async (overview: RulesOverview) => {
  mocks.overview.mockResolvedValue(overview)
  const w = mount(RulesPanel)
  await flushPromises()
  return w
}
const click = async (w: Awaited<ReturnType<typeof show>>, test: string) => {
  await w.get(`[data-test="${test}"]`).trigger('click')
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

describe('RulesPanel: lo que se ve primero', () => {
  it('lleva el engrane, explica por qué configurar primero y dice que no es asesoría', async () => {
    const w = await show(overviewFixture())

    expect(w.get('h2').text()).toBe('Reglas de reparto')
    expect(w.find('h2 svg, header svg').exists()).toBe(true)
    const intro = w.get('[data-test="rules-intro"]').text()
    expect(intro).toContain('Configura estas reglas antes de repartir')
    expect(intro).toContain('Cada socio debe aprobarlas')
    expect(intro).toContain('nueva aprobación de todos')
    expect(w.text()).toContain('No es asesoría contable ni legal')
    expect(w.text()).toContain('contador')
  })

  it('mientras consulta lo dice', async () => {
    mocks.overview.mockReturnValue(new Promise(() => undefined))
    const w = mount(RulesPanel)
    await flushPromises()
    expect(w.get('[role="status"]').text()).toContain('Consultando')
  })

  it('si falla, lo explica y deja reintentar', async () => {
    mocks.overview.mockRejectedValueOnce({ response: { status: 403 } })
    const w = mount(RulesPanel)
    await flushPromises()
    expect(w.get('[data-test="rules-error"]').text()).toContain('Solo las personas socias')

    mocks.overview.mockResolvedValue(overviewFixture())
    await w.get('[data-test="rules-error"] button').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="rules-error"]').exists()).toBe(false)
  })
})

describe('RulesPanel: estado visible', () => {
  it('Sin aprobar', async () => {
    const w = await show(overviewFixture())
    const state = w.get('[data-test="rules-state"]').text()
    expect(state).toContain('Sin aprobar')
    expect(state).toContain('Todavía no hay reglas de reparto aprobadas')
    expect(w.get('[data-test="rules-start"]').text()).toBe('Configurar las reglas')
  })

  it('Pendiente nombra a quien falta', async () => {
    const w = await show(pendingOverview())
    expect(w.get('[data-test="rules-state"]').text()).toContain('Pendiente')
    expect(w.get('[data-test="rules-state"]').text()).toContain('Falta por aprobar: Ana.')
    expect(w.get('[data-test="rules-pending"]').text()).toContain('siguen las reglas anteriores')
  })

  it('Vigentes muestra la versión y la fecha, y las reglas en frases', async () => {
    const inForce = ruleSet({ status: 'vigente', version: 2, activatedAt: '2026-10-20T18:30:00.000Z' })
    const w = await show(overviewFixture({ state: 'vigente', inForce, history: [inForce] }))

    expect(w.get('[data-test="rules-state"]').text()).toContain('Vigentes')
    expect(w.get('[data-test="rules-state"]').text()).toContain('Versión 2, desde el 20/10/2026.')
    expect(w.get('[data-test="rules-inforce"]').text()).toContain('Utilidad: 100 % por ser socio')
    expect(w.get('[data-test="rules-start"]').text()).toBe('Proponer cambios')
  })

  it('el historial muestra quién aprobó y cuándo', async () => {
    const w = await show(pendingOverview())
    const history = w.get('[data-test="rules-history"]').text()
    expect(history).toContain('Versión 1')
    expect(history).toContain('Beto aprobó el 20/10/2026, 10:05.')
    expect(history).toContain('Ana todavía no aprueba.')
  })

  it('el historial dice cómo se creó la cuenta de cada persona que aprobó', async () => {
    const invited = { kind: 'invited' as const, invitedByMemberId: ANA.memberId, invitedByName: 'Ana', invitedAt: '2026-10-18T16:00:00.000Z', acceptedAt: '2026-10-18T16:30:00.000Z', recent: true }
    const set = ruleSet({
      status: 'vigente', version: 3, activatedAt: '2026-10-20T18:30:00.000Z',
      approvals: [
        { ...ANA, approvedAt: '2026-10-20T18:00:00.000Z', origin: { kind: 'shared_single_partner' } },
        { ...BETO, approvedAt: '2026-10-20T18:30:00.000Z', origin: invited },
        { memberId: 'x', name: 'Carla', approvedAt: '2026-10-20T18:31:00.000Z', origin: null },
      ],
    })
    const w = await show(overviewFixture({ state: 'vigente', inForce: set, history: [set] }))
    const history = w.get('[data-test="rules-history"]').text()

    expect(history).toContain('Acceso compartido de un solo socio.')
    expect(history).toContain('Cuenta creada por invitación de Ana el 18/10/2026, 10:00.')
    expect(history).toContain('Sin dato de cómo se creó la cuenta.')
  })
})

describe('RulesPanel: aviso de quién aprobó con una cuenta invitada hace poco', () => {
  type Recent = { memberId: string; name: string; invitedByName: string | null; acceptedAt: string; fromSharedLogin?: boolean }
  const vigente = (list: Recent[]) => {
    const recent = list.map((r) => ({ fromSharedLogin: false, ...r }))
    const set = ruleSet({ status: 'vigente', activatedAt: '2026-10-20T18:30:00.000Z', recentInvitedApprovers: recent })
    return overviewFixture({ state: 'vigente', inForce: set, history: [set] })
  }

  it('cuando las reglas pasan a vigentes, nombra a quien aprobó con una cuenta invitada hace poco y quién lo invitó', async () => {
    const w = await show(vigente([{ ...BETO, invitedByName: 'Ana', acceptedAt: '2026-10-18T16:30:00.000Z' }]))
    const notice = w.get('[data-test="rules-recent-invite"]')
    expect(notice.text()).toBe('Beto aprobó con una cuenta invitada por Ana el 18/10/2026.')
    expect(w.get('[data-test="rules-inforce"]').element.contains(notice.element)).toBe(true)
  })

  it('quien aprobó con una cuenta creada desde el acceso compartido se avisa aunque haya pasado mucho tiempo', async () => {
    const w = await show(vigente([{ ...BETO, invitedByName: null, acceptedAt: '2025-01-02T16:30:00.000Z', fromSharedLogin: true }]))
    expect(w.get('[data-test="rules-recent-invite"]').text()).toBe(
      'Beto aprobó con una cuenta creada desde el acceso compartido el 02/01/2025. No se sabe quién la invitó.',
    )
  })

  it('el historial muestra el origen "desde el acceso compartido" con su texto', async () => {
    const set = ruleSet({
      status: 'vigente', activatedAt: '2026-10-20T18:30:00.000Z',
      approvals: [{ ...BETO, approvedAt: '2026-10-20T18:30:00.000Z', origin: { kind: 'invited_from_shared_login', invitedAt: '2025-01-02T16:00:00.000Z', acceptedAt: '2025-01-02T16:30:00.000Z', recent: false } }],
    })
    const w = await show(overviewFixture({ state: 'vigente', inForce: set, history: [set] }))
    expect(w.get('[data-test="rules-history"]').text()).toContain('Cuenta creada por invitación desde el acceso compartido el 02/01/2025, 10:00. No se sabe quién invitó.')
  })

  it('con varias personas, las nombra y manda al historial', async () => {
    const w = await show(vigente([
      { ...BETO, invitedByName: 'Ana', acceptedAt: '2026-10-18T16:30:00.000Z' },
      { memberId: 'c', name: 'Carla', invitedByName: 'Ana', acceptedAt: '2026-10-19T16:30:00.000Z' },
    ]))
    expect(w.get('[data-test="rules-recent-invite"]').text()).toBe('Beto y Carla aprobaron con cuentas invitadas hace poco. Revisa el historial.')
  })

  it('si nadie aprobó con una cuenta invitada reciente, no hay aviso', async () => {
    const w = await show(vigente([]))
    expect(w.find('[data-test="rules-recent-invite"]').exists()).toBe(false)
  })
})

describe('RulesPanel: proponer', () => {
  it('abre el formulario con el valor neutro y se puede cancelar', async () => {
    const w = await show(overviewFixture())
    await click(w, 'rules-start')
    expect(w.find('[data-test="rules-form"]').exists()).toBe(true)
    await click(w, 'rules-cancel')
    expect(w.find('[data-test="rules-form"]').exists()).toBe(false)
  })

  it('al cambiar reglas vigentes parte de las vigentes', async () => {
    const config = defaultRulesConfig()
    config.profitBase = { partnerPct: 40, capitalPct: 60, workPct: 0 }
    const inForce = ruleSet({ status: 'vigente', config, activatedAt: '2026-10-20T18:30:00.000Z' })
    const w = await show(overviewFixture({ state: 'vigente', inForce, history: [inForce] }))
    await click(w, 'rules-start')
    expect((w.get('[data-test="base-capital"] input').element as HTMLInputElement).value).toBe('60')
  })

  it('guardar borrador envía lo escrito y muestra los avisos sin bloquear', async () => {
    const draft = ruleSet({ warnings: [{ code: 'RESERVES_HIGH', message: 'Apartas la mitad o más para reservas.' }] })
    mocks.saveDraft.mockResolvedValue(draft)
    const w = await show(overviewFixture())
    await click(w, 'rules-start')
    await w.get('[data-test="preset-capital"]').trigger('click')
    mocks.overview.mockResolvedValue(overviewFixture({ draft }))

    await click(w, 'rules-save')

    expect(mocks.saveDraft).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      profitBase: { partnerPct: 0, capitalPct: 100, workPct: 0 },
    }))
    expect(w.get('[data-test="rules-warnings"]').text()).toContain('Son avisos, no errores')
    expect(w.get('[data-test="rules-warnings"]').text()).toContain('Apartas la mitad')
    expect(w.find('[data-test="rules-save"]').attributes('disabled')).toBeUndefined()
  })

  it('enviar pide la casilla de conciencia, guarda y luego envía', async () => {
    mocks.saveDraft.mockResolvedValue(ruleSet())
    mocks.submit.mockResolvedValue(ruleSet({ status: 'pendiente' }))
    const w = await show(overviewFixture())
    await click(w, 'rules-start')
    expect(w.get('[data-test="rules-submit"]').attributes('disabled')).toBeDefined()

    await w.get('[data-test="rules-submit-check"]').setValue(true)
    await click(w, 'rules-submit')

    expect(mocks.saveDraft).toHaveBeenCalledTimes(1)
    expect(mocks.submit).toHaveBeenCalledWith(expect.anything(), RULE_SET_ID)
    expect(mocks.saveDraft.mock.invocationCallOrder[0]).toBeLessThan(mocks.submit.mock.invocationCallOrder[0]!)
  })

  it('si guardar falla, no envía nada', async () => {
    mocks.saveDraft.mockRejectedValue({ response: { status: 409, data: { code: 'FINANCE_RULES_DRAFT_OWNED' } } })
    const w = await show(overviewFixture())
    await click(w, 'rules-start')
    await w.get('[data-test="rules-submit-check"]').setValue(true)
    await click(w, 'rules-submit')

    expect(mocks.submit).not.toHaveBeenCalled()
    expect(w.get('[data-test="rules-action-error"]').text()).toContain('Otro socio ya tiene un borrador abierto')
  })

  it('un borrador propio se abre para seguir editando y se puede descartar', async () => {
    const draft = ruleSet({ config: { ...defaultRulesConfig(), profitBase: { partnerPct: 10, capitalPct: 90, workPct: 0 } } })
    mocks.discard.mockResolvedValue(ruleSet({ status: 'retirada' }))
    const w = await show(overviewFixture({ draft }))

    expect((w.get('[data-test="base-capital"] input').element as HTMLInputElement).value).toBe('90')
    mocks.overview.mockResolvedValue(overviewFixture())
    await click(w, 'rules-discard')
    expect(mocks.discard).toHaveBeenCalledWith(expect.anything(), RULE_SET_ID)
    expect(w.find('[data-test="rules-form"]').exists()).toBe(false)
  })

  it('el borrador de otro socio solo se ve como aviso', async () => {
    const draft = ruleSet({ proposedBy: BETO })
    const w = await show(overviewFixture({ draft }))
    expect(w.get('[data-test="rules-foreign-draft"]').text()).toContain('Beto está preparando una propuesta')
    expect(w.find('[data-test="rules-form"]').exists()).toBe(false)
  })

  it('con una propuesta pendiente no se puede editar nada', async () => {
    const w = await show(pendingOverview())
    expect(w.find('[data-test="rules-form"]').exists()).toBe(false)
    expect(w.find('[data-test="rules-start"]').exists()).toBe(false)
  })
})

describe('RulesPanel: aprobar', () => {
  it('pide leer y aceptar antes de aprobar', async () => {
    mocks.approve.mockResolvedValue(pendingSet())
    const w = await show(pendingOverview())
    expect(w.get('[data-test="rules-approve"]').attributes('disabled')).toBeDefined()

    await w.get('[data-test="rules-approve-check"]').setValue(true)
    await click(w, 'rules-approve')

    expect(mocks.approve).toHaveBeenCalledWith(expect.anything(), RULE_SET_ID)
  })

  it('quien ya aprobó lo ve y no puede aprobar de nuevo', async () => {
    const w = await show(pendingOverview({ me: { ...overviewFixture().me, hasApproved: true } }))
    expect(w.get('[data-test="rules-already-approved"]').text()).toContain('Ya aprobaste')
    expect(w.find('[data-test="rules-approve"]').exists()).toBe(false)
  })

  it('con acceso compartido explica por qué no puede, en español y sin botón', async () => {
    const reason = 'Tu acceso es compartido con otros socios. Por eso no podemos saber quién aprueba. Cada socio necesita su propia cuenta para aprobar.'
    const w = await show(pendingOverview({ me: { ...overviewFixture().me, canApprove: false, cannotApproveReason: reason } }))

    expect(w.get('[data-test="rules-cannot-approve"]').text()).toBe(reason)
    expect(w.find('[data-test="rules-approve"]').exists()).toBe(false)
    expect(w.find('[data-test="rules-approve-check"]').exists()).toBe(false)
  })

  it('si el servidor lo rechaza, muestra su mensaje en español', async () => {
    mocks.approve.mockRejectedValue({ response: { status: 403, data: { code: 'FINANCE_RULES_SHARED_LOGIN', message: 'Cada socio necesita su propia cuenta para aprobar.' } } })
    const w = await show(pendingOverview())
    await w.get('[data-test="rules-approve-check"]').setValue(true)
    await click(w, 'rules-approve')
    expect(w.get('[data-test="rules-action-error"]').text()).toBe('Cada socio necesita su propia cuenta para aprobar.')
  })

  it('al llegar la última aprobación, el panel pasa a Vigentes', async () => {
    mocks.approve.mockResolvedValue(pendingSet())
    const w = await show(pendingOverview())
    const inForce = ruleSet({ status: 'vigente', activatedAt: '2026-10-21T10:00:00.000Z' })
    mocks.overview.mockResolvedValue(overviewFixture({ state: 'vigente', inForce, history: [inForce] }))

    await w.get('[data-test="rules-approve-check"]').setValue(true)
    await click(w, 'rules-approve')

    expect(w.get('[data-test="rules-state"]').text()).toContain('Vigentes')
    expect(w.find('[data-test="rules-pending"]').exists()).toBe(false)
  })
})

describe('RulesPanel: retirar y recordar', () => {
  const mine = (over = {}) => pendingOverview({
    pending: pendingSet({ proposedBy: ANA, approvals: [], missing: [ANA, BETO] }),
    me: { ...overviewFixture().me, isProposer: true, ...over },
  })

  it('quien no propuso no ve retirar ni recordar', async () => {
    const w = await show(pendingOverview())
    expect(w.find('[data-test="rules-withdraw"]').exists()).toBe(false)
    expect(w.find('[data-test="rules-remind"]').exists()).toBe(false)
  })

  it('el proponente retira y se le avisa que se borran las aprobaciones', async () => {
    mocks.withdraw.mockResolvedValue(ruleSet())
    const w = await show(mine())
    expect(w.get('[data-test="rules-pending"]').text()).toContain('se borran las aprobaciones')

    await click(w, 'rules-withdraw')

    expect(mocks.withdraw).toHaveBeenCalledWith(expect.anything(), RULE_SET_ID)
  })

  it('recuerda y cuenta a quién se avisó y a quién ya se le había avisado', async () => {
    mocks.remind.mockResolvedValue({
      reminded: [{ ...BETO, emailSent: true }],
      skipped: [{ ...ANA, nextAt: '2026-10-21T15:00:00.000Z' }],
    })
    const w = await show(mine())

    await click(w, 'rules-remind')

    const result = w.get('[data-test="rules-remind-result"]').text()
    expect(result).toContain('Avisamos a Beto.')
    expect(result).toContain('A Ana ya se le avisó hace menos de 24 horas.')
  })

  it('quien recibió un recordatorio lo ve en la app', async () => {
    const w = await show(pendingOverview({ me: { ...overviewFixture().me, reminderReceivedAt: '2026-10-20T20:00:00.000Z' } }))
    expect(w.get('[data-test="rules-reminder-notice"]').text()).toBe('Beto te recordó el 20/10/2026, 14:00 que falta tu aprobación.')
  })

  it('quien ya aprobó no ve el recordatorio', async () => {
    const w = await show(pendingOverview({ me: { ...overviewFixture().me, hasApproved: true, reminderReceivedAt: '2026-10-20T20:00:00.000Z' } }))
    expect(w.find('[data-test="rules-reminder-notice"]').exists()).toBe(false)
  })
})
