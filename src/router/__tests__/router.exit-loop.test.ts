// Salir de /seleccionar-contexto no debe dejar bucles: login → seleccionar-contexto → login.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '../index'
import { useAuthStore } from '@/stores/auth.store'
import { useSessionStore } from '@/stores/session.store'
import AuthService from '@/services/auth.service'

vi.mock('@/services/auth.service', () => ({ default: { login: vi.fn(), me: vi.fn() } }))
vi.stubGlobal('scrollTo', vi.fn())

const TOKEN = 'a.' + btoa(JSON.stringify({ sub: 'account-a' })) + '.z'
const member = { id: 'm-1', name: 'Ana', role: 'socio' as const, active: true }
let router: ReturnType<typeof createAppRouter>

function signIn(bound: boolean) {
  localStorage.setItem('access_token', TOKEN)
  localStorage.setItem('token_expires_at', String(Date.now() + 60_000))
  vi.mocked(AuthService.me).mockResolvedValue(
    bound ? { username: 'ana@x.test', memberId: member.id, member } : { username: 'compartido', memberId: null, member: null },
  )
}
/** Registra cada ruta que se visita, para detectar rebotes. */
function trackVisits() {
  const visited: string[] = []
  router.afterEach((to) => { visited.push(String(to.name)) })
  return visited
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setActivePinia(createPinia())
  router = createAppRouter(createMemoryHistory())
})

describe.each([['cuenta compartida', false], ['cuenta personal', true]])('salir desde /seleccionar-contexto (%s)', (_label, bound) => {
  it('sin dispositivo, la app lleva a la pantalla de contexto; al salir, cualquier ruta protegida lleva al login y se queda ahí', async () => {
    signIn(bound)
    const visited = trackVisits()
    await router.push('/app')
    expect(router.currentRoute.value.name).toBe('SelectContext')

    useAuthStore().logout()
    await router.push({ name: 'Login' })

    for (const path of ['/app', '/app/ajustes', '/seleccionar-contexto', '/login']) {
      await router.push(path)
      expect(router.currentRoute.value.name, path).toBe('Login')
    }
    // Una sola visita a la pantalla de contexto y ningún vaivén después de salir.
    expect(visited.filter((n) => n === 'SelectContext')).toHaveLength(1)
    expect(visited.slice(visited.lastIndexOf('SelectContext') + 1).every((n) => n === 'Login')).toBe(true)
  })

  it('atrás desde el login tras salir no devuelve a la pantalla de contexto', async () => {
    signIn(bound)
    await router.push('/app')
    useAuthStore().logout()
    await router.push({ name: 'Login' })
    router.back()
    await new Promise((r) => setTimeout(r, 0))
    expect(['Login', 'SelectContext']).toContain(String(router.currentRoute.value.name))
    // Aunque el historial vuelva atrás, sin sesión la ruta protegida redirige al login.
    await router.push('/seleccionar-contexto')
    expect(router.currentRoute.value.name).toBe('Login')
  })

  it('salir conserva el dispositivo identificado de la cuenta y borra la persona elegida', async () => {
    signIn(bound)
    const session = useSessionStore()
    session.setDevice({ deviceId: 'd-1', name: 'Tablet', deviceToken: 'tok' })
    session.setMember(member)
    useAuthStore().logout()

    expect(session.memberId).toBeNull()
    expect(session.deviceId).toBeNull() // no hay sesión: nada se muestra
    // …pero el dispositivo sigue guardado para cuando esa cuenta vuelva.
    expect(localStorage.getItem('device_contexts')).toContain('d-1')
    signIn(bound)
    setActivePinia(createPinia())
    expect(useSessionStore().deviceId).toBe('d-1')
  })

  it('volver a entrar con la misma cuenta tras salir lleva a la pantalla de contexto una sola vez, sin rebotar', async () => {
    signIn(bound)
    await router.push('/app')
    useAuthStore().logout()
    await router.push({ name: 'Login' })

    // Entrar de nuevo (la app se recarga: tienda y router nuevos, almacenamiento igual).
    signIn(bound)
    setActivePinia(createPinia())
    router = createAppRouter(createMemoryHistory())
    const visited = trackVisits()
    await router.push('/app')
    expect(router.currentRoute.value.name).toBe('SelectContext')
    expect(visited).toEqual(['SelectContext'])
  })
})
