const TEST_TOKEN = 'a.' + btoa(JSON.stringify({ sub: 'account-a' })) + '.z'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '../index'
import { useAuthStore } from '@/stores/auth.store'
import { useSessionStore } from '@/stores/session.store'
import { useUiModeStore } from '@/stores/uiMode.store'
import AuthService from '@/services/auth.service'
// GET /auth/me: el guard lo consulta al entrar a una ruta protegida. Una cuenta = una persona:
// cada test deja que /auth/me devuelva la persona que él mismo pone en la sesión (bindAccount).
vi.mock('@/services/auth.service', () => ({ default: { login: vi.fn(), me: vi.fn() } }))
function bindAccount(role: 'socio' | 'colaborador' = 'socio') {
  const member = { id: 'm-1', name: 'Alberto', role, active: true }
  vi.mocked(AuthService.me).mockResolvedValue({ username: 'x', memberId: member.id, member })
  return member
}
vi.stubGlobal('scrollTo', vi.fn())
// A new router (with its own in-memory history) per test: the app router is a
// module singleton whose current route would leak from one test to the next.
let router: ReturnType<typeof createAppRouter>
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setActivePinia(createPinia())
  bindAccount()
  router = createAppRouter(createMemoryHistory())
})
// Helper: deja la sesión de auth "lista" (token válido) sin tocar el contexto
// (deviceId/memberId), para probar el guard de /app por separado del de /login.
function restoreAuthSession() {
  localStorage.setItem('access_token', TEST_TOKEN)
  localStorage.setItem('token_expires_at', String(Date.now() + 60_000))
}
// Helper: deja también el contexto (dispositivo + persona) listo, como si el
// usuario ya hubiera pasado por /seleccionar-contexto en esta sesión.
function restoreFullSession() {
  restoreAuthSession()
  const session = useSessionStore()
  session.setDevice({ deviceId: 'd-1', name: 'Shared tablet' })
  session.setMember(bindAccount('socio'))
}
describe('session routing', () => {
  // '/' ahora es la landing pública: un visitante sin sesión debe poder verla
  // sin ser redirigido a login (a diferencia del resto de rutas protegidas).
  it('shows the public landing at / when logged out', async () => {
    await router.push('/'); expect(router.currentRoute.value.name).toBe('Landing')
  })
  it.each(['/unknown', '/dashboard', '/register', '/app', '/login', '/seleccionar-contexto'])('sends logged-out %s to login', async (path) => {
    await router.push(path); expect(router.currentRoute.value.name).toBe('Login')
  })
  it('allows logged-out visitors to reach the business registration form', async () => {
    await router.push('/registro-negocio'); expect(router.currentRoute.value.name).toBe('BusinessRegistration')
    await router.push('/verificar-correo?token=abc'); expect(router.currentRoute.value.name).toBe('VerifyEmail')
  })
  it('allows logged-out visitors to open an invitation link, with the token as a path parameter', async () => {
    await router.push('/invitacion/abc_DEF-123')
    expect(router.currentRoute.value.name).toBe('Invitation')
    expect(router.currentRoute.value.params.token).toBe('abc_DEF-123')
  })
  it.each([
    ['/acuerdo/abc_DEF-123', 'Agreement'],
    ['/confirmar-correo/abc_DEF-123', 'ConfirmEmail'],
  ])('allows logged-out visitors to open the emailed link %s, with the token as a path parameter', async (path, name) => {
    await router.push(path)
    expect(router.currentRoute.value.name).toBe(name)
    expect(router.currentRoute.value.params.token).toBe('abc_DEF-123')
  })
  it.each(['/acuerdo/abc_DEF-123', '/confirmar-correo/abc_DEF-123'])('does not redirect a logged-in visitor away from %s', async (path) => {
    restoreFullSession()
    await router.push(path)
    expect(router.currentRoute.value.path).toBe(path)
  })
  it.each(['/', '/unknown', '/login'])('sends restored-session %s to shell', async (path) => {
    restoreFullSession()
    await router.push(path); expect(router.currentRoute.value.name).toBe('AppHome')
  })
  it('sends an expired-session visitor to login instead of the shell', async () => {
    localStorage.setItem('access_token', TEST_TOKEN)
    localStorage.setItem('token_expires_at', String(Date.now() - 1_000))
    await router.push('/app'); expect(router.currentRoute.value.name).toBe('Login')
  })
  // Sesión válida pero SIN dispositivo identificado aún — /app debe mandar a la
  // pantalla de identificación del dispositivo, no dejar entrar directo.
  it('sends an authenticated visitor whose device is not identified to /seleccionar-contexto', async () => {
    restoreAuthSession()
    await router.push('/app'); expect(router.currentRoute.value.name).toBe('SelectContext')
    expect(useAuthStore().bindingStatus).toBe('bound')
  })
  it('sends an authenticated account WITHOUT a person ("unassigned") from /app to /seleccionar-contexto, even with the device identified', async () => {
    restoreAuthSession()
    useSessionStore().setDevice({ deviceId: 'd-1', name: 'Shared tablet' })
    vi.mocked(AuthService.me).mockResolvedValue({ username: 'x', memberId: null, member: null })
    await router.push('/app'); expect(router.currentRoute.value.name).toBe('SelectContext')
    expect(useAuthStore().bindingStatus).toBe('unassigned')
    expect(useSessionStore().isContextReady).toBe(false)
  })
  it('sends an unconfirmed account (/auth/me unreachable, no cache) from /app to /seleccionar-contexto', async () => {
    restoreAuthSession()
    useSessionStore().setDevice({ deviceId: 'd-1', name: 'Shared tablet' })
    vi.mocked(AuthService.me).mockRejectedValue(new Error('Network Error'))
    await router.push('/app'); expect(router.currentRoute.value.name).toBe('SelectContext')
    expect(useAuthStore().bindingStatus).toBe('unknown')
  })
  it('sends an inactive person from /app to /seleccionar-contexto', async () => {
    restoreAuthSession()
    useSessionStore().setDevice({ deviceId: 'd-1', name: 'Shared tablet' })
    vi.mocked(AuthService.me).mockResolvedValue({ username: 'x', memberId: 'm-1', member: { id: 'm-1', name: 'Alberto', role: 'socio', active: false } })
    await router.push('/app'); expect(router.currentRoute.value.name).toBe('SelectContext')
    expect(useAuthStore().bindingStatus).toBe('inactive')
  })
  it('lets a bound account with an identified device straight into /app (no person selector in between)', async () => {
    restoreAuthSession()
    useSessionStore().setDevice({ deviceId: 'd-1', name: 'Shared tablet' })
    await router.push('/app'); expect(router.currentRoute.value.name).toBe('AppHome')
    expect(useSessionStore().memberId).toBe('m-1')
  })
  // Pantalla de venta: alcanzable en cualquier modo (no hay redirecciones sin salida).
  it('allows an authenticated visitor with full context to reach the sale screen /app/venta', async () => {
    restoreFullSession()
    await router.push('/app/venta'); expect(router.currentRoute.value.name).toBe('Sale')
    expect(router.currentRoute.value.path).toBe('/app/venta')
  })
  it('sends a logged-out visitor at /app/venta to login', async () => {
    await router.push('/app/venta'); expect(router.currentRoute.value.name).toBe('Login')
  })
  it('sends an authenticated visitor without device/member from /app/venta to /seleccionar-contexto', async () => {
    restoreAuthSession()
    await router.push('/app/venta'); expect(router.currentRoute.value.name).toBe('SelectContext')
  })
  it('the sale route is a child of the /app layout and is lazy-loaded', () => {
    // La meta se hereda del padre '/app' (auth + contexto): se lee ya resuelta.
    const resolved = router.resolve('/app/venta')
    expect(resolved.meta.requiresAuth).toBe(true)
    expect(resolved.meta.requiresContext).toBe(true)
    expect(resolved.matched.map((r) => r.path)).toEqual(['/app', '/app/venta'])
    const route = router.getRoutes().find((r) => r.name === 'Sale')!
    expect(route.components?.default).toBeTypeOf('function')
  })
  it('allows an authenticated visitor with full context to reach /app', async () => {
    restoreFullSession()
    await router.push('/app'); expect(router.currentRoute.value.name).toBe('AppHome')
  })
  it('sends an authenticated visitor with full context away from /seleccionar-contexto', async () => {
    restoreFullSession()
    await router.push('/seleccionar-contexto'); expect(router.currentRoute.value.name).toBe('AppHome')
  })
  it('allows an authenticated visitor without context to reach /seleccionar-contexto', async () => {
    restoreAuthSession()
    await router.push('/seleccionar-contexto'); expect(router.currentRoute.value.name).toBe('SelectContext')
  })
  it('does not share the current route between router instances', async () => {
    restoreFullSession()
    await router.push('/app')
    const other = createAppRouter(createMemoryHistory())
    expect(router.currentRoute.value.name).toBe('AppHome')
    expect(other.currentRoute.value.name).not.toBe('AppHome')
  })
  it('logout returns to login and prevents shell reentry', async () => {
    const auth = useAuthStore(); auth.token = 't'; auth.expiresAt = Date.now() + 60_000
    const session = useSessionStore()
    session.setDevice({ deviceId: 'd-1', name: 'Shared tablet' })
    session.setMember(bindAccount('socio'))
    await router.push('/app'); auth.logout(); await router.push('/login'); await router.push('/app')
    expect(router.currentRoute.value.name).toBe('Login')
  })
})

