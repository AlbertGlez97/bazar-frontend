import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../api'
import { AgreementContractError, AgreementsService, MemberEmailService } from '../agreements.service'

vi.mock('../api', () => ({ default: { post: vi.fn() } }))

const TOKEN = 'dG9rZW4tZGUtcHJ1ZWJhLWRlLTMyLWJ5dGVzLWJhc2U2NHVybA'
const page = (over = {}) => ({
  state: 'pendiente',
  message: null,
  business: 'Bazar Sol',
  memberName: 'Beto',
  proposerName: 'Ana',
  version: 2,
  submittedAt: '2026-10-20T16:00:00.000Z',
  expiresAt: '2026-10-27T16:00:00.000Z',
  rules: ['La utilidad va 100 % por ser socio.'],
  warnings: [{ code: 'RESERVES_HIGH', message: 'Apartas la mitad.' }],
  changes: [{ topic: 'Reservas', before: 'Se aparta 10 %.', after: 'Se aparta 20 %.' }],
  approvedBy: ['Ana'],
  waitingFor: ['Beto'],
  ...over,
})

beforeEach(() => vi.clearAllMocks())

describe('AgreementsService (página pública, sin sesión)', () => {
  it('inspect manda el token en el cuerpo (nunca en la URL) y devuelve la página', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: page() })

    await expect(AgreementsService.inspect(TOKEN)).resolves.toEqual(page())
    expect(api.post).toHaveBeenCalledWith('/agreements/inspect', { token: TOKEN })
  })

  it('acepta una propuesta en revisión, sin fecha de envío y sin cambios', async () => {
    const review = page({ state: 'en_revision', message: 'Esta propuesta está en revisión.', submittedAt: null, changes: null })
    vi.mocked(api.post).mockResolvedValue({ data: review })
    await expect(AgreementsService.inspect(TOKEN)).resolves.toEqual(review)
  })

  it.each([
    ['un estado desconocido', page({ state: 'otro' })],
    ['sin nombre del negocio', page({ business: '' })],
    ['sin nombre de quien responde', page({ memberName: '' })],
    ['sin nombre de quien propuso', page({ proposerName: '' })],
    ['una versión que no es un número', page({ version: 'dos' })],
    ['una fecha de envío inválida', page({ submittedAt: 'ayer' })],
    ['una fecha de vencimiento inválida', page({ expiresAt: 'pronto' })],
    ['un mensaje vacío', page({ message: '' })],
    ['reglas que no son texto', page({ rules: [1, 2] })],
    ['aprobados que no son texto', page({ approvedBy: [''] })],
    ['faltantes que no son una lista', page({ waitingFor: 'Beto' })],
    ['avisos con otra forma', page({ warnings: [{ code: 'X' }] })],
    ['cambios con otra forma', page({ changes: [{ topic: 'x' }] })],
    ['nada', null],
  ])('rechaza %s', async (_name, data) => {
    vi.mocked(api.post).mockResolvedValue({ data })
    await expect(AgreementsService.inspect(TOKEN)).rejects.toBeInstanceOf(AgreementContractError)
  })

  it('respond manda la decisión; el motivo solo viaja al objetar', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { outcome: 'aprobada' } })
    await expect(AgreementsService.respond(TOKEN, 'approve', 'esto no debe viajar')).resolves.toEqual({ outcome: 'aprobada' })
    expect(api.post).toHaveBeenLastCalledWith('/agreements/respond', { token: TOKEN, decision: 'approve' })

    vi.mocked(api.post).mockResolvedValue({ data: { outcome: 'objetada' } })
    await AgreementsService.respond(TOKEN, 'object', 'Más reservas')
    expect(api.post).toHaveBeenLastCalledWith('/agreements/respond', { token: TOKEN, decision: 'object', reason: 'Más reservas' })
  })

  it.each(['aprobada', 'vigente', 'objetada', 'en_revision'])('acepta el resultado %s', async (outcome) => {
    vi.mocked(api.post).mockResolvedValue({ data: { outcome } })
    await expect(AgreementsService.respond(TOKEN, 'approve')).resolves.toEqual({ outcome })
  })

  it('rechaza un resultado desconocido o una respuesta vacía', async () => {
    for (const data of [{ outcome: 'quizá' }, {}, null]) {
      vi.mocked(api.post).mockResolvedValue({ data })
      await expect(AgreementsService.respond(TOKEN, 'approve')).rejects.toBeInstanceOf(AgreementContractError)
    }
  })
})

describe('MemberEmailService (confirmar el correo, sin sesión)', () => {
  const preview = { memberName: 'Ana', correo: 'a***@e***.com', expiresAt: '2026-10-23T17:59:00.000Z' }

  it('inspect manda el token en el cuerpo y devuelve a quién pertenece el correo', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: preview })
    await expect(MemberEmailService.inspect(TOKEN)).resolves.toEqual(preview)
    expect(api.post).toHaveBeenCalledWith('/member-emails/inspect', { token: TOKEN })
  })

  it('confirm devuelve el correo enmascarado', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ok: true, correo: 'a***@e***.com' } })
    await expect(MemberEmailService.confirm(TOKEN)).resolves.toEqual({ correo: 'a***@e***.com' })
    expect(api.post).toHaveBeenCalledWith('/member-emails/confirm', { token: TOKEN })
  })

  it('rechaza respuestas con otra forma', async () => {
    for (const data of [{ ...preview, memberName: '' }, { ...preview, correo: '' }, { ...preview, expiresAt: 'x' }, null]) {
      vi.mocked(api.post).mockResolvedValue({ data })
      await expect(MemberEmailService.inspect(TOKEN)).rejects.toBeInstanceOf(AgreementContractError)
    }
    for (const data of [{ ok: false, correo: 'a***@e***.com' }, { ok: true, correo: '' }, null]) {
      vi.mocked(api.post).mockResolvedValue({ data })
      await expect(MemberEmailService.confirm(TOKEN)).rejects.toBeInstanceOf(AgreementContractError)
    }
  })
})
