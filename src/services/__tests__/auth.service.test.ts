// Tests de AuthService — contrato real de bazar-api: username/password →
// { accessToken, tokenType, expiresIn }. Sin llamada a /users/me.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AuthService from '../auth.service'
import api from '../api'

vi.mock('../api', () => ({ default: { post: vi.fn(), get: vi.fn() } }))

describe('AuthService.login', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts { username, password } to /auth/login', async () => {
    const response = { accessToken: 'jwt-token', tokenType: 'Bearer', expiresIn: 3600 }
    vi.mocked(api.post).mockResolvedValue({ data: response })

    const payload = { username: 'ana', password: 'secret123' }
    expect(await AuthService.login(payload)).toEqual(response)
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/auth/login', payload)
  })

  it('nunca consulta un endpoint de perfil (/users/me)', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { accessToken: 't', tokenType: 'Bearer', expiresIn: 3600 },
    })
    await AuthService.login({ username: 'ana', password: 'secret123' })
    expect(api.get).not.toHaveBeenCalled()
  })

  it('propaga errores del servidor (ej. 401)', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('Request failed with status code 401'))
    await expect(AuthService.login({ username: 'ana', password: 'wrong' }))
      .rejects.toThrow('401')
  })
})

describe('AuthService.changePassword', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts { currentPassword, newPassword } to /auth/change-password (204, sin cuerpo)', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: '', status: 204 })

    const payload = { currentPassword: 'la-de-hoy-123', newPassword: 'la-de-manana-456' }
    await expect(AuthService.changePassword(payload)).resolves.toBeUndefined()
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/auth/change-password', payload)
  })

  it('propaga el 403 de contraseña actual incorrecta (no es un 401)', async () => {
    vi.mocked(api.post).mockRejectedValue({
      response: { status: 403, data: { message: 'Current password is incorrect' } },
    })
    await expect(
      AuthService.changePassword({ currentPassword: 'mala', newPassword: 'la-de-manana-456' }),
    ).rejects.toMatchObject({ response: { status: 403 } })
  })

  it('propaga el 400 de validación', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 400, data: { message: ['newPassword is too short'] } } })
    await expect(
      AuthService.changePassword({ currentPassword: 'la-de-hoy-123', newPassword: 'corta' }),
    ).rejects.toMatchObject({ response: { status: 400 } })
  })
})

describe('AuthService.me', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GETs /auth/me and returns who the account is and the member it is bound to', async () => {
    const binding = {
      username: 'carla@correo.com',
      memberId: 'm-col',
      member: { id: 'm-col', name: 'Carla', role: 'colaborador', active: true },
    }
    vi.mocked(api.get).mockResolvedValue({ data: binding })

    expect(await AuthService.me()).toEqual(binding)
    expect(api.get).toHaveBeenCalledExactlyOnceWith('/auth/me')
  })

  it('the shared business login comes back without a member', async () => {
    const binding = { username: 'alberto', memberId: null, member: null }
    vi.mocked(api.get).mockResolvedValue({ data: binding })

    expect(await AuthService.me()).toEqual(binding)
  })

  it('propagates server errors (401, 5xx, network) so the caller can tell them apart', async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 401 } })
    await expect(AuthService.me()).rejects.toMatchObject({ response: { status: 401 } })
  })
})