// Reportes: solo socios y solo en Modo Gestión (guard por meta, no solo por ocultar el menú).
describe('reports route /app/reportes', () => {
  function fullSession(role: 'socio' | 'colaborador', mode: 'gestion' | 'venta') {
    restoreAuthSession()
    const session = useSessionStore()
    session.setDevice({ deviceId: 'd-1', name: 'Shared tablet' })
    session.setMember(bindAccount(role))
    useUiModeStore().setMode(mode)
  }

  it('lets a socio in Modo Gestión reach it', async () => {
    fullSession('socio', 'gestion')
    await router.push('/app/reportes'); expect(router.currentRoute.value.name).toBe('Reports')
    expect(router.currentRoute.value.path).toBe('/app/reportes')
  })
  it('sends a colaborador (even in Modo Gestión) to the app home', async () => {
    fullSession('colaborador', 'gestion')
    await router.push('/app/reportes'); expect(router.currentRoute.value.name).toBe('AppHome')
  })
  // Regla nueva (Parte 2): "Inicio" no existe en Modo Venta, así que la casa de la
  // app en ese modo es Vender (antes era Inicio). Ver router.mode-landing.test.ts.
  it('sends a socio in Modo Venta to the sale screen (the home of that mode)', async () => {
    fullSession('socio', 'venta')
    await router.push('/app/reportes'); expect(router.currentRoute.value.name).toBe('Sale')
  })
  it('sends a colaborador in Modo Venta to the sale screen (the home of that mode)', async () => {
    fullSession('colaborador', 'venta')
    await router.push('/app/reportes'); expect(router.currentRoute.value.name).toBe('Sale')
  })
  it('sends a logged-out visitor to login', async () => {
    await router.push('/app/reportes'); expect(router.currentRoute.value.name).toBe('Login')
  })
  it('sends an authenticated visitor without device/member to /seleccionar-contexto', async () => {
    restoreAuthSession()
    await router.push('/app/reportes'); expect(router.currentRoute.value.name).toBe('SelectContext')
  })
  it('is a lazy child of the /app layout that declares its restrictions in meta', () => {
    const resolved = router.resolve('/app/reportes')
    expect(resolved.meta).toMatchObject({ requiresAuth: true, requiresContext: true, requiresSocio: true, requiresGestion: true })
    expect(resolved.matched.map((r) => r.path)).toEqual(['/app', '/app/reportes'])
    expect(router.getRoutes().find((r) => r.name === 'Reports')!.components?.default).toBeTypeOf('function')
  })
  it('does not restrict the other app routes', async () => {
    fullSession('colaborador', 'venta')
    await router.push('/app/venta'); expect(router.currentRoute.value.name).toBe('Sale')
    await router.push('/app/productos'); expect(router.currentRoute.value.name).toBe('ProductCatalog')
  })
})

