import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../api'
import { AccountInvitationsContractError, AccountInvitationsService } from '../account-invitations.service'
import { rulesOrigin } from './finance-rules.fixture'

const selection = vi.hoisted(() => ({ current: {} as typeof rulesOrigin }))
vi.mock('../queue-origin', () => ({ currentQueueOrigin: () => selection.current }))
vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

const TOKEN = 'dG9rZW4tZGUtcHJ1ZWJhLWRlLTMyLWJ5dGVzLWJhc2U2NHVybA'
const MEMBER = '0190aaaa-0000-7000-8000-000000000002'
const headers = { 'x-device-id': rulesOrigin.deviceId }
const info = { email: 'beto@example.test', sentAt: '2026-10-20T17:59:00.000Z', expiresAt: '2026-10-23T17:59:00.000Z', canResendAt: '2026-10-20T18:00:00.000Z', resendsLeftToday: 2 }
const statusRow = (over = {}) => ({ memberId: MEMBER, name: 'Beto', hasPersonalAccount: false, invite: { allowed: true, reason: null }, invitation: info, ...over })

beforeEach(() => {
  vi.clearAllMocks()
  selection.current = { ...rulesOrigin }
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

describe('página pública', () => {
  it('inspect manda el token en el cuerpo (nunca en la URL) y devuelve a quién va la invitación', async () => {
    const preview = { memberName: 'Beto', email: 'beto@example.test', expiresAt: '2026-10-23T17:59:00.000Z' }
    vi.mocked(api.post).mockResolvedValue({ data: preview })

    await expect(AccountInvitationsService.inspect(TOKEN)).resolves.toEqual(preview)
    expect(api.post).toHaveBeenCalledWith('/invitations/inspect', { token: TOKEN })
  })

  const DEVICE_TOKEN = 'dG9rZW4tZGUtcHJ1ZWJhLTMyLWJ5dGVzLWJhc2U2NHU'
  const accepted = (over: object = {}) => ({
    ok: true, email: 'beto@example.test', accountId: MEMBER,
    device: { id: '0190aaaa-0000-7000-8000-0000000000d1', identifier: '0190aaaa-0000-7000-8000-0000000000d2', name: 'Dispositivo de Beto', token: DEVICE_TOKEN },
    ...over,
  })

  it('accept manda token y contraseña y devuelve la cuenta y el dispositivo registrado, sin sesión', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: accepted() })

    const result = await AccountInvitationsService.accept(TOKEN, 'una-clave-larga-1')

    expect(result).toEqual({
      email: 'beto@example.test',
      accountId: MEMBER,
      device: { deviceId: '0190aaaa-0000-7000-8000-0000000000d1', name: 'Dispositivo de Beto', deviceToken: DEVICE_TOKEN },
    })
    // El identificador de un solo uso ya está gastado: no se devuelve ni se guarda.
    expect(JSON.stringify(result)).not.toContain('0190aaaa-0000-7000-8000-0000000000d2')
    expect(api.post).toHaveBeenCalledWith('/invitations/accept', { token: TOKEN, password: 'una-clave-larga-1' })
  })

  it.each([
    ['sin dispositivo', { device: undefined }],
    ['dispositivo sin token', { device: { ...accepted().device, token: '' } }],
    ['token con otra forma', { device: { ...accepted().device, token: 'corto' } }],
    ['dispositivo sin nombre', { device: { ...accepted().device, name: '' } }],
    ['id de dispositivo que no es UUID', { device: { ...accepted().device, id: 'x' } }],
    ['sin cuenta', { accountId: undefined }],
    ['cuenta que no es UUID', { accountId: 'x' }],
  ])('accept rechaza una respuesta %s', async (_name, over) => {
    vi.mocked(api.post).mockResolvedValue({ data: accepted(over) })
    await expect(AccountInvitationsService.accept(TOKEN, 'una-clave-larga-1')).rejects.toBeInstanceOf(AccountInvitationsContractError)
  })

  it.each([
    ['inspect sin nombre', () => AccountInvitationsService.inspect(TOKEN), { memberName: '', email: 'a@b.co', expiresAt: '2026-10-23T17:59:00.000Z' }],
    ['inspect con fecha inválida', () => AccountInvitationsService.inspect(TOKEN), { memberName: 'Beto', email: 'a@b.co', expiresAt: 'ayer' }],
    ['accept sin ok', () => AccountInvitationsService.accept(TOKEN, 'una-clave-larga-1'), { email: 'a@b.co' }],
    ['accept sin correo', () => AccountInvitationsService.accept(TOKEN, 'una-clave-larga-1'), { ok: true, email: '' }],
  ])('respuesta rota: %s', async (_name, run, data) => {
    vi.mocked(api.post).mockResolvedValue({ data })
    await expect(run()).rejects.toBeInstanceOf(AccountInvitationsContractError)
  })
})

