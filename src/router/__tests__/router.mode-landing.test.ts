import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '../index'
import { landingFor } from '../landing'
import { useSessionStore } from '@/stores/session.store'
import { useUiModeStore } from '@/stores/uiMode.store'
import AuthService from '@/services/auth.service'
import type { UiMode } from '@/types/ui-mode.types'

// GET /auth/me: login compartido (sin miembro propio) para que estos tests solo prueben el aterrizaje por modo.
vi.mock('@/services/auth.service', () => ({ default: { login: vi.fn(), me: vi.fn() } }))
vi.stubGlobal('scrollTo', vi.fn())

let router: ReturnType<typeof createAppRouter>
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setActivePinia(createPinia())
  vi.mocked(AuthService.me).mockResolvedValue({ username: 'x', memberId: null, member: null })
  router = createAppRouter(createMemoryHistory())
})

function fullSession(role: 'socio' | 'colaborador', mode: UiMode) {
  localStorage.setItem('access_token', 'token')
  localStorage.setItem('token_expires_at', String(Date.now() + 60_000))
  const session = useSessionStore()
  session.setDevice({ deviceId: 'd-1', name: 'Shared tablet' })
  session.setMember({ id: 'm-1', name: 'Alberto', role, active: true })
  useUiModeStore().setMode(mode)
}

describe('landingFor — a página de inicio de cada modo', () => {
  it('Modo Venta aterriza en Vender', () => {
    expect(landingFor('venta')).toEqual({ name: 'Sale' })
  })
  it('Modo Gestión aterriza en Inicio', () => {
    expect(landingFor('gestion')).toEqual({ name: 'AppHome' })
  })
})

describe('"Inicio" solo existe en Modo Gestión', () => {
  it('declara `requiresGestion` en su meta', () => {
    expect(router.resolve('/app').meta.requiresGestion).toBe(true)
  })

  it('en Modo Gestión /app abre Inicio', async () => {
    fullSession('socio', 'gestion')
    await router.push('/app')
    expect(router.currentRoute.value.name).toBe('AppHome')
  })

  it.each(['socio', 'colaborador'] as const)('en Modo Venta, un %s que escribe /app llega a Vender', async (role) => {
    fullSession(role, 'venta')
    await router.push('/app')
    expect(router.currentRoute.value.name).toBe('Sale')
    expect(router.currentRoute.value.path).toBe('/app/venta')
  })

  it('en Modo Venta, /app/ (con diagonal final) también lleva a Vender', async () => {
    fullSession('socio', 'venta')
    await router.push('/app/')
    expect(router.currentRoute.value.name).toBe('Sale')
  })
})

describe('aterrizaje por modo tras iniciar sesión o volver a abrir la app', () => {
  it.each(['/', '/login', '/unknown', '/seleccionar-contexto'])('Modo Gestión: %s → Inicio', async (path) => {
    fullSession('socio', 'gestion')
    await router.push(path)
    expect(router.currentRoute.value.name).toBe('AppHome')
  })

  it.each(['/', '/login', '/unknown', '/seleccionar-contexto'])('Modo Venta: %s → Vender', async (path) => {
    fullSession('socio', 'venta')
    await router.push(path)
    expect(router.currentRoute.value.name).toBe('Sale')
  })
})

describe('las redirecciones por rol o por modo también respetan el modo', () => {
  it.each(['/app/ajustes/equipo', '/app/ajustes/dispositivos', '/app/reportes'])(
    'un colaborador en Modo Venta que escribe %s llega a Vender',
    async (path) => {
      fullSession('colaborador', 'venta')
      await router.push(path)
      expect(router.currentRoute.value.name).toBe('Sale')
    },
  )

  it.each(['/app/ajustes/equipo', '/app/ajustes/dispositivos', '/app/reportes'])(
    'un colaborador en Modo Gestión que escribe %s llega a Inicio',
    async (path) => {
      fullSession('colaborador', 'gestion')
      await router.push(path)
      expect(router.currentRoute.value.name).toBe('AppHome')
    },
  )

  it('un socio en Modo Venta que escribe /app/reportes llega a Vender (sin bucles)', async () => {
    fullSession('socio', 'venta')
    await router.push('/app/reportes')
    expect(router.currentRoute.value.name).toBe('Sale')
  })
})

describe('lo que no cambia', () => {
  it.each(['venta', 'gestion'] as const)('Vender se alcanza en Modo %s', async (mode) => {
    fullSession('colaborador', mode)
    await router.push('/app/venta')
    expect(router.currentRoute.value.name).toBe('Sale')
  })

  it.each(['venta', 'gestion'] as const)('Ajustes se alcanza en Modo %s', async (mode) => {
    fullSession('colaborador', mode)
    await router.push('/app/ajustes')
    expect(router.currentRoute.value.name).toBe('Settings')
  })

  it('Productos sigue existiendo como ruta en Modo Venta (solo se quitó del menú)', async () => {
    fullSession('colaborador', 'venta')
    await router.push('/app/productos')
    expect(router.currentRoute.value.name).toBe('ProductCatalog')
  })

  it('sin sesión, /app manda a iniciar sesión sin importar el modo', async () => {
    useUiModeStore().setMode('venta')
    await router.push('/app')
    expect(router.currentRoute.value.name).toBe('Login')
  })
})
