import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../auth.store'
import { useToastStore } from '../toast.store'
import { useSessionStore } from '../session.store'
import AuthService from '@/services/auth.service'

vi.mock('@/services/auth.service', () => ({ default: { login: vi.fn() } }))

const payload = { username: 'ana', password: 'secret123' }
const validResponse = { accessToken: 'jwt-token', tokenType: 'Bearer', expiresIn: 3600 }

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('auth session (contrato real bazar-api)', () => {
  it('starts logged out', () => {
    expect(useAuthStore().isAuthenticated).toBe(false)
  })

  it('restores a valid, non-expired local session without a request', () => {
    localStorage.setItem('access_token', 'jwt-token')
    localStorage.setItem('token_expires_at', String(Date.now() + 60_000))

    const auth = useAuthStore()
    expect(auth.isAuthenticated).toBe(true)
    expect(AuthService.login).not.toHaveBeenCalled()
  })

  it('treats an expired token as logged out and clears storage', () => {
    localStorage.setItem('access_token', 'jwt-token')
    localStorage.setItem('token_expires_at', String(Date.now() - 1_000))

    const auth = useAuthStore()
    expect(auth.isAuthenticated).toBe(false)
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('token_expires_at')).toBeNull()
  })

  it.each([null, '', '   '])('rejects missing or blank token %s', (token) => {
    if (token !== null) localStorage.setItem('access_token', token)
    localStorage.setItem('token_expires_at', String(Date.now() + 60_000))
    expect(useAuthStore().isAuthenticated).toBe(false)
  })

  it('login exitoso guarda el token y calcula la expiración a partir de expiresIn', async () => {
    vi.mocked(AuthService.login).mockResolvedValue(validResponse)
    const before = Date.now()

    const auth = useAuthStore()
    const pending = auth.login(payload)
    expect(auth.loading).toBe(true)
    await pending

    expect(auth.loading).toBe(false)
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.token).toBe('jwt-token')
    expect(localStorage.getItem('access_token')).toBe('jwt-token')

    const storedExpiry = Number(localStorage.getItem('token_expires_at'))
    // expiresIn=3600s ⇒ el timestamp guardado debe caer ~3600000ms adelante
    expect(storedExpiry).toBeGreaterThanOrEqual(before + 3600_000)
    expect(storedExpiry).toBeLessThanOrEqual(Date.now() + 3600_000)
    expect(auth.expiresAt).toBe(storedExpiry)
  })

  it('login fallido (401) no guarda token y expone el error', async () => {
    vi.mocked(AuthService.login).mockRejectedValue({ response: { status: 401 } })

    const auth = useAuthStore()
    await expect(auth.login(payload)).rejects.toEqual({ response: { status: 401 } })

    expect(auth.loading).toBe(false)
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.token).toBeNull()
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(auth.error).toBe('Usuario o contraseña incorrectos')
  })

  it('login fallido (401) notifica el error vía el store de toasts', async () => {
    vi.mocked(AuthService.login).mockRejectedValue({ response: { status: 401 } })

    const auth = useAuthStore()
    await expect(auth.login(payload)).rejects.toBeTruthy()

    const toast = useToastStore()
    expect(toast.toasts).toHaveLength(1)
    expect(toast.toasts[0]).toMatchObject({ type: 'error', message: 'Usuario o contraseña incorrectos' })
  })

  it('login fallido por error de red usa un mensaje genérico', async () => {
    vi.mocked(AuthService.login).mockRejectedValue(new Error('Network Error'))

    const auth = useAuthStore()
    await expect(auth.login(payload)).rejects.toBeTruthy()
    expect(auth.error).toBe('No se pudo iniciar sesión, intenta de nuevo')
  })

  it('login fallido usa el mensaje del servidor cuando está disponible', async () => {
    vi.mocked(AuthService.login).mockRejectedValue({
      response: { status: 400, data: { message: 'Usuario bloqueado' } },
    })

    const auth = useAuthStore()
    await expect(auth.login(payload)).rejects.toBeTruthy()
    expect(auth.error).toBe('Usuario bloqueado')
  })

  it.each([
    { accessToken: '', tokenType: 'Bearer', expiresIn: 3600 },
    { accessToken: 't', tokenType: 'Bearer', expiresIn: Number.NaN },
  ])('rechaza respuestas de login incompletas', async (response) => {
    vi.mocked(AuthService.login).mockResolvedValue(response as never)
    const auth = useAuthStore()
    await expect(auth.login(payload)).rejects.toThrow('Invalid login response')
    expect(auth.isAuthenticated).toBe(false)
  })

  it('logout limpia token, expiración y username', async () => {
    vi.mocked(AuthService.login).mockResolvedValue(validResponse)
    const auth = useAuthStore()
    await auth.login(payload)
    expect(auth.isAuthenticated).toBe(true)

    auth.logout()
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.token).toBeNull()
    expect(auth.expiresAt).toBeNull()
    expect(auth.username).toBeNull()
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('token_expires_at')).toBeNull()
    expect(localStorage.getItem('auth_username')).toBeNull()
  })

  it('logout limpia la persona seleccionada pero conserva el dispositivo identificado', async () => {
    const session = useSessionStore()
    session.setDevice({ deviceId: 'd-1', identifier: 'shared-tablet', name: 'Shared tablet' })
    session.setMember({ id: 'm-1', name: 'Alberto', role: 'socio', active: true })

    vi.mocked(AuthService.login).mockResolvedValue(validResponse)
    const auth = useAuthStore()
    await auth.login(payload)

    auth.logout()

    expect(session.memberId).toBeNull()
    expect(session.deviceId).toBe('d-1')
  })
})
