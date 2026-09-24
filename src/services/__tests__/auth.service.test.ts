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
