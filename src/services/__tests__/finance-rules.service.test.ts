import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../api'
import { FinanceRulesContractError, FinanceRulesService } from '../finance-rules.service'
import { defaultRulesConfig } from '@/utils/finance-rules'
import { ANA, BETO, RULE_SET_ID, overviewFixture, ruleSet, rulesOrigin } from './finance-rules.fixture'

const selection = vi.hoisted(() => ({ current: {} as typeof rulesOrigin }))
vi.mock('../queue-origin', () => ({ currentQueueOrigin: () => selection.current }))
vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), defaults: { transformRequest: [] } } }))

const headers = { 'x-member-id': rulesOrigin.memberId, 'x-device-id': rulesOrigin.deviceId }

beforeEach(() => {
  vi.clearAllMocks()
  selection.current = { ...rulesOrigin }
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

describe('FinanceRulesService', () => {
  it('overview pide /finance/rules con la identidad del socio', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: overviewFixture() })

    await expect(FinanceRulesService.overview(rulesOrigin)).resolves.toEqual(overviewFixture())
    expect(api.get).toHaveBeenCalledWith('/finance/rules', expect.objectContaining({ headers }))
  })

  it('saveDraft envía solo la configuración', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: ruleSet() })

    await FinanceRulesService.saveDraft(rulesOrigin, defaultRulesConfig())

    expect(api.put).toHaveBeenCalledWith('/finance/rules/draft', { config: defaultRulesConfig() }, expect.objectContaining({ headers }))
  })

  it.each([
    ['discard', 'discard'],
    ['submit', 'submit'],
    ['withdraw', 'withdraw'],
    ['approve', 'approve'],
  ] as const)('%s usa la ruta de la propuesta', async (method, action) => {
    vi.mocked(api.post).mockResolvedValue({ data: ruleSet() })

    await FinanceRulesService[method](rulesOrigin, RULE_SET_ID)

    expect(api.post).toHaveBeenCalledWith(`/finance/rules/${RULE_SET_ID}/${action}`, {}, expect.objectContaining({ headers }))
  })

  it('remind devuelve a quién se avisó y a quién se omitió', async () => {
    const answer = {
      reminded: [{ ...BETO, emailSent: true }],
      skipped: [{ ...ANA, nextAt: '2026-10-21T15:00:00.000Z' }],
    }
    vi.mocked(api.post).mockResolvedValue({ data: answer })

    await expect(FinanceRulesService.remind(rulesOrigin, RULE_SET_ID)).resolves.toEqual(answer)
  })

  it('un id que no es UUID no sale a la red', async () => {
    await expect(FinanceRulesService.approve(rulesOrigin, '../x')).rejects.toThrow('Invalid rule set id')
    expect(api.post).not.toHaveBeenCalled()
  })

  it('si la selección cambió, no envía nada', async () => {
    selection.current = { ...rulesOrigin, memberId: '0190aaaa-0000-7000-8000-000000000099' }
    await expect(FinanceRulesService.overview(rulesOrigin)).rejects.toThrow('no longer matches')
    expect(api.get).not.toHaveBeenCalled()
  })

  it('sin conexión no envía nada', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    await expect(FinanceRulesService.approve(rulesOrigin, RULE_SET_ID)).rejects.toThrow('require a connection')
    expect(api.post).not.toHaveBeenCalled()
  })

  describe('contrato de la respuesta', () => {
    const broken: [string, unknown][] = [
      ['un estado desconocido', overviewFixture({ state: 'raro' as never })],
      ['falta el permiso de quien consulta', { ...overviewFixture(), me: undefined }],
      ['un historial con una versión rota', overviewFixture({ history: [ruleSet({ status: 'otra' as never })] })],
      ['un hash que no es sha256', overviewFixture({ draft: ruleSet({ configHash: 'xyz' }) })],
      ['una fecha inválida', overviewFixture({ pending: ruleSet({ status: 'pendiente', submittedAt: 'ayer' }) })],
      ['socios sin nombre', overviewFixture({ partners: [{ memberId: ANA.memberId, name: '' }] })],
      ['sin aviso legal', overviewFixture({ disclaimer: '' })],
      ['un permiso de aprobar que no es sí o no', { ...overviewFixture(), me: { ...overviewFixture().me, canApprove: 'si' } }],
    ]
    it.each(broken)('rechaza %s', async (_name, data) => {
      vi.mocked(api.get).mockResolvedValue({ data })
      await expect(FinanceRulesService.overview(rulesOrigin)).rejects.toBeInstanceOf(FinanceRulesContractError)
    })

    it('rechaza una acción que no devuelve una versión válida', async () => {
      vi.mocked(api.post).mockResolvedValue({ data: { id: 'x' } })
      await expect(FinanceRulesService.approve(rulesOrigin, RULE_SET_ID)).rejects.toBeInstanceOf(FinanceRulesContractError)
    })

    it('rechaza un recordatorio con otra forma', async () => {
      vi.mocked(api.post).mockResolvedValue({ data: { reminded: [{ memberId: 'x' }], skipped: [] } })
      await expect(FinanceRulesService.remind(rulesOrigin, RULE_SET_ID)).rejects.toBeInstanceOf(FinanceRulesContractError)
    })

    it('acepta el historial con aprobaciones y faltantes', async () => {
      const pending = ruleSet({
        status: 'pendiente', submittedAt: '2026-10-20T16:00:00.000Z',
        approvals: [{ ...ANA, approvedAt: '2026-10-20T16:05:00.000Z', origin: { kind: 'shared_single_partner' } }], missing: [BETO],
      })
      vi.mocked(api.get).mockResolvedValue({ data: overviewFixture({ state: 'pendiente', pending, history: [pending] }) })
      await expect(FinanceRulesService.overview(rulesOrigin)).resolves.toMatchObject({ state: 'pendiente' })
    })

    it('acepta el origen de cada cuenta: invitación, cuenta propia, acceso compartido o sin dato', async () => {
      const origins = [
        { kind: 'invited', invitedByMemberId: ANA.memberId, invitedByName: 'Ana', invitedAt: '2026-10-18T16:00:00.000Z', acceptedAt: '2026-10-18T16:30:00.000Z', recent: true },
        { kind: 'own_account', accountCreatedAt: '2026-09-01T12:00:00.000Z' },
        { kind: 'own_account', accountCreatedAt: null },
        { kind: 'shared_single_partner' },
        { kind: 'invited_from_shared_login', invitedAt: '2026-10-18T16:00:00.000Z', acceptedAt: '2026-10-18T16:30:00.000Z', recent: false },
        null,
      ]
      const approvals = origins.map((origin) => ({ ...BETO, approvedAt: '2026-10-20T16:05:00.000Z', origin }))
      const set = ruleSet({
        approvals: approvals as never,
        recentInvitedApprovers: [
          { ...BETO, invitedByName: 'Ana', acceptedAt: '2026-10-18T16:30:00.000Z', fromSharedLogin: false },
          { ...BETO, invitedByName: null, acceptedAt: '2026-01-18T16:30:00.000Z', fromSharedLogin: true },
        ],
      })
      vi.mocked(api.get).mockResolvedValue({ data: overviewFixture({ history: [set] }) })
      await expect(FinanceRulesService.overview(rulesOrigin)).resolves.toBeDefined()
    })

    it.each([
      ['una invitación desde acceso compartido sin fechas', { kind: 'invited_from_shared_login', recent: false }],
      ['una invitación desde acceso compartido que dice quién invitó', { kind: 'invited_from_shared_login', invitedAt: '2026-10-18T16:00:00.000Z', acceptedAt: '2026-10-18T16:30:00.000Z', recent: false, invitedByName: 'Ana' }],
    ])('rechaza %s', async (_name, origin) => {
      const approval = { ...BETO, approvedAt: '2026-10-20T16:05:00.000Z', origin }
      vi.mocked(api.get).mockResolvedValue({ data: overviewFixture({ history: [ruleSet({ approvals: [approval] as never })] }) })
      await expect(FinanceRulesService.overview(rulesOrigin)).rejects.toBeInstanceOf(FinanceRulesContractError)
    })

    it('rechaza un aviso sin saber si vino del acceso compartido', async () => {
      const set = ruleSet({ recentInvitedApprovers: [{ ...BETO, invitedByName: 'Ana', acceptedAt: '2026-10-18T16:30:00.000Z' }] as never })
      vi.mocked(api.get).mockResolvedValue({ data: overviewFixture({ inForce: set }) })
      await expect(FinanceRulesService.overview(rulesOrigin)).rejects.toBeInstanceOf(FinanceRulesContractError)
    })

    it.each([
      ['un origen de tipo desconocido', { ...BETO, approvedAt: '2026-10-20T16:05:00.000Z', origin: { kind: 'magia' } }],
      ['una invitación sin quien invitó', { ...BETO, approvedAt: '2026-10-20T16:05:00.000Z', origin: { kind: 'invited', invitedByName: '', invitedAt: '2026-10-18T16:00:00.000Z', acceptedAt: '2026-10-18T16:30:00.000Z', recent: true } }],
      ['una aprobación sin el campo origen', { ...BETO, approvedAt: '2026-10-20T16:05:00.000Z' }],
    ])('rechaza %s', async (_name, approval) => {
      vi.mocked(api.get).mockResolvedValue({ data: overviewFixture({ history: [ruleSet({ approvals: [approval] as never })] }) })
      await expect(FinanceRulesService.overview(rulesOrigin)).rejects.toBeInstanceOf(FinanceRulesContractError)
    })

    it('rechaza una lista de aprobados recientes mal formada', async () => {
      vi.mocked(api.get).mockResolvedValue({ data: overviewFixture({ inForce: ruleSet({ recentInvitedApprovers: [{ name: '' }] as never }) }) })
      await expect(FinanceRulesService.overview(rulesOrigin)).rejects.toBeInstanceOf(FinanceRulesContractError)
    })
  })
})
