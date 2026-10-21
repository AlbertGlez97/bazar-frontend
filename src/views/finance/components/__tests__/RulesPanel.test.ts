import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RulesPanel from '../RulesPanel.vue'
import { defaultRulesConfig } from '@/utils/finance-rules'
import {
  ANA, BETO, RULE_SET_ID, approval, objection, overviewFixture, partnerStatus, ruleSet,
} from '@/services/__tests__/finance-rules.fixture'
import type { RulesOverview } from '@/types/finance-rules.types'

const mocks = vi.hoisted(() => ({
  overview: vi.fn(), saveDraft: vi.fn(), discard: vi.fn(), submit: vi.fn(), modify: vi.fn(), resend: vi.fn(), requestCorreo: vi.fn(),
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
  approvals: [approval(BETO)], missing: [ANA], ...over,
})
const pendingOverview = (over: Partial<RulesOverview> = {}) => {
  const proposal = pendingSet()
  return overviewFixture({
    state: 'pendiente', proposal, history: [proposal],
    partners: [partnerStatus(ANA), partnerStatus(BETO, { response: 'aprobo' })], ...over,
  })
}
const reviewOverview = (over: Partial<RulesOverview> = {}) => {
  const proposal = pendingSet({ status: 'en_revision', inReviewAt: '2026-10-20T17:00:00.000Z', approvals: [], objections: [objection(BETO)], missing: [ANA] })
  return overviewFixture({
    state: 'en_revision', proposal, history: [proposal],
    partners: [partnerStatus(ANA), partnerStatus(BETO, { response: 'objeto' })], ...over,
  })
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
  it('lleva el engrane, explica que se aprueba por correo y dice que no es asesoría', async () => {
    const w = await show(overviewFixture())

    expect(w.get('h2').text()).toBe('Reglas de reparto')
    expect(w.find('h2 svg, header svg').exists()).toBe(true)
    const intro = w.get('[data-test="rules-intro"]').text()
    expect(intro).toContain('Configura estas reglas antes de repartir')
    expect(intro).toContain('Cada socio recibe un correo con las reglas y las aprueba desde ahí')
    expect(intro).toContain('nueva aprobación de todos')
    expect(w.text()).toContain('No es asesoría contable ni legal')
    expect(w.text()).toContain('contador')
  })

  it('no hay ningún botón para aprobar dentro de la app', async () => {
    for (const overview of [overviewFixture(), pendingOverview(), reviewOverview()]) {
      const w = await show(overview)
      expect(w.find('[data-test="rules-approve"]').exists()).toBe(false)
      expect(w.find('[data-test="rules-approve-check"]').exists()).toBe(false)
      expect(w.findAll('button').map((b) => b.text()).filter((t) => /aprobar estas|^aprobar$/i.test(t))).toEqual([])
    }
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

  it('Pendiente dice "Pendiente: faltan ..." y nombra a quien falta', async () => {
    const w = await show(pendingOverview())
    expect(w.get('[data-test="rules-state"]').text()).toContain('Pendiente')
    expect(w.get('[data-test="rules-state"]').text()).toContain('Falta por responder: Ana.')
    expect(w.get('[data-test="rules-proposal"]').text()).toContain('siguen las reglas anteriores')
  })

  it('En revisión dice quién no está de acuerdo y cuáles reglas siguen', async () => {
    const w = await show(reviewOverview())
    const state = w.get('[data-test="rules-state"]').text()
    expect(state).toContain('En revisión')
    expect(state).toContain('Beto no está de acuerdo.')
    expect(state).toContain('Siguen las reglas anteriores.')
  })

  it('Vigentes muestra la versión y la fecha, y las reglas en frases', async () => {
    const inForce = ruleSet({ status: 'vigente', version: 2, activatedAt: '2026-10-20T18:30:00.000Z' })
    const w = await show(overviewFixture({ state: 'vigente', inForce, history: [inForce] }))

    expect(w.get('[data-test="rules-state"]').text()).toContain('Vigentes')
    expect(w.get('[data-test="rules-state"]').text()).toContain('Versión 2, desde el 20/10/2026.')
    expect(w.get('[data-test="rules-inforce"]').text()).toContain('Utilidad: 100 % por ser socio')
    expect(w.get('[data-test="rules-start"]').text()).toBe('Proponer cambios')
  })

  it('el historial muestra quién aprobó, desde qué correo (enmascarado) y quién falta', async () => {
    const w = await show(pendingOverview())
    const history = w.get('[data-test="rules-history"]').text()
    expect(history).toContain('Versión 1')
    expect(history).toContain('Beto aprobó el 20/10/2026, 10:05.')
    expect(history).toContain('Aprobó desde el correo b***@e***.com.')
    expect(history).toContain('Ana todavía no responde.')
  })

  it('el historial muestra las objeciones con su motivo y las propuestas descartadas con su nota', async () => {
    const closed = ruleSet({
      version: 2, status: 'descartada', discardedAt: '2026-10-21T10:00:00.000Z',
      closedNote: 'Reemplazada por la versión 3.', objections: [objection(BETO, { reason: 'Más reservas <b>por favor</b>' })],
    })
    const w = await show(overviewFixture({ history: [closed] }))
    const history = w.get('[data-test="rules-history"]').text()

    expect(history).toContain('Descartada')
    expect(history).toContain('Se descartó el 21/10/2026, 04:00.')
    expect(history).toContain('Reemplazada por la versión 3.')
    expect(history).toContain('Beto no estuvo de acuerdo el 20/10/2026, 11:00 (b***@e***.com)')
    // El motivo lo escribe una persona: se ve como texto, nunca como HTML.
    expect(history).toContain('Más reservas <b>por favor</b>')
    expect(w.get('[data-test="rules-history"]').find('b').exists()).toBe(false)
  })

  it('el historial dice qué cambió en una versión y distingue las aprobaciones de antes', async () => {
    const set = ruleSet({
      status: 'vigente', version: 4, activatedAt: '2026-10-20T18:30:00.000Z',
      approvals: [approval(ANA, { correo: null, via: 'sesion' })],
      changes: [{ topic: 'Reservas', before: 'Se aparta 10 %.', after: 'Se aparta 20 %.' }],
    })
    const w = await show(overviewFixture({ state: 'vigente', inForce: set, history: [set] }))
    const history = w.get('[data-test="rules-history"]').text()

    expect(history).toContain('Aprobó desde su sesión, antes de que se aprobara por correo.')
    expect(history).toContain('Cambió Reservas. Antes: Se aparta 10 %. Ahora: Se aparta 20 %.')
  })

  it('pasó a revisión, se reemplazó o descartó: el historial dice cuándo', async () => {
    const review = ruleSet({ version: 5, status: 'en_revision', inReviewAt: '2026-10-20T17:00:00.000Z' })
    const old = ruleSet({ version: 4, status: 'reemplazada', supersededAt: '2026-10-19T17:00:00.000Z' })
    const w = await show(overviewFixture({ history: [review, old] }))
    const history = w.get('[data-test="rules-history"]').text()
    expect(history).toContain('Pasó a revisión el 20/10/2026, 11:00.')
    expect(history).toContain('La reemplazó una versión nueva el 19/10/2026, 11:00.')
  })
})

describe('RulesPanel: la propuesta abierta', () => {
  it('muestra quién respondió y quién falta, con el correo enviado', async () => {
    const link = { sentAt: '2026-10-20T16:00:00.000Z', expiresAt: '2026-10-27T16:00:00.000Z', expired: false, canResendAt: null }
    const w = await show(pendingOverview({ partners: [partnerStatus(ANA, { link }), partnerStatus(BETO, { response: 'aprobo' })] }))
    const partners = w.get('[data-test="rules-partners"]').text()

    expect(partners).toContain('Ana: falta responder. Correo enviado el 20/10/2026, 10:00.')
    expect(partners).toContain('Beto: aprobó el 20/10/2026, 10:05.')
  })

  it('"Reenviar correo" reenvía y cuenta a quién llegó', async () => {
    mocks.resend.mockResolvedValue({ activated: false, resent: [{ ...ANA, emailSent: true }], skipped: [], noEmail: [] })
    const w = await show(pendingOverview())

    await click(w, 'rules-resend')

    expect(mocks.resend).toHaveBeenCalledWith(expect.anything(), RULE_SET_ID)
    expect(w.get('[data-test="rules-resend-notice"]').text()).toBe('Reenviamos el correo a Ana.')
  })

  it('si a todos los que faltan ya se les reenvió, el botón queda desactivado y dice cuándo se puede de nuevo', async () => {
    const link = { sentAt: '2026-10-20T16:00:00.000Z', expiresAt: '2026-10-27T16:00:00.000Z', expired: false, canResendAt: '2026-10-22T20:00:00.000Z' }
    const w = await show(pendingOverview({ partners: [partnerStatus(ANA, { link }), partnerStatus(BETO, { response: 'aprobo' })] }))

    expect(w.get('[data-test="rules-resend"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="rules-resend-hint"]').text()).toBe('Ya reenviaste el correo hace menos de 24 horas. Podrás hacerlo de nuevo el 22/10/2026, 14:00.')
  })

  it('en revisión no hay "Reenviar correo", y se ven los motivos de quien no está de acuerdo', async () => {
    const w = await show(reviewOverview())

    expect(w.find('[data-test="rules-resend"]').exists()).toBe(false)
    expect(w.get('[data-test="rules-proposal"]').text()).toContain('En revisión')
    expect(w.get('[data-test="rules-proposal"] [data-test="rules-objections"]').text()).toContain('Quiero más reservas')
    expect(w.get('[data-test="rules-proposal"] [data-test="rules-objections"]').text()).toContain('b***@e***.com')
  })

  it('el motivo de quien no está de acuerdo se ve como texto, nunca como HTML, también en la propuesta', async () => {
    const proposal = pendingSet({
      status: 'en_revision', approvals: [],
      objections: [objection(BETO, { reason: 'Más reservas <b>por favor</b> <img src=x onerror=alert(1)>' })],
    })
    const w = await show(reviewOverview({ proposal, history: [] }))
    const reasons = w.get('[data-test="rules-proposal"] [data-test="rules-objections"]')

    expect(reasons.text()).toContain('Más reservas <b>por favor</b> <img src=x onerror=alert(1)>')
    expect(reasons.find('b').exists()).toBe(false)
    expect(reasons.find('img').exists()).toBe(false)
  })

  it('cualquier socio puede modificar: se crea una copia para él y se ve su borrador', async () => {
    const draft = ruleSet({ version: 2, basedOn: { id: RULE_SET_ID, version: 1, objections: [objection(BETO)] } })
    mocks.modify.mockResolvedValue(draft)
    const w = await show(reviewOverview())
    mocks.overview.mockResolvedValue(reviewOverview({ draft }))

    await click(w, 'rules-modify')

    expect(mocks.modify).toHaveBeenCalledWith(expect.anything(), RULE_SET_ID)
  })

  it('al descartar pide confirmar, y "No, conservarla" no hace nada', async () => {
    mocks.discard.mockResolvedValue(ruleSet({ status: 'descartada' }))
    const w = await show(pendingOverview())
    expect(w.find('[data-test="rules-discard-confirm"]').exists()).toBe(false)

    await click(w, 'rules-discard-proposal')
    expect(w.get('[data-test="rules-discard-confirm"]').text()).toContain('¿Descartar esta propuesta? Quedará en el historial')
    await click(w, 'rules-discard-no')
    expect(w.find('[data-test="rules-discard-confirm"]').exists()).toBe(false)
    expect(mocks.discard).not.toHaveBeenCalled()

    await click(w, 'rules-discard-proposal')
    await click(w, 'rules-discard-yes')
    expect(mocks.discard).toHaveBeenCalledWith(expect.anything(), RULE_SET_ID)
  })

  it('con una propuesta abierta no se puede editar nada', async () => {
    const w = await show(pendingOverview())
    expect(w.find('[data-test="rules-form"]').exists()).toBe(false)
    expect(w.find('[data-test="rules-start"]').exists()).toBe(false)
  })

  it('"Qué cambió" aparece cuando la versión trae cambios', async () => {
    const proposal = pendingSet({ changes: [{ topic: 'Reservas', before: 'Se aparta 10 %.', after: 'Se aparta 20 %.' }] })
    const w = await show(pendingOverview({ proposal, history: [proposal] }))
    expect(w.get('[data-test="rules-changes"]').text()).toContain('Reservas. Antes: Se aparta 10 %. Ahora: Se aparta 20 %.')
  })
})

describe('RulesPanel: escribir mi correo', () => {
  const sin = (over = {}) => overviewFixture({ me: { memberId: ANA.memberId, correo: null, hasCorreo: false, pendingCorreo: null, ...over } })

  it('quien ya tiene correo no ve la tarjeta', async () => {
    const w = await show(overviewFixture())
    expect(w.find('[data-test="rules-correo"]').exists()).toBe(false)
  })

  it('quien no lo tiene ve cómo escribirlo y que se confirma con un enlace', async () => {
    const w = await show(sin())
    const card = w.get('[data-test="rules-correo"]').text()
    expect(card).toContain('Escribe tu correo')
    expect(card).toContain('Te mandamos un enlace para confirmar que es tuyo')
  })

  it('manda el correo escrito y dice adónde se envió la confirmación', async () => {
    mocks.requestCorreo.mockResolvedValue({ correo: 'a***@e***.com', expiresAt: '2026-10-23T12:00:00.000Z' })
    const w = await show(sin())
    await w.get('[data-test="rules-correo"] input').setValue('  ana@example.com ')

    await w.get('[data-test="rules-correo"] form').trigger('submit')
    await flushPromises()

    expect(mocks.requestCorreo).toHaveBeenCalledWith(expect.anything(), 'ana@example.com')
    expect(w.get('[data-test="rules-correo-sent"]').text()).toContain('Te enviamos un correo a a***@e***.com. Ábrelo y confirma.')
  })

  it('no manda lo que claramente no es un correo, y lo dice', async () => {
    const w = await show(sin())
    await w.get('[data-test="rules-correo"] input').setValue('ana')
    await w.get('[data-test="rules-correo"] form').trigger('submit')
    await flushPromises()

    expect(mocks.requestCorreo).not.toHaveBeenCalled()
    expect(w.get('[data-test="rules-correo"]').text()).toContain('Escribe un correo válido, por ejemplo nombre@dominio.com')
  })

  it('un correo que ya está en uso se dice en español', async () => {
    mocks.requestCorreo.mockRejectedValue({ response: { status: 409, data: { code: 'MEMBER_EMAIL_IN_USE' } } })
    const w = await show(sin())
    await w.get('[data-test="rules-correo"] input').setValue('ana@example.com')
    await w.get('[data-test="rules-correo"] form').trigger('submit')
    await flushPromises()

    expect(w.get('[data-test="rules-action-error"]').text()).toBe('Ese correo ya está en uso. Usa otro correo.')
    expect(w.find('[data-test="rules-correo-sent"]').exists()).toBe(false)
  })

  it('si ya hay una confirmación esperando, dice a qué correo y hasta cuándo', async () => {
    const w = await show(sin({ pendingCorreo: { correo: 'a***@e***.com', expiresAt: '2026-10-23T18:00:00.000Z' } }))
    expect(w.get('[data-test="rules-correo-pending"]').text()).toContain('Ya enviamos un correo a a***@e***.com.')
    expect(w.get('[data-test="rules-correo-pending"]').text()).toContain('Vence el 23/10/2026, 12:00.')
  })

  it('el campo tiene etiqueta, tipo correo y autocompletado válido', async () => {
    const w = await show(sin())
    const input = w.get('[data-test="rules-correo"] input')
    expect(input.attributes('type')).toBe('email')
    expect(input.attributes('autocomplete')).toBe('email')
    expect(w.get(`[data-test="rules-correo"] label[for="${input.attributes('id')}"]`).text()).toBe('Tu correo')
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

  it('enviar pide la casilla de conciencia, guarda, envía y dice a quién llegó el correo', async () => {
    mocks.saveDraft.mockResolvedValue(ruleSet())
    mocks.submit.mockResolvedValue({ rules: ruleSet({ status: 'pendiente' }), emails: { sent: ['Ana', 'Beto'], failed: [] } })
    const w = await show(overviewFixture())
    await click(w, 'rules-start')
    expect(w.get('[data-test="rules-submit"]').attributes('disabled')).toBeDefined()

    await w.get('[data-test="rules-submit-check"]').setValue(true)
    await click(w, 'rules-submit')

    expect(mocks.saveDraft).toHaveBeenCalledTimes(1)
    expect(mocks.submit).toHaveBeenCalledWith(expect.anything(), RULE_SET_ID)
    expect(mocks.saveDraft.mock.invocationCallOrder[0]).toBeLessThan(mocks.submit.mock.invocationCallOrder[0]!)
    expect(w.get('[data-test="rules-submit-notice"]').text()).toBe('Enviamos el correo a Ana y Beto.')
  })

  it('si a alguien no le llegó el correo, el aviso lo dice y manda a reenviar', async () => {
    mocks.saveDraft.mockResolvedValue(ruleSet())
    mocks.submit.mockResolvedValue({ rules: ruleSet({ status: 'pendiente' }), emails: { sent: ['Ana'], failed: ['Beto'] } })
    const w = await show(overviewFixture())
    await click(w, 'rules-start')
    await w.get('[data-test="rules-submit-check"]').setValue(true)
    await click(w, 'rules-submit')

    expect(w.get('[data-test="rules-submit-notice"]').text()).toContain('No pudimos enviar el correo a Beto.')
    expect(w.get('[data-test="rules-submit-notice"]').text()).toContain('Reenviar correo')
  })

  it('mientras a un socio le falte el correo no se puede enviar, y se dice a quién', async () => {
    const partners = [partnerStatus(ANA), partnerStatus(BETO, { hasCorreo: false, correo: null })]
    const w = await show(overviewFixture({ partners }))
    await click(w, 'rules-start')
    await w.get('[data-test="rules-submit-check"]').setValue(true)

    expect(w.get('[data-test="rules-missing-correo"]').text()).toBe('Falta el correo de Beto. Hasta que lo escriban, no se puede enviar la propuesta.')
    expect(w.get('[data-test="rules-submit"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="rules-save"]').attributes('disabled')).toBeUndefined()
  })

  it('si el servidor rechaza el envío por un correo faltante, muestra su mensaje', async () => {
    mocks.saveDraft.mockResolvedValue(ruleSet())
    mocks.submit.mockRejectedValue({ response: { status: 422, data: { code: 'FINANCE_RULES_MISSING_EMAIL', message: 'No se puede enviar. Falta el correo de Carla.' } } })
    const w = await show(overviewFixture())
    await click(w, 'rules-start')
    await w.get('[data-test="rules-submit-check"]').setValue(true)
    await click(w, 'rules-submit')

    expect(w.get('[data-test="rules-action-error"]').text()).toBe('No se puede enviar. Falta el correo de Carla.')
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
    mocks.discard.mockResolvedValue(ruleSet({ status: 'descartada' }))
    const w = await show(overviewFixture({ draft }))

    expect((w.get('[data-test="base-capital"] input').element as HTMLInputElement).value).toBe('90')
    mocks.overview.mockResolvedValue(overviewFixture())
    await click(w, 'rules-discard')
    expect(mocks.discard).toHaveBeenCalledWith(expect.anything(), RULE_SET_ID)
    expect(w.find('[data-test="rules-form"]').exists()).toBe(false)
  })

  it('un borrador hecho con "Modificar" muestra de qué versión viene y los motivos que responde', async () => {
    const draft = ruleSet({ version: 2, basedOn: { id: RULE_SET_ID, version: 1, objections: [objection(BETO, { reason: 'Más reservas' })] } })
    const w = await show(overviewFixture({ draft }))
    const based = w.get('[data-test="rules-based-on"]').text()

    expect(based).toContain('Estás cambiando la versión 1')
    expect(based).toContain('Estos son los motivos de quienes no estaban de acuerdo:')
    expect(based).toContain('Más reservas')
  })

  it('el borrador de otro socio se ve como aviso, y cualquier socio puede descartarlo', async () => {
    const draft = ruleSet({ proposedBy: BETO })
    mocks.discard.mockResolvedValue(ruleSet({ status: 'descartada' }))
    const w = await show(overviewFixture({ draft }))
    expect(w.get('[data-test="rules-foreign-draft"]').text()).toContain('Beto está preparando una propuesta')
    expect(w.find('[data-test="rules-form"]').exists()).toBe(false)

    await click(w, 'rules-discard-foreign')
    expect(mocks.discard).toHaveBeenCalledWith(expect.anything(), RULE_SET_ID)
  })

  it('empezar a proponer quita los avisos de la acción anterior', async () => {
    mocks.resend.mockResolvedValue({ activated: false, resent: [{ ...ANA, emailSent: true }], skipped: [], noEmail: [] })
    const w = await show(pendingOverview())
    await click(w, 'rules-resend')
    expect(w.find('[data-test="rules-resend-notice"]').exists()).toBe(true)

    mocks.overview.mockResolvedValue(overviewFixture())
    await click(w, 'rules-discard-proposal')
    mocks.discard.mockResolvedValue(ruleSet({ status: 'descartada' }))
    await click(w, 'rules-discard-yes')
    expect(w.find('[data-test="rules-resend-notice"]').exists()).toBe(false)
  })
})