// Incidencias (P2): mismo guard que Reportes/Códigos QR (guard por meta, no solo por ocultar el menú).
describe('incidencias route /app/incidencias', () => {
  function fullSession(role: 'socio' | 'colaborador', mode: 'gestion' | 'venta') {
    restoreAuthSession()
    const session = useSessionStore()
    session.setDevice({ deviceId: 'd-1', name: 'Shared tablet' })
    session.setMember(bindAccount(role))
    useUiModeStore().setMode(mode)
  }

  it('lets a socio in Modo Gestión reach it', async () => {
    fullSession('socio', 'gestion')
    await router.push('/app/incidencias'); expect(router.currentRoute.value.name).toBe('Incidencias')
    expect(router.currentRoute.value.path).toBe('/app/incidencias')
  })
  it('sends a colaborador (even in Modo Gestión) to the app home', async () => {
    fullSession('colaborador', 'gestion')
    await router.push('/app/incidencias'); expect(router.currentRoute.value.name).toBe('AppHome')
  })
  it('sends a socio in Modo Venta to the sale screen (the home of that mode)', async () => {
    fullSession('socio', 'venta')
    await router.push('/app/incidencias'); expect(router.currentRoute.value.name).toBe('Sale')
  })
  it('sends a colaborador in Modo Venta to the sale screen (the home of that mode)', async () => {
    fullSession('colaborador', 'venta')
    await router.push('/app/incidencias'); expect(router.currentRoute.value.name).toBe('Sale')
  })
  it('sends a logged-out visitor to login', async () => {
    await router.push('/app/incidencias'); expect(router.currentRoute.value.name).toBe('Login')
  })
  it('sends an authenticated visitor without device/member to /seleccionar-contexto', async () => {
    restoreAuthSession()
    await router.push('/app/incidencias'); expect(router.currentRoute.value.name).toBe('SelectContext')
  })
  it('is a lazy child of the /app layout that declares its restrictions in meta', () => {
    const resolved = router.resolve('/app/incidencias')
    expect(resolved.meta).toMatchObject({ requiresAuth: true, requiresContext: true, requiresSocio: true, requiresGestion: true })
    expect(resolved.matched.map((r) => r.path)).toEqual(['/app', '/app/incidencias'])
    expect(router.getRoutes().find((r) => r.name === 'Incidencias')!.components?.default).toBeTypeOf('function')
  })
})

