import { reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFinanceRulesStore } from '../finance-rules.store'
import { defaultRulesConfig } from '@/utils/finance-rules'
import { BETO, RULE_SET_ID, overviewFixture, ruleSet, rulesOrigin } from '@/services/__tests__/finance-rules.fixture'

const mocks = vi.hoisted(() => ({
  overview: vi.fn(), saveDraft: vi.fn(), discard: vi.fn(), submit: vi.fn(), modify: vi.fn(), resend: vi.fn(), requestCorreo: vi.fn(),
}))
vi.mock('@/services/finance-rules.service', () => ({ FinanceRulesService: mocks }))
const state = reactive({ auth: { token: 'token-a' }, session: {
  owner: { accountId: rulesOrigin.accountId, apiBase: '/api/v1' },
  memberId: rulesOrigin.memberId, deviceId: rulesOrigin.deviceId,
  member: { role: 'socio', active: true },
} })
vi.mock('../auth.store', () => ({ useAuthStore: () => state.auth }))
vi.mock('../session.store', () => ({ useSessionStore: () => state.session }))
vi.mock('@/services/queue-origin', () => ({ currentQueueOrigin: () => ({
  ...state.session.owner, memberId: state.session.memberId, deviceId: state.session.deviceId,
}) }))

const fail = (status: number, code: string, message?: string) => ({ response: { status, data: { code, message } } })
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  state.auth.token = 'token-a'
  state.session.member = { role: 'socio', active: true }
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  mocks.overview.mockResolvedValue(overviewFixture())
})

