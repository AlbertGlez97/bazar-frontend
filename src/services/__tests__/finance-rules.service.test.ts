import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../api'
import { FinanceRulesContractError, FinanceRulesService } from '../finance-rules.service'
import { defaultRulesConfig } from '@/utils/finance-rules'
import {
  ANA, BETO, RULE_SET_ID, approval, objection, overviewFixture, partnerStatus, ruleSet, rulesOrigin,
} from './finance-rules.fixture'

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
    ['modify', 'modify'],
  ] as const)('%s usa la ruta de la propuesta y devuelve la versión', async (method, action) => {
    vi.mocked(api.post).mockResolvedValue({ data: ruleSet() })

    await expect(FinanceRulesService[method](rulesOrigin, RULE_SET_ID)).resolves.toEqual(ruleSet())

    expect(api.post).toHaveBeenCalledWith(`/finance/rules/${RULE_SET_ID}/${action}`, {}, expect.objectContaining({ headers }))
  })

  it('submit separa la versión de a quién llegó el correo', async () => {
    const answer = { ...ruleSet({ status: 'pendiente' }), emails: { sent: ['Ana'], failed: ['Beto'] } }
    vi.mocked(api.post).mockResolvedValue({ data: answer })

    const result = await FinanceRulesService.submit(rulesOrigin, RULE_SET_ID)

    expect(api.post).toHaveBeenCalledWith(`/finance/rules/${RULE_SET_ID}/submit`, {}, expect.objectContaining({ headers }))
    expect(result).toEqual({ rules: ruleSet({ status: 'pendiente' }), emails: { sent: ['Ana'], failed: ['Beto'] } })
    expect(result.rules).not.toHaveProperty('emails')
  })

  it('resend devuelve a quién se reenvió, a quién se omitió y a quién le falta el correo', async () => {
    const answer = {
      activated: false,
      resent: [{ ...BETO, emailSent: true }],
      skipped: [{ ...ANA, nextAt: '2026-10-21T15:00:00.000Z' }],
      noEmail: [BETO],
    }
    vi.mocked(api.post).mockResolvedValue({ data: answer })

    await expect(FinanceRulesService.resend(rulesOrigin, RULE_SET_ID)).resolves.toEqual(answer)
    expect(api.post).toHaveBeenCalledWith(`/finance/rules/${RULE_SET_ID}/resend`, {}, expect.objectContaining({ headers }))
  })

  it('requestCorreo pide confirmar el correo propio y devuelve el correo enmascarado', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { ok: true, correo: 'a***@e***.com', expiresAt: '2026-10-23T12:00:00.000Z' } })

    await expect(FinanceRulesService.requestCorreo(rulesOrigin, 'ana@example.com')).resolves.toEqual({
      correo: 'a***@e***.com',
      expiresAt: '2026-10-23T12:00:00.000Z',
    })
    expect(api.put).toHaveBeenCalledWith('/members/me/email', { correo: 'ana@example.com' }, expect.objectContaining({ headers }))
  })

  it('un id que no es UUID no sale a la red', async () => {
    for (const method of ['discard', 'submit', 'modify', 'resend'] as const)
      await expect(FinanceRulesService[method](rulesOrigin, '../x')).rejects.toThrow('Invalid rule set id')
    expect(api.post).not.toHaveBeenCalled()
  })

  it('si la selección cambió, no envía nada', async () => {
    selection.current = { ...rulesOrigin, memberId: '0190aaaa-0000-7000-8000-000000000099' }
    await expect(FinanceRulesService.overview(rulesOrigin)).rejects.toThrow('no longer matches')
    expect(api.get).not.toHaveBeenCalled()
  })

  it('sin conexión no envía nada', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    await expect(FinanceRulesService.resend(rulesOrigin, RULE_SET_ID)).rejects.toThrow('require a connection')
    await expect(FinanceRulesService.requestCorreo(rulesOrigin, 'a@b.co')).rejects.toThrow('require a connection')
    expect(api.post).not.toHaveBeenCalled()
    expect(api.put).not.toHaveBeenCalled()
  })

  describe('contrato de la respuesta', () => {
    const broken: [string, unknown][] = [
      ['un estado desconocido', overviewFixture({ state: 'raro' as never })],
      ['sin los datos de quien consulta', { ...overviewFixture(), me: undefined }],
      ['un historial con una versión rota', overviewFixture({ history: [ruleSet({ status: 'otra' as never })] })],
      ['un hash que no es sha256', overviewFixture({ draft: ruleSet({ configHash: 'xyz' }) })],
      ['una fecha inválida', overviewFixture({ proposal: ruleSet({ status: 'pendiente', submittedAt: 'ayer' }) })],
      ['una fecha de revisión inválida', overviewFixture({ proposal: ruleSet({ status: 'en_revision', inReviewAt: 'ayer' }) })],
      ['socios sin nombre', overviewFixture({ partners: [partnerStatus({ memberId: ANA.memberId, name: '' })] })],
      ['socios sin saber si tienen correo', overviewFixture({ partners: [{ ...partnerStatus(ANA), hasCorreo: 'si' as never }] })],
      ['una respuesta de socio desconocida', overviewFixture({ partners: [partnerStatus(ANA, { response: 'quizá' as never })] })],
      ['un enlace de socio sin fechas', overviewFixture({ partners: [partnerStatus(ANA, { link: { sentAt: 'x', expiresAt: 'y', expired: false, canResendAt: null } })] })],
      ['sin aviso legal', overviewFixture({ disclaimer: '' })],
      ['mi correo con otra forma', { ...overviewFixture(), me: { ...overviewFixture().me, hasCorreo: 'si' } }],
      ['una confirmación pendiente sin fecha', { ...overviewFixture(), me: { ...overviewFixture().me, pendingCorreo: { correo: 'a***@e***.com', expiresAt: 'x' } } }],
      ['una aprobación sin correo ni vía', overviewFixture({ history: [ruleSet({ approvals: [{ ...BETO, approvedAt: '2026-10-20T16:05:00.000Z' }] as never })] })],
      ['una aprobación con una vía desconocida', overviewFixture({ history: [ruleSet({ approvals: [approval(BETO, { via: 'magia' as never })] })] })],
      ['una objeción sin motivo', overviewFixture({ history: [ruleSet({ objections: [objection(BETO, { reason: '' })] })] })],
      ['"qué cambió" con otra forma', overviewFixture({ history: [ruleSet({ changes: [{ topic: 'x' }] as never })] })],
      ['una versión base rota', overviewFixture({ draft: ruleSet({ basedOn: { id: 'x', version: 1, objections: [] } as never }) })],
    ]
    it.each(broken)('rechaza %s', async (_name, data) => {
      vi.mocked(api.get).mockResolvedValue({ data })
      await expect(FinanceRulesService.overview(rulesOrigin)).rejects.toBeInstanceOf(FinanceRulesContractError)
    })

    it('rechaza una acción que no devuelve una versión válida', async () => {
      vi.mocked(api.post).mockResolvedValue({ data: { id: 'x' } })
      await expect(FinanceRulesService.discard(rulesOrigin, RULE_SET_ID)).rejects.toBeInstanceOf(FinanceRulesContractError)
      await expect(FinanceRulesService.modify(rulesOrigin, RULE_SET_ID)).rejects.toBeInstanceOf(FinanceRulesContractError)
    })

    it('rechaza un envío sin la lista de a quién llegó el correo, o con otra forma', async () => {
      for (const emails of [undefined, { sent: ['Ana'] }, { sent: [''], failed: [] }, { sent: 'Ana', failed: [] }]) {
        vi.mocked(api.post).mockResolvedValue({ data: { ...ruleSet({ status: 'pendiente' }), emails } })
        await expect(FinanceRulesService.submit(rulesOrigin, RULE_SET_ID)).rejects.toBeInstanceOf(FinanceRulesContractError)
      }
    })

    it('rechaza un reenvío con otra forma', async () => {
      for (const data of [
        { activated: 'no', resent: [], skipped: [], noEmail: [] },
        { activated: false, resent: [{ memberId: 'x' }], skipped: [], noEmail: [] },
        { activated: false, resent: [], skipped: [{ ...BETO, nextAt: 'pronto' }], noEmail: [] },
        { activated: false, resent: [], skipped: [], noEmail: [{ name: '' }] },
      ]) {
        vi.mocked(api.post).mockResolvedValue({ data })
        await expect(FinanceRulesService.resend(rulesOrigin, RULE_SET_ID)).rejects.toBeInstanceOf(FinanceRulesContractError)
      }
    })

    it('rechaza la petición de confirmar el correo si no trae lo esperado', async () => {
      for (const data of [{ ok: false, correo: 'a***@e***.com', expiresAt: '2026-10-23T12:00:00.000Z' }, { ok: true, correo: '', expiresAt: '2026-10-23T12:00:00.000Z' }, { ok: true, correo: 'a***@e***.com', expiresAt: 'x' }, null]) {
        vi.mocked(api.put).mockResolvedValue({ data })
        await expect(FinanceRulesService.requestCorreo(rulesOrigin, 'a@b.co')).rejects.toBeInstanceOf(FinanceRulesContractError)
      }
    })

    it('acepta una propuesta abierta con respuestas, objeciones, cambios, y un borrador que viene de otra', async () => {
      const open = ruleSet({
        status: 'en_revision',
        submittedAt: '2026-10-20T16:00:00.000Z',
        inReviewAt: '2026-10-20T17:00:00.000Z',
        approvals: [approval(ANA), approval(BETO, { correo: null, via: 'sesion' })],
        objections: [objection(BETO)],
        changes: [{ topic: 'Reservas', before: 'Se aparta 10 %.', after: 'Se aparta 20 %.' }],
        missing: [],
      })
      const draft = ruleSet({ basedOn: { id: RULE_SET_ID, version: 1, objections: [objection(BETO)] }, version: 2 })
      const link = { sentAt: '2026-10-20T16:00:00.000Z', expiresAt: '2026-10-27T16:00:00.000Z', expired: false, canResendAt: '2026-10-21T16:00:00.000Z' }
      vi.mocked(api.get).mockResolvedValue({
        data: overviewFixture({
          state: 'en_revision',
          proposal: open,
          draft,
          history: [open, ruleSet({ status: 'descartada', discardedAt: '2026-10-21T10:00:00.000Z', closedNote: 'Descartada por Ana.' })],
          partners: [partnerStatus(ANA, { response: 'aprobo', link }), partnerStatus(BETO, { response: 'objeto', hasCorreo: false, correo: null })],
          me: { ...overviewFixture().me, hasCorreo: false, correo: null, pendingCorreo: { correo: 'a***@e***.com', expiresAt: '2026-10-23T12:00:00.000Z' } },
        }),
      })
      await expect(FinanceRulesService.overview(rulesOrigin)).resolves.toMatchObject({ state: 'en_revision' })
    })
  })
})