// Deudas: mismo guard que Reportes/Códigos QR/Incidencias (guard por meta, no solo por ocultar el menú).
describe('deudas route /app/deudas', () => {
  function fullSession(role: 'socio' | 'colaborador', mode: 'gestion' | 'venta') {
    restoreAuthSession()
    const session = useSessionStore()
    session.setDevice({ deviceId: 'd-1', name: 'Shared tablet' })
    session.setMember(bindAccount(role))
    useUiModeStore().setMode(mode)
  }

  it('lets a socio in Modo Gestión reach it', async () => {
    fullSession('socio', 'gestion')
    await router.push('/app/deudas'); expect(router.currentRoute.value.name).toBe('Deudas')
    expect(router.currentRoute.value.path).toBe('/app/deudas')
  })
  it('sends a colaborador (even in Modo Gestión) to the app home', async () => {
    fullSession('colaborador', 'gestion')
    await router.push('/app/deudas'); expect(router.currentRoute.value.name).toBe('AppHome')
  })
  it('sends a socio in Modo Venta to the sale screen (the home of that mode)', async () => {
    fullSession('socio', 'venta')
    await router.push('/app/deudas'); expect(router.currentRoute.value.name).toBe('Sale')
  })
  it('sends a colaborador in Modo Venta to the sale screen (the home of that mode)', async () => {
    fullSession('colaborador', 'venta')
    await router.push('/app/deudas'); expect(router.currentRoute.value.name).toBe('Sale')
  })
  it('sends a logged-out visitor to login', async () => {
    await router.push('/app/deudas'); expect(router.currentRoute.value.name).toBe('Login')
  })
  it('sends an authenticated visitor without device/member to /seleccionar-contexto', async () => {
    restoreAuthSession()
    await router.push('/app/deudas'); expect(router.currentRoute.value.name).toBe('SelectContext')
  })
  it('is a lazy child of the /app layout that declares its restrictions in meta', () => {
    const resolved = router.resolve('/app/deudas')
    expect(resolved.meta).toMatchObject({ requiresAuth: true, requiresContext: true, requiresSocio: true, requiresGestion: true })
    expect(resolved.matched.map((r) => r.path)).toEqual(['/app', '/app/deudas'])
    expect(router.getRoutes().find((r) => r.name === 'Deudas')!.components?.default).toBeTypeOf('function')
  })
})