describe('finance-rules.store', () => {
  it('carga el estado y lo explica con palabras sencillas', async () => {
    const store = useFinanceRulesStore()

    await store.load()

    expect(mocks.overview).toHaveBeenCalledWith(expect.objectContaining({ memberId: rulesOrigin.memberId }))
    expect(store.overview).toEqual(overviewFixture())
    expect(store.stateText).toMatchObject({ title: 'Sin aprobar' })
    expect(store.loading).toBe(false)
    expect(store.error).toBe('')
  })

  it('un colaborador no consulta nada', async () => {
    state.session.member = { role: 'colaborador', active: true }
    const store = useFinanceRulesStore()

    await store.load()

    expect(mocks.overview).not.toHaveBeenCalled()
    expect(store.error).toContain('persona socia')
    expect(store.overview).toBeNull()
  })

  it('sin conexión lo dice y no envía', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    const store = useFinanceRulesStore()

    await store.load()
    expect(await store.resend(RULE_SET_ID)).toBeNull()

    expect(mocks.overview).not.toHaveBeenCalled()
    expect(mocks.resend).not.toHaveBeenCalled()
    expect(store.error).toContain('conexión')
    expect(store.actionError).toContain('conexión')
  })

  it('si la carga falla muestra un mensaje y no deja datos viejos de otra persona', async () => {
    mocks.overview.mockRejectedValue(fail(403, 'X'))
    const store = useFinanceRulesStore()

    await store.load()

    expect(store.error).toBe('Solo las personas socias pueden usar las reglas de reparto.')
    expect(store.loading).toBe(false)
  })

  it('una respuesta tardía de una carga vieja no pisa a la nueva', async () => {
    const slow = deferred<ReturnType<typeof overviewFixture>>()
    mocks.overview.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(overviewFixture({ state: 'vigente' }))
    const store = useFinanceRulesStore()

    const first = store.load()
    await store.load()
    slow.resolve(overviewFixture({ state: 'pendiente' }))
    await first

    expect(store.overview?.state).toBe('vigente')
  })

  it('cada cambio vuelve a leer lo que decidió el servidor', async () => {
    mocks.saveDraft.mockResolvedValue(ruleSet())
    const store = useFinanceRulesStore()

    const result = await store.saveDraft(defaultRulesConfig())

    expect(result).toEqual(ruleSet())
    expect(mocks.saveDraft).toHaveBeenCalledWith(expect.objectContaining({ memberId: rulesOrigin.memberId }), defaultRulesConfig())
    expect(mocks.overview).toHaveBeenCalledTimes(1)
    expect(store.working).toBe(false)
  })

  it.each(['discard', 'modify'] as const)('%s pasa el id de la propuesta', async (name) => {
    mocks[name].mockResolvedValue(ruleSet())
    const store = useFinanceRulesStore()

    await store[name](RULE_SET_ID)

    expect(mocks[name]).toHaveBeenCalledWith(expect.anything(), RULE_SET_ID)
  })

  it('un rechazo del servidor se explica en español y refresca la pantalla', async () => {
    mocks.submit.mockRejectedValue(fail(422, 'FINANCE_RULES_MISSING_EMAIL', 'No se puede enviar. Falta el correo de Beto.'))
    const store = useFinanceRulesStore()

    const result = await store.submit(RULE_SET_ID)

    expect(result).toBeNull()
    expect(store.actionError).toBe('No se puede enviar. Falta el correo de Beto.')
    expect(store.submitted).toBeNull()
    expect(mocks.overview).toHaveBeenCalledTimes(1)
  })

  it('guarda a quién llegó el correo al enviar, y a quién no', async () => {
    const emails = { sent: ['Ana'], failed: ['Beto'] }
    mocks.submit.mockResolvedValue({ rules: ruleSet({ status: 'pendiente' }), emails })
    const store = useFinanceRulesStore()

    await store.submit(RULE_SET_ID)

    expect(store.submitted).toEqual(emails)
  })

  it('guarda a quién se reenvió y a quién no', async () => {
    const answer = { activated: false, resent: [{ ...BETO, emailSent: false }], skipped: [], noEmail: [] }
    mocks.resend.mockResolvedValue(answer)
    const store = useFinanceRulesStore()

    await store.resend(RULE_SET_ID)

    expect(store.resent).toEqual(answer)
  })

  it('al pedir el correo propio guarda adónde se mandó la confirmación', async () => {
    mocks.requestCorreo.mockResolvedValue({ correo: 'a***@e***.com', expiresAt: '2026-10-23T12:00:00.000Z' })
    const store = useFinanceRulesStore()

    expect(await store.requestCorreo('ana@example.com')).toBe(true)

    expect(mocks.requestCorreo).toHaveBeenCalledWith(expect.anything(), 'ana@example.com')
    expect(store.correoSentTo).toBe('a***@e***.com')
  })

  it('un correo que ya está en uso se explica y no queda como enviado', async () => {
    mocks.requestCorreo.mockRejectedValue(fail(409, 'MEMBER_EMAIL_IN_USE'))
    const store = useFinanceRulesStore()

    expect(await store.requestCorreo('ana@example.com')).toBe(false)

    expect(store.actionError).toBe('Ese correo ya está en uso. Usa otro correo.')
    expect(store.correoSentTo).toBe('')
  })

  it('un aviso es de una sola acción: clearNotices los quita todos', async () => {
    mocks.submit.mockResolvedValue({ rules: ruleSet(), emails: { sent: ['Ana'], failed: [] } })
    mocks.resend.mockResolvedValue({ activated: false, resent: [], skipped: [], noEmail: [] })
    mocks.requestCorreo.mockResolvedValue({ correo: 'a***@e***.com', expiresAt: '2026-10-23T12:00:00.000Z' })
    const store = useFinanceRulesStore()
    await store.submit(RULE_SET_ID)
    await store.resend(RULE_SET_ID)
    await store.requestCorreo('a@b.co')

    store.clearNotices()

    expect([store.submitted, store.resent, store.correoSentTo, store.actionError]).toEqual([null, null, '', ''])
  })

  it('reset borra todo lo mostrado', async () => {
    mocks.resend.mockResolvedValue({ activated: false, resent: [], skipped: [], noEmail: [] })
    const store = useFinanceRulesStore()
    await store.load()
    await store.resend(RULE_SET_ID)
    store.reset()
    expect(store.overview).toBeNull()
    expect(store.resent).toBeNull()
    expect(store.submitted).toBeNull()
    expect(store.correoSentTo).toBe('')
  })
})
