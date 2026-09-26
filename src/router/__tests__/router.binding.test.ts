// Security regression at the route guard: the role the guards read comes from
// the session member, and for an account bound to a member that member is the
// SERVER's (GET /auth/me), fetched BEFORE any role or context check runs.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '../index'
import { useAuthStore } from '@/stores/auth.store'
import { useSessionStore } from '@/stores/session.store'
import { useUiModeStore } from '@/stores/uiMode.store'
import AuthService from '@/services/auth.service'
import type { AccountBinding } from '@/types/auth.types'
import type { Member } from '@/types/member.types'

vi.mock('@/services/auth.service', () => ({ default: { login: vi.fn(), me: vi.fn() } }))
vi.stubGlobal('scrollTo', vi.fn())

const colaborador: Member = { id: 'm-col', name: 'Carla', role: 'colaborador', active: true }
const socio: Member = { id: 'm-soc', name: 'Alberto', role: 'socio', active: true }
const bound = (member: Member): AccountBinding => ({ username: 'x', memberId: member.id, member })
const shared: AccountBinding = { username: 'x', memberId: null, member: null }

let router: ReturnType<typeof createAppRouter>
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setActivePinia(createPinia())
  vi.clearAllMocks()
  router = createAppRouter(createMemoryHistory())
})

function restoreAuth() {
  localStorage.setItem('access_token', 'token')
  localStorage.setItem('token_expires_at', String(Date.now() + 60_000))
  localStorage.setItem('auth_username', 'x')
}
function restoreContext(member: Member) {
  restoreAuth()
  const session = useSessionStore()
  session.setDevice({ deviceId: 'd-1', name: 'Shared tablet' })
  session.setMember(member)
}

describe('a bound colaborador whose member_context was forged to a socio', () => {
  beforeEach(() => {
    restoreContext(socio) // what the forged sessionStorage looks like
    vi.mocked(AuthService.me).mockResolvedValue(bound(colaborador))
  })

  it.each(['/app/ajustes/equipo', '/app/ajustes/dispositivos'])('%s sends them back to the home screen', async (path) => {
    await router.push(path)
    expect(router.currentRoute.value.name).toBe('AppHome')
  })

  it('/app/reportes (socio + gestion) is out of reach too, even in management mode', async () => {
    useUiModeStore().setMode('gestion')
    await router.push('/app/reportes')
    expect(router.currentRoute.value.name).toBe('AppHome')
  })

  it('the session member is reconciled to the colaborador BEFORE the first role check', async () => {
    await router.push('/app/ajustes/equipo')
    const session = useSessionStore()
    expect(session.member?.role).toBe('colaborador')
    expect(session.memberId).toBe('m-col')
  })

  it('still reaches the screens every person may use (settings, change password, sale)', async () => {
    await router.push('/app/ajustes')
    expect(router.currentRoute.value.name).toBe('Settings')
    await router.push('/app/venta')
    expect(router.currentRoute.value.name).toBe('Sale')
  })
})

describe('a bound socio', () => {
  it('keeps reaching the socio screens', async () => {
    restoreContext(socio)
    vi.mocked(AuthService.me).mockResolvedValue({ username: 'x', memberId: socio.id, member: socio })

    await router.push('/app/ajustes/equipo')
    expect(router.currentRoute.value.name).toBe('Team')
  })
})

describe('a bound account without the context yet', () => {
  it('has the member set by the guard, so only the device is missing -> select-context', async () => {
    restoreAuth()
    vi.mocked(AuthService.me).mockResolvedValue(bound(colaborador))

    await router.push('/app')
    expect(router.currentRoute.value.name).toBe('SelectContext')
    expect(useSessionStore().memberId).toBe('m-col')
  })

  it('with the device already identified it goes straight into the app, skipping select-context', async () => {
    restoreAuth()
    useSessionStore().setDevice({ deviceId: 'd-1', name: 'Shared tablet' })
    vi.mocked(AuthService.me).mockResolvedValue(bound(colaborador))

    await router.push('/seleccionar-contexto')
    expect(router.currentRoute.value.name).toBe('AppHome')
  })
})

describe('the shared business login (no bound member)', () => {
  it('may still hold a socio session and reach the socio screens (legacy behavior untouched)', async () => {
    restoreContext(socio)
    vi.mocked(AuthService.me).mockResolvedValue(shared)

    await router.push('/app/ajustes/equipo')
    expect(router.currentRoute.value.name).toBe('Team')
  })

  it('without a member yet still lands on select-context to choose one', async () => {
    restoreAuth()
    useSessionStore().setDevice({ deviceId: 'd-1', name: 'Shared tablet' })
    vi.mocked(AuthService.me).mockResolvedValue(shared)

    await router.push('/app')
    expect(router.currentRoute.value.name).toBe('SelectContext')
  })
})

describe('deactivated bound member and failures', () => {
  it('an inactive bound member cannot enter the app: /app goes to select-context (which explains why)', async () => {
    restoreContext(colaborador)
    vi.mocked(AuthService.me).mockResolvedValue(bound({ ...colaborador, active: false }))

    await router.push('/app')
    expect(router.currentRoute.value.name).toBe('SelectContext')
    expect(useSessionStore().member).toBeNull()
  })

  it('a 401 from /auth/me ends in the login screen', async () => {
    restoreContext(socio)
    vi.mocked(AuthService.me).mockRejectedValue({ response: { status: 401 } })

    await router.push('/app')
    expect(router.currentRoute.value.name).toBe('Login')
    expect(useAuthStore().isAuthenticated).toBe(false)
  })

  it('unreachable server and no cache: the previous behavior (the session member is used, the server still enforces)', async () => {
    restoreContext(colaborador)
    vi.mocked(AuthService.me).mockRejectedValue(Object.assign(new Error('Network Error'), { response: undefined }))

    await router.push('/app')
    expect(router.currentRoute.value.name).toBe('AppHome')
  })
})

describe('the guard only asks the server when a signed-in person needs a protected route', () => {
  it('never calls /auth/me for a logged-out visitor or for public routes', async () => {
    await router.push('/')
    await router.push('/registro-negocio')
    await router.push('/app')
    expect(AuthService.me).not.toHaveBeenCalled()
  })
})