// Ajustes: el menú y "Cambiar mi contraseña" son de cualquier persona con contexto
// listo (en cualquier modo); las pantallas de socios declaran `requiresSocio`.
describe('settings routes /app/ajustes', () => {
  function fullSession(role: 'socio' | 'colaborador', mode: 'gestion' | 'venta' = 'venta') {
    restoreAuthSession()
    const session = useSessionStore()
    session.setDevice({ deviceId: 'd-1', name: 'Shared tablet' })
    session.setMember(bindAccount(role))
    useUiModeStore().setMode(mode)
  }

  it.each(['socio', 'colaborador'] as const)('lets a %s reach the settings menu and the password view, in any mode', async (role) => {
    for (const mode of ['venta', 'gestion'] as const) {
      fullSession(role, mode)
      await router.push('/app/ajustes'); expect(router.currentRoute.value.name).toBe('Settings')
      await router.push('/app/ajustes/contrasena'); expect(router.currentRoute.value.name).toBe('ChangePassword')
    }
  })

  it('sends a logged-out visitor to login', async () => {
    await router.push('/app/ajustes'); expect(router.currentRoute.value.name).toBe('Login')
    await router.push('/app/ajustes/contrasena'); expect(router.currentRoute.value.name).toBe('Login')
  })

  it('sends an authenticated visitor without device/member to /seleccionar-contexto', async () => {
    restoreAuthSession()
    await router.push('/app/ajustes/contrasena'); expect(router.currentRoute.value.name).toBe('SelectContext')
  })

  it('does not require a socio, nor Modo Gestión, for the menu and the password view', () => {
    for (const path of ['/app/ajustes', '/app/ajustes/contrasena']) {
      const meta = router.resolve(path).meta
      expect(meta).toMatchObject({ requiresAuth: true, requiresContext: true })
      expect(meta.requiresSocio).toBeUndefined()
      expect(meta.requiresGestion).toBeUndefined()
    }
  })

  it('are lazy children of the /app layout', () => {
    expect(router.resolve('/app/ajustes').matched.map((r) => r.path)).toEqual(['/app', '/app/ajustes'])
    expect(router.resolve('/app/ajustes/contrasena').matched.map((r) => r.path)).toEqual(['/app', '/app/ajustes/contrasena'])
    for (const name of ['Settings', 'ChangePassword']) {
      expect(router.getRoutes().find((r) => r.name === name)!.components?.default).toBeTypeOf('function')
    }
  })
})

