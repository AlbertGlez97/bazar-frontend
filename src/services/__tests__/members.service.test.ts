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

  it('includeInactive: pide también a las personas desactivadas (solo lo respeta el servidor para socios)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    await MembersService.list({ includeInactive: true })
    expect(api.get).toHaveBeenCalledExactlyOnceWith('/members', { params: { includeInactive: true } })
  })

  it('includeInactive en false o sin opciones no agrega parámetros', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    await MembersService.list({ includeInactive: false })
    await MembersService.list({})
    expect(api.get).toHaveBeenNthCalledWith(1, '/members')
    expect(api.get).toHaveBeenNthCalledWith(2, '/members')
  })
})

describe('MembersService.create (POST /members, solo socios)', () => {
  beforeEach(() => vi.clearAllMocks())

  const payload = { nombre: 'Carlos', apellidos: 'Núñez', correo: 'carlos@example.com', role: 'colaborador' as const, commissionRateBps: 1050 }
  const created = {
    id: 'm-9', name: 'Carlos Núñez', role: 'colaborador', active: true, commissionRateBps: 1050,
    createdByMemberId: 'm-1', username: 'carlos@example.com', credentialsEmail: 'member',
  }

  it('hace POST /members con el cuerpo tal cual y devuelve la persona creada', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: created, status: 201 })
    expect(await MembersService.create(payload)).toEqual(created)
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/members', payload)
  })

  it('un socio nuevo viaja sin commissionRateBps (el servidor lo rechaza aunque sea null)', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ...created, role: 'socio', commissionRateBps: null }, status: 201 })
    const socio = { nombre: 'Ana', apellidos: 'Ruiz', correo: 'ana@example.com', role: 'socio' as const }
    await MembersService.create(socio)
    const sent = vi.mocked(api.post).mock.calls[0][1] as Record<string, unknown>
    expect('commissionRateBps' in sent).toBe(false)
  })

  it.each([400, 403, 409, 502])('propaga el %i para que la vista lo explique', async (status) => {
    vi.mocked(api.post).mockRejectedValue({ response: { status, data: { message: 'x' } } })
    await expect(MembersService.create(payload)).rejects.toMatchObject({ response: { status } })
  })
})
