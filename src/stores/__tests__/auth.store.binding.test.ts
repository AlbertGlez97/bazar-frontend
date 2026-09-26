// Security regression: an account bound to a member (a colaborador or socio
// created through POST /members) must never be able to act as anybody else. The
// server refuses another x-member-id, and the frontend must not even offer the
// choice: the bound member is fetched from GET /auth/me and forced into the
// session, overwriting anything stored (or forged) beforehand.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../auth.store'
import { useSessionStore } from '../session.store'
import AuthService from '@/services/auth.service'
import { getSettingsItems } from '@/layouts/settings-items'
import { getNavItems } from '@/layouts/nav-items'
import type { AccountBinding } from '@/types/auth.types'
import type { Member } from '@/types/member.types'

vi.mock('@/services/auth.service', () => ({ default: { login: vi.fn(), me: vi.fn() } }))

const CACHE_KEY = 'account_binding'
const loginResponse = { accessToken: 'jwt-token', tokenType: 'Bearer', expiresIn: 3600 }

const colaborador: Member = { id: 'm-col', name: 'Carla', role: 'colaborador', active: true }
const socio: Member = { id: 'm-soc', name: 'Alberto', role: 'socio', active: true }

const bound = (member: Member): AccountBinding => ({ username: 'carla@correo.com', memberId: member.id, member })
const shared: AccountBinding = { username: 'alberto', memberId: null, member: null }

function forgeSocioInSession() {
  sessionStorage.setItem('member_context', JSON.stringify(socio))
}
function seedSession(username = 'carla@correo.com') {
  localStorage.setItem('access_token', 'jwt-token')
  localStorage.setItem('token_expires_at', String(Date.now() + 60_000))
  localStorage.setItem('auth_username', username)
}
const networkError = () => Object.assign(new Error('Network Error'), { response: undefined })
const httpError = (status: number) => ({ response: { status } })

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('login of an account bound to a member', () => {
  it('a bound colaborador: fetches /auth/me, becomes "bound" and the session member is THEIR member', async () => {
    vi.mocked(AuthService.login).mockResolvedValue(loginResponse)
    vi.mocked(AuthService.me).mockResolvedValue(bound(colaborador))

    const auth = useAuthStore()
    await auth.login({ username: 'carla@correo.com', password: 'secret123' })

    expect(AuthService.me).toHaveBeenCalledOnce()
    expect(auth.bindingStatus).toBe('bound')
    expect(auth.boundMember).toEqual(colaborador)
    const session = useSessionStore()
    expect(session.member).toEqual(colaborador)
    expect(session.memberId).toBe('m-col')
    expect(JSON.parse(sessionStorage.getItem('member_context') ?? 'null')).toEqual(colaborador)
  })

  it('a bound socio gets the socio role from the server, not from anything stored', async () => {
    vi.mocked(AuthService.login).mockResolvedValue(loginResponse)
    vi.mocked(AuthService.me).mockResolvedValue({ username: 'adid', memberId: socio.id, member: socio })

    await useAuthStore().login({ username: 'adid', password: 'secret123' })

    expect(useSessionStore().member?.role).toBe('socio')
    expect(useAuthStore().bindingStatus).toBe('bound')
  })

  it('a member_context forged to a socio BEFORE login is overwritten by the bound colaborador', async () => {
    forgeSocioInSession()
    vi.mocked(AuthService.login).mockResolvedValue(loginResponse)
    vi.mocked(AuthService.me).mockResolvedValue(bound(colaborador))

    await useAuthStore().login({ username: 'carla@correo.com', password: 'secret123' })

    const session = useSessionStore()
    expect(session.member?.role).toBe('colaborador')
    expect(session.memberId).toBe('m-col')
    expect(JSON.parse(sessionStorage.getItem('member_context') ?? 'null').id).toBe('m-col')
  })

  it('the shared business login ("member": null) stays "shared" and keeps whatever the person picked', async () => {
    sessionStorage.setItem('member_context', JSON.stringify(colaborador))
    vi.mocked(AuthService.login).mockResolvedValue(loginResponse)
    vi.mocked(AuthService.me).mockResolvedValue(shared)

    const auth = useAuthStore()
    await auth.login({ username: 'alberto', password: 'secret123' })

    expect(auth.bindingStatus).toBe('shared')
    expect(auth.boundMember).toBeNull()
    expect(useSessionStore().member).toEqual(colaborador)
  })

  it('the login still succeeds when /auth/me cannot be reached: status stays "unknown" (the previous selector flow)', async () => {
    vi.mocked(AuthService.login).mockResolvedValue(loginResponse)
    vi.mocked(AuthService.me).mockRejectedValue(networkError())

    const auth = useAuthStore()
    await auth.login({ username: 'alberto', password: 'secret123' })

    expect(auth.isAuthenticated).toBe(true)
    expect(auth.bindingStatus).toBe('unknown')
  })
})

