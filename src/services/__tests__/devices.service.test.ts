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

  it('propaga el 403 cuando el dispositivo no está autorizado', async () => {
    vi.mocked(api.post).mockRejectedValue({
      response: { status: 403, data: { message: 'Device is unknown or unauthorized' } },
    })

    await expect(
      DevicesService.identify({ identifier: 'unknown', name: 'Unknown' })
    ).rejects.toMatchObject({ response: { status: 403 } })
  })
})
