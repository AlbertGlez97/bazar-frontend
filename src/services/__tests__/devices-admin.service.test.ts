// DevicesAdminService — gestión de dispositivos (solo socios): listar, registrar,
// revocar y reemitir. Sin identificador ni token en lo que se guarda.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DevicesAdminService from '../devices-admin.service'
import api from '../api'

vi.mock('../api', () => ({ default: { post: vi.fn(), get: vi.fn(), patch: vi.fn() } }))

const ID = '20000000-0000-4000-8000-000000000001'
const device = {
  id: ID, name: 'Tablet', status: 'pendiente_activacion', legacy: false,
  createdAt: '2026-09-25T18:00:00.000Z', activatedAt: null, revokedAt: null, identifier: '0190a5f0-7c3e-7000-8000-000000000001',
}

beforeEach(() => vi.clearAllMocks())

describe('DevicesAdminService.list', () => {
  it('hace GET /devices y devuelve el arreglo tal cual', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [device] })
    expect(await DevicesAdminService.list()).toEqual([device])
    expect(api.get).toHaveBeenCalledExactlyOnceWith('/devices')
  })

  it.each([403, 500])('propaga el %i', async (status) => {
    vi.mocked(api.get).mockRejectedValue({ response: { status } })
    await expect(DevicesAdminService.list()).rejects.toMatchObject({ response: { status } })
  })
})

describe('DevicesAdminService.create', () => {
  it('hace POST /devices con el nombre y devuelve el dispositivo con su código', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: device, status: 201 })
    expect(await DevicesAdminService.create({ name: 'Tablet' })).toEqual(device)
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/devices', { name: 'Tablet' })
  })

  it('con correoEnvio lo manda y recibe a dónde llegó el correo (sin código)', async () => {
    const emailed = { ...device, identifier: undefined, deliveredTo: 'recipient' }
    vi.mocked(api.post).mockResolvedValue({ data: emailed, status: 201 })
    const result = await DevicesAdminService.create({ name: 'Tablet', correoEnvio: 'ana@example.com' })
    expect(result.deliveredTo).toBe('recipient')
    expect(api.post).toHaveBeenCalledWith('/devices', { name: 'Tablet', correoEnvio: 'ana@example.com' })
  })

  it.each([400, 403, 502])('propaga el %i', async (status) => {
    vi.mocked(api.post).mockRejectedValue({ response: { status } })
    await expect(DevicesAdminService.create({ name: 'Tablet' })).rejects.toMatchObject({ response: { status } })
  })
})

describe('DevicesAdminService.revoke', () => {
  it('hace PATCH /devices/:id/revoke sin cuerpo y devuelve el dispositivo revocado', async () => {
    const revoked = { ...device, status: 'revocado', identifier: undefined }
    vi.mocked(api.patch).mockResolvedValue({ data: revoked })
    expect(await DevicesAdminService.revoke(ID)).toEqual(revoked)
    expect(api.patch).toHaveBeenCalledExactlyOnceWith(`/devices/${ID}/revoke`)
  })

  it.each([403, 404, 500])('propaga el %i', async (status) => {
    vi.mocked(api.patch).mockRejectedValue({ response: { status } })
    await expect(DevicesAdminService.revoke(ID)).rejects.toMatchObject({ response: { status } })
  })
})

describe('DevicesAdminService.reissue', () => {
  it('hace PATCH /devices/:id/reissue con cuerpo vacío (el servidor espera un objeto) y devuelve el código nuevo', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: device })
    expect(await DevicesAdminService.reissue(ID)).toEqual(device)
    expect(api.patch).toHaveBeenCalledExactlyOnceWith(`/devices/${ID}/reissue`, {})
  })

  it('con correoEnvio lo manda en el cuerpo', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { ...device, identifier: undefined, deliveredTo: 'approver-fallback' } })
    const result = await DevicesAdminService.reissue(ID, { correoEnvio: 'ana@example.com' })
    expect(result.deliveredTo).toBe('approver-fallback')
    expect(api.patch).toHaveBeenCalledWith(`/devices/${ID}/reissue`, { correoEnvio: 'ana@example.com' })
  })

  it.each([400, 403, 404, 502])('propaga el %i', async (status) => {
    vi.mocked(api.patch).mockRejectedValue({ response: { status } })
    await expect(DevicesAdminService.reissue(ID)).rejects.toMatchObject({ response: { status } })
  })
})