describe('reload with a stored token (ensureBinding)', () => {
  it('reconciles a tampered member_context: the bound colaborador replaces the forged socio', async () => {
    seedSession()
    forgeSocioInSession()
    vi.mocked(AuthService.me).mockResolvedValue(bound(colaborador))

    const auth = useAuthStore()
    const session = useSessionStore()
    expect(session.member?.role).toBe('socio') // what a fresh store trusts before the guard runs
    await auth.ensureBinding()

    expect(session.member).toEqual(colaborador)
    expect(session.member?.role).toBe('colaborador')
  })

  it('asks the server only once per page load, even if several navigations ask', async () => {
    seedSession()
    vi.mocked(AuthService.me).mockResolvedValue(bound(colaborador))

    const auth = useAuthStore()
    await Promise.all([auth.ensureBinding(), auth.ensureBinding(), auth.ensureBinding()])
    await auth.ensureBinding()

    expect(AuthService.me).toHaveBeenCalledOnce()
  })

  it('does nothing (and never calls the server) without a session', async () => {
    const auth = useAuthStore()
    await auth.ensureBinding()

    expect(AuthService.me).not.toHaveBeenCalled()
    expect(auth.bindingStatus).toBe('unknown')
  })
})

describe('the binding cache (offline support)', () => {
  it('a successful /auth/me stores the binding with the username, and never the token', async () => {
    seedSession()
    vi.mocked(AuthService.me).mockResolvedValue(bound(colaborador))

    await useAuthStore().ensureBinding()

    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null')
    expect(cached).toEqual({ username: 'carla@correo.com', member: colaborador })
    expect(localStorage.getItem(CACHE_KEY)).not.toContain('jwt-token')
  })

  it('offline WITH a cache for the same username: uses it and still overwrites a forged member', async () => {
    seedSession()
    localStorage.setItem(CACHE_KEY, JSON.stringify({ username: 'carla@correo.com', member: colaborador }))
    forgeSocioInSession()
    vi.mocked(AuthService.me).mockRejectedValue(networkError())

    const auth = useAuthStore()
    await auth.ensureBinding()

    expect(auth.bindingStatus).toBe('bound')
    expect(useSessionStore().member).toEqual(colaborador)
  })

  it('a 5xx from the server counts as unreachable and also falls back to the cache', async () => {
    seedSession()
    localStorage.setItem(CACHE_KEY, JSON.stringify({ username: 'carla@correo.com', member: colaborador }))
    vi.mocked(AuthService.me).mockRejectedValue(httpError(503))

    const auth = useAuthStore()
    await auth.ensureBinding()

    expect(auth.bindingStatus).toBe('bound')
  })

  it('offline WITHOUT a cache: keeps the previous behavior ("unknown" -> selector) and leaves the session alone', async () => {
    seedSession()
    sessionStorage.setItem('member_context', JSON.stringify(colaborador))
    vi.mocked(AuthService.me).mockRejectedValue(networkError())

    const auth = useAuthStore()
    await auth.ensureBinding()

    expect(auth.bindingStatus).toBe('unknown')
    expect(useSessionStore().member).toEqual(colaborador)
  })

  it('a cache that belongs to ANOTHER username is never used', async () => {
    seedSession('otra.persona@correo.com')
    localStorage.setItem(CACHE_KEY, JSON.stringify({ username: 'carla@correo.com', member: colaborador }))
    vi.mocked(AuthService.me).mockRejectedValue(networkError())

    const auth = useAuthStore()
    await auth.ensureBinding()

    expect(auth.bindingStatus).toBe('unknown')
    expect(auth.boundMember).toBeNull()
  })

  it.each([
    ['not JSON', '{oops'],
    ['an array', '[]'],
    ['no username', JSON.stringify({ member: colaborador })],
    ['a member without a valid role', JSON.stringify({ username: 'carla@correo.com', member: { id: 'x', name: 'X', role: 'admin', active: true } })],
  ])('a malformed cache (%s) is ignored', async (_label, raw) => {
    seedSession()
    localStorage.setItem(CACHE_KEY, raw)
    vi.mocked(AuthService.me).mockRejectedValue(networkError())

    const auth = useAuthStore()
    await auth.ensureBinding()

    expect(auth.bindingStatus).toBe('unknown')
  })

  it('a 404 (a backend without /auth/me) is NOT unreachable: the cache is not used', async () => {
    seedSession()
    localStorage.setItem(CACHE_KEY, JSON.stringify({ username: 'carla@correo.com', member: colaborador }))
    vi.mocked(AuthService.me).mockRejectedValue(httpError(404))

    const auth = useAuthStore()
    await auth.ensureBinding()

    expect(auth.bindingStatus).toBe('unknown')
  })

  it('an online answer always wins over a stale cache (the account became shared/bound elsewhere)', async () => {
    seedSession('alberto')
    localStorage.setItem(CACHE_KEY, JSON.stringify({ username: 'alberto', member: colaborador }))
    vi.mocked(AuthService.me).mockResolvedValue(shared)

    const auth = useAuthStore()
    await auth.ensureBinding()

    expect(auth.bindingStatus).toBe('shared')
    expect(JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null')).toEqual({ username: 'alberto', member: null })
  })

  it('logout clears the cache, the binding and the member', async () => {
    seedSession()
    vi.mocked(AuthService.me).mockResolvedValue(bound(colaborador))
    const auth = useAuthStore()
    await auth.ensureBinding()

    auth.logout()

    expect(localStorage.getItem(CACHE_KEY)).toBeNull()
    expect(auth.bindingStatus).toBe('unknown')
    expect(auth.boundMember).toBeNull()
    expect(useSessionStore().member).toBeNull()
  })

  it('a 401 from /auth/me logs out and clears the cache', async () => {
    seedSession()
    localStorage.setItem(CACHE_KEY, JSON.stringify({ username: 'carla@correo.com', member: colaborador }))
    vi.mocked(AuthService.me).mockRejectedValue(httpError(401))

    const auth = useAuthStore()
    await auth.ensureBinding()

    expect(auth.isAuthenticated).toBe(false)
    expect(localStorage.getItem(CACHE_KEY)).toBeNull()
    expect(auth.bindingStatus).toBe('unknown')
  })

  it('after logout the next login asks the server again (no memoized answer from the previous person)', async () => {
    seedSession()
    vi.mocked(AuthService.me).mockResolvedValueOnce(bound(colaborador)).mockResolvedValueOnce(shared)
    vi.mocked(AuthService.login).mockResolvedValue(loginResponse)
    const auth = useAuthStore()
    await auth.ensureBinding()
    auth.logout()

    await auth.login({ username: 'alberto', password: 'secret123' })

    expect(AuthService.me).toHaveBeenCalledTimes(2)
    expect(auth.bindingStatus).toBe('shared')
  })
})

describe('a deactivated or unusable bound member', () => {
  it('member.active === false: status "inactive", the session member is cleared and never set', async () => {
    seedSession()
    sessionStorage.setItem('member_context', JSON.stringify(socio))
    vi.mocked(AuthService.me).mockResolvedValue(bound({ ...colaborador, active: false }))

    const auth = useAuthStore()
    await auth.ensureBinding()

    expect(auth.bindingStatus).toBe('inactive')
    expect(useSessionStore().member).toBeNull()
    expect(sessionStorage.getItem('member_context')).toBeNull()
  })

  it('a memberId without a usable member object fails CLOSED ("inactive"), never "shared"', async () => {
    seedSession()
    vi.mocked(AuthService.me).mockResolvedValue({ username: 'carla@correo.com', memberId: 'm-col', member: null })

    const auth = useAuthStore()
    await auth.ensureBinding()

    expect(auth.bindingStatus).toBe('inactive')
    expect(useSessionStore().member).toBeNull()
  })

  it('a member whose id differs from memberId also fails closed', async () => {
    seedSession()
    vi.mocked(AuthService.me).mockResolvedValue({ username: 'x', memberId: 'm-OTHER', member: colaborador })

    const auth = useAuthStore()
    await auth.ensureBinding()

    expect(auth.bindingStatus).toBe('inactive')
    expect(useSessionStore().member).toBeNull()
  })
})

describe('what a bound colaborador can see even if member_context was forged to a socio', () => {
  it('no socio menu entries (settings, navigation) after the binding is reconciled', async () => {
    seedSession()
    forgeSocioInSession()
    vi.mocked(AuthService.me).mockResolvedValue(bound(colaborador))

    await useAuthStore().ensureBinding()

    const isSocio = useSessionStore().member?.role === 'socio'
    expect(isSocio).toBe(false)
    const settingsRoutes = getSettingsItems({ isSocio }).map((item) => item.to)
    expect(settingsRoutes).toEqual(['/app/ajustes/contrasena'])
    const navRoutes = getNavItems('gestion', { isSocio }).map((item) => item.to)
    expect(navRoutes).not.toContain('/app/reportes')
  })
})
