// Tests de MembersService — GET /members: solo exige AuthGuard (Bearer),
// no x-member-id/x-device-id (se usa precisamente antes de elegirlos).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MembersService from '../members.service'
import api from '../api'

vi.mock('../api', () => ({ default: { post: vi.fn(), get: vi.fn() } }))

describe('MembersService.list', () => {
  beforeEach(() => vi.clearAllMocks())

  it('hace GET /members y devuelve el array plano', async () => {
    const members = [
      { id: 'm-1', name: 'Alberto', role: 'socio', active: true },
      { id: 'm-2', name: 'Carlos', role: 'colaborador', active: true },
    ]
    vi.mocked(api.get).mockResolvedValue({ data: members })

    expect(await MembersService.list()).toEqual(members)
    expect(api.get).toHaveBeenCalledExactlyOnceWith('/members')
  })

  it('propaga errores del servidor (ej. 401 por token expirado)', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Request failed with status code 401'))
    await expect(MembersService.list()).rejects.toThrow('401')
  })
})
