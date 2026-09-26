// Tests de DevicesService — POST /devices/identify: identifier+name deben
// coincidir con un dispositivo ya autorizado (sembrado fuera de banda);
// 403 si no ("Device is unknown or unauthorized").
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DevicesService from '../devices.service'
import api from '../api'

vi.mock('../api', () => ({ default: { post: vi.fn(), get: vi.fn() } }))

describe('DevicesService.identify', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts { identifier, name } a /devices/identify y devuelve { deviceId }', async () => {
    const payload = { identifier: 'shared-tablet', name: 'Shared tablet' }
    vi.mocked(api.post).mockResolvedValue({ data: { deviceId: 'd-1' } })

    expect(await DevicesService.identify(payload)).toEqual({ deviceId: 'd-1' })
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/devices/identify', payload)
  })

  it('activación nueva: devuelve { deviceId, deviceToken } tal cual, sin tocarlos', async () => {
    const payload = { identifier: 'codigo-un-solo-uso', name: 'Tablet nueva' }
    vi.mocked(api.post).mockResolvedValue({ data: { deviceId: 'd-9', deviceToken: 'tok-secreto' } })

    expect(await DevicesService.identify(payload)).toEqual({ deviceId: 'd-9', deviceToken: 'tok-secreto' })
  })

  it('propaga el 409 cuando el identificador ya fue usado (distinto del 403)', async () => {
    vi.mocked(api.post).mockRejectedValue({
      response: {
        status: 409,
        data: { message: 'Este identificador ya fue usado. Pide a un socio que te genere uno nuevo.' },
      },
    })

    await expect(
      DevicesService.identify({ identifier: 'usado', name: 'Tablet' })
    ).rejects.toMatchObject({ response: { status: 409 } })
  })

  it('propaga el 403 cuando el dispositivo no está autorizado', async () => {
    vi.mocked(api.post).mockRejectedValue({
      response: { status: 403, data: { message: 'Device is unknown or unauthorized' } },
    })

    await expect(
      DevicesService.identify({ identifier: 'unknown', name: 'Unknown' })
    ).rejects.toMatchObject({ response: { status: 403 } })
  })
})
