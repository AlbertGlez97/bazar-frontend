import { reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAccountInvitationsStore } from '../account-invitations.store'
import { rulesOrigin } from '@/services/__tests__/finance-rules.fixture'

const mocks = vi.hoisted(() => ({ status: vi.fn(), invite: vi.fn() }))
vi.mock('@/services/account-invitations.service', () => ({ AccountInvitationsService: mocks }))
const state = reactive({ auth: { token: 't' }, session: {
  owner: { accountId: rulesOrigin.accountId, apiBase: '/api/v1' }, memberId: rulesOrigin.memberId, deviceId: rulesOrigin.deviceId,
  member: { role: 'socio', active: true },
} })
vi.mock('../auth.store', () => ({ useAuthStore: () => state.auth }))
vi.mock('../session.store', () => ({ useSessionStore: () => state.session }))
vi.mock('@/services/queue-origin', () => ({ currentQueueOrigin: () => ({ ...state.session.owner, memberId: state.session.memberId, deviceId: state.session.deviceId }) }))

const MEMBER = '0190aaaa-0000-7000-8000-000000000002'
const rows = [{ memberId: MEMBER, name: 'Beto', hasPersonalAccount: false, invite: { allowed: true, reason: null }, invitation: null }]
const fail = (status: number, code: string, message?: string) => ({ response: { status, data: { code, message } } })

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  state.auth.token = 't'
  state.session.member = { role: 'socio', active: true }
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  mocks.status.mockResolvedValue(rows)
})

describe('account-invitations.store', () => {
  it('carga quién tiene cuenta y quién tiene invitación', async () => {
    const store = useAccountInvitationsStore()
    await store.load()
    expect(store.items).toEqual(rows)
    expect(store.byMember(MEMBER)?.name).toBe('Beto')
    expect(store.byMember('otro')).toBeUndefined()
    expect(store.error).toBe('')
  })

  it('un colaborador no consulta nada', async () => {
    state.session.member = { role: 'colaborador', active: true }
    const store = useAccountInvitationsStore()
    await store.load()
    expect(mocks.status).not.toHaveBeenCalled()
    expect(store.error).toContain('persona socia')
  })

  it('sin conexión lo dice y no envía', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    const store = useAccountInvitationsStore()
    expect(await store.invite(MEMBER, 'beto@example.test')).toBe(false)
    expect(mocks.invite).not.toHaveBeenCalled()
    expect(store.actionError).toContain('conexión')
  })

  it('invitar manda el correo, avisa a dónde fue y vuelve a leer el estado', async () => {
    mocks.invite.mockResolvedValue({ expiresAt: '2026-10-23T17:59:00.000Z' })
    const store = useAccountInvitationsStore()

    expect(await store.invite(MEMBER, 'beto@example.test')).toBe(true)

    expect(mocks.invite).toHaveBeenCalledWith(expect.objectContaining({ memberId: rulesOrigin.memberId }), MEMBER, 'beto@example.test')
    expect(store.sentTo).toBe('beto@example.test')
    expect(mocks.status).toHaveBeenCalledTimes(1)
    expect(store.working).toBe(false)
  })

  it('un rechazo se explica con el mensaje del servidor y no dice que se envió', async () => {
    mocks.invite.mockRejectedValue(fail(422, 'INVITATION_NOT_SENT', 'No pudimos enviar la invitación a ese correo.'))
    const store = useAccountInvitationsStore()

    expect(await store.invite(MEMBER, 'beto@example.test')).toBe(false)

    expect(store.actionError).toBe('No pudimos enviar la invitación a ese correo.')
    expect(store.sentTo).toBe('')
  })

  it('una respuesta vieja de la carga no pisa a la nueva', async () => {
    let late!: (v: unknown) => void
    mocks.status.mockReturnValueOnce(new Promise((r) => { late = r })).mockResolvedValueOnce([])
    const store = useAccountInvitationsStore()
    const first = store.load()
    await store.load()
    late(rows)
    await first
    expect(store.items).toEqual([])
  })

  it('si la carga falla muestra un mensaje sencillo', async () => {
    mocks.status.mockRejectedValue(fail(403, 'X'))
    const store = useAccountInvitationsStore()
    await store.load()
    expect(store.error).toBe('Solo las personas socias pueden invitar.')
  })

  it('reset borra todo', async () => {
    const store = useAccountInvitationsStore()
    await store.load()
    store.reset()
    expect(store.items).toEqual([])
    expect(store.sentTo).toBe('')
  })
})