// Mi equipo: solo socios (guard por meta, en cualquier modo; no basta con ocultar la entrada).
describe('team route /app/ajustes/equipo', () => {
  function fullSession(role: 'socio' | 'colaborador', mode: 'gestion' | 'venta') {
    restoreAuthSession()
    const session = useSessionStore()
    session.setDevice({ deviceId: 'd-1', name: 'Shared tablet' })
    session.setMember(bindAccount(role))
    useUiModeStore().setMode(mode)
  }

  it.each(['venta', 'gestion'] as const)('lets a socio reach it in Modo %s', async (mode) => {
    fullSession('socio', mode)
    await router.push('/app/ajustes/equipo'); expect(router.currentRoute.value.name).toBe('Team')
  })
  // El destino es la casa del modo: Vender en Modo Venta, Inicio en Modo Gestión.
  it.each([['venta', 'Sale'], ['gestion', 'AppHome']] as const)('sends a colaborador (Modo %s) typing the URL to the home of that mode (%s)', async (mode, home) => {
    fullSession('colaborador', mode)
    await router.push('/app/ajustes/equipo'); expect(router.currentRoute.value.name).toBe(home)
  })
  it('sends a logged-out visitor to login', async () => {
    await router.push('/app/ajustes/equipo'); expect(router.currentRoute.value.name).toBe('Login')
  })
  it('sends an authenticated visitor without device/member to /seleccionar-contexto', async () => {
    restoreAuthSession()
    await router.push('/app/ajustes/equipo'); expect(router.currentRoute.value.name).toBe('SelectContext')
  })
  it('declares requiresSocio (and not requiresGestion) in meta, as a lazy child of /app', () => {
    const resolved = router.resolve('/app/ajustes/equipo')
    expect(resolved.meta).toMatchObject({ requiresAuth: true, requiresContext: true, requiresSocio: true })
    expect(resolved.meta.requiresGestion).toBeUndefined()
    expect(resolved.matched.map((r) => r.path)).toEqual(['/app', '/app/ajustes/equipo'])
    expect(router.getRoutes().find((r) => r.name === 'Team')!.components?.default).toBeTypeOf('function')
  })
  it('the password view stays open to a colaborador', async () => {
    fullSession('colaborador', 'venta')
    await router.push('/app/ajustes/contrasena'); expect(router.currentRoute.value.name).toBe('ChangePassword')
  })
})

// Dispositivos: solo socios, igual que Mi equipo.
describe('devices admin route /app/ajustes/dispositivos', () => {
  function fullSession(role: 'socio' | 'colaborador', mode: 'gestion' | 'venta') {
    restoreAuthSession()
    const session = useSessionStore()
    session.setDevice({ deviceId: 'd-1', name: 'Shared tablet' })
    session.setMember(bindAccount(role))
    useUiModeStore().setMode(mode)
  }

  it.each(['venta', 'gestion'] as const)('lets a socio reach it in Modo %s', async (mode) => {
    fullSession('socio', mode)
    await router.push('/app/ajustes/dispositivos'); expect(router.currentRoute.value.name).toBe('DevicesAdmin')
  })
  it.each([['venta', 'Sale'], ['gestion', 'AppHome']] as const)('sends a colaborador (Modo %s) typing the URL to the home of that mode (%s)', async (mode, home) => {
    fullSession('colaborador', mode)
    await router.push('/app/ajustes/dispositivos'); expect(router.currentRoute.value.name).toBe(home)
  })
  it('sends a logged-out visitor to login', async () => {
    await router.push('/app/ajustes/dispositivos'); expect(router.currentRoute.value.name).toBe('Login')
  })
  it('sends an authenticated visitor without device/member to /seleccionar-contexto', async () => {
    restoreAuthSession()
    await router.push('/app/ajustes/dispositivos'); expect(router.currentRoute.value.name).toBe('SelectContext')
  })
  it('declares requiresSocio (and not requiresGestion) in meta, as a lazy child of /app', () => {
    const resolved = router.resolve('/app/ajustes/dispositivos')
    expect(resolved.meta).toMatchObject({ requiresAuth: true, requiresContext: true, requiresSocio: true })
    expect(resolved.meta.requiresGestion).toBeUndefined()
    expect(resolved.matched.map((r) => r.path)).toEqual(['/app', '/app/ajustes/dispositivos'])
    expect(router.getRoutes().find((r) => r.name === 'DevicesAdmin')!.components?.default).toBeTypeOf('function')
  })
})
