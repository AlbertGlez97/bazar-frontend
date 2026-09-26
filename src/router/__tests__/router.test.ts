import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '../index'
import { useAuthStore } from '@/stores/auth.store'
import { useSessionStore } from '@/stores/session.store'
import { useUiModeStore } from '@/stores/uiMode.store'
vi.stubGlobal('scrollTo', vi.fn())
// A new router (with its own in-memory history) per test: the app router is a
// module singleton whose current route would leak from one test to the next.
let router: ReturnType<typeof createAppRouter>
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setActivePinia(createPinia())
  router = createAppRouter(createMemoryHistory())
})
// Helper: deja la sesión de auth "lista" (token válido) sin tocar el contexto
// (deviceId/memberId), para probar el guard de /app por separado del de /login.
function restoreAuthSession() {
  localStorage.setItem('access_token', 'token')
  localStorage.setItem('token_expires_at', String(Date.now() + 60_000))
}
// Helper: deja también el contexto (dispositivo + persona) listo, como si el
// usuario ya hubiera pasado por /seleccionar-contexto en esta sesión.
function restoreFullSession() {
  restoreAuthSession()
  const session = useSessionStore()
  session.setDevice({ deviceId: 'd-1', name: 'Shared tablet' })
  session.setMember({ id: 'm-1', name: 'Alberto', role: 'socio', active: true })
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
  })
  it.each(['/', '/unknown', '/login'])('sends restored-session %s to shell', async (path) => {
    restoreFullSession()
    await router.push(path); expect(router.currentRoute.value.name).toBe('AppHome')
  })
  it('sends an expired-session visitor to login instead of the shell', async () => {
    localStorage.setItem('access_token', 'token')
    localStorage.setItem('token_expires_at', String(Date.now() - 1_000))
    await router.push('/app'); expect(router.currentRoute.value.name).toBe('Login')
  })
  // Nuevo: sesión válida pero SIN device/member elegidos aún — /app debe
  // mandar a la pantalla de selección de contexto, no dejar entrar directo.
  it('sends an authenticated visitor without device/member to /seleccionar-contexto', async () => {
    restoreAuthSession()
    await router.push('/app'); expect(router.currentRoute.value.name).toBe('SelectContext')
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
    session.setMember({ id: 'm-1', name: 'Alberto', role: 'socio', active: true })
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
    session.setMember({ id: 'm-1', name: 'Alberto', role, active: true })
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
  it('sends a socio in Modo Venta to the app home', async () => {
    fullSession('socio', 'venta')
    await router.push('/app/reportes'); expect(router.currentRoute.value.name).toBe('AppHome')
  })
  it('sends a colaborador in Modo Venta to the app home', async () => {
    fullSession('colaborador', 'venta')
    await router.push('/app/reportes'); expect(router.currentRoute.value.name).toBe('AppHome')
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

// Ajustes: el menú y "Cambiar mi contraseña" son de cualquier persona con contexto
// listo (en cualquier modo); las pantallas de socios declaran `requiresSocio`.
describe('settings routes /app/ajustes', () => {
  function fullSession(role: 'socio' | 'colaborador', mode: 'gestion' | 'venta' = 'venta') {
    restoreAuthSession()
    const session = useSessionStore()
    session.setDevice({ deviceId: 'd-1', name: 'Shared tablet' })
    session.setMember({ id: 'm-1', name: 'Alberto', role, active: true })
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