describe('equipo (solo socios)', () => {
  it('status pide la lista con la identidad del socio y valida cada fila', async () => {
    const blocked = { allowed: false, reason: 'Tu acceso es compartido y ya hay cuentas personales. Pídele a un socio con cuenta personal que te invite.' }
    vi.mocked(api.get).mockResolvedValue({ data: [statusRow({ invite: blocked }), statusRow({ memberId: rulesOrigin.memberId, name: 'Ana', hasPersonalAccount: true, invite: { allowed: false, reason: null }, invitation: null })] })

    const list = await AccountInvitationsService.status(rulesOrigin)

    expect(list).toHaveLength(2)
    expect(api.get).toHaveBeenCalledWith('/members/account-status', expect.objectContaining({ headers }))
  })

  it.each([
    ['no es lista', { x: 1 }],
    ['fila sin nombre', [statusRow({ name: '' })]],
    ['invitación con envíos negativos', [statusRow({ invitation: { ...info, resendsLeftToday: -1 } })]],
    ['invitación con fecha mala', [statusRow({ invitation: { ...info, expiresAt: 'x' } })]],
    ['sin booleano de cuenta', [statusRow({ hasPersonalAccount: 'si' })]],
    ['sin saber si se puede invitar', [statusRow({ invite: undefined })]],
    ['permiso de invitar que no es booleano', [statusRow({ invite: { allowed: 'si', reason: null } })]],
    ['razón vacía en vez de nula', [statusRow({ invite: { allowed: false, reason: '' } })]],
  ])('status rechaza: %s', async (_name, data) => {
    vi.mocked(api.get).mockResolvedValue({ data })
    await expect(AccountInvitationsService.status(rulesOrigin)).rejects.toBeInstanceOf(AccountInvitationsContractError)
  })

  it('invite manda solo el correo a la ruta del socio', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ok: true, expiresAt: '2026-10-23T17:59:00.000Z' } })

    await expect(AccountInvitationsService.invite(rulesOrigin, MEMBER, 'beto@example.test')).resolves.toEqual({ expiresAt: '2026-10-23T17:59:00.000Z' })
    expect(api.post).toHaveBeenCalledWith(`/members/${MEMBER}/invitation`, { email: 'beto@example.test' }, expect.objectContaining({ headers }))
  })

  it('invite no sale a la red con un id que no es UUID, sin conexión o si cambió la selección', async () => {
    await expect(AccountInvitationsService.invite(rulesOrigin, '../x', 'a@b.co')).rejects.toThrow('Invalid member id')
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    await expect(AccountInvitationsService.invite(rulesOrigin, MEMBER, 'a@b.co')).rejects.toThrow('require a connection')
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    selection.current = { ...rulesOrigin, memberId: '0190aaaa-0000-7000-8000-000000000099' }
    await expect(AccountInvitationsService.invite(rulesOrigin, MEMBER, 'a@b.co')).rejects.toThrow('no longer matches')
    expect(api.post).not.toHaveBeenCalled()
  })

  it('invite rechaza una respuesta sin fecha de vencimiento', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ok: true } })
    await expect(AccountInvitationsService.invite(rulesOrigin, MEMBER, 'a@b.co')).rejects.toBeInstanceOf(AccountInvitationsContractError)
  })
})
