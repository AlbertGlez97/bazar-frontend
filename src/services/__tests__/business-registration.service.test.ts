// Tests de BusinessRegistrationService — llamada real a POST /business-registration
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BusinessRegistrationService from '../business-registration.service'
import api from '../api'

vi.mock('../api', () => ({ default: { post: vi.fn() } }))

describe('BusinessRegistrationService.register', () => {
  beforeEach(() => vi.clearAllMocks())

  it('envía el payload plano a POST /business-registration', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { status: 'pendiente' } })
    const payload = {
      nombreNegocio: 'Bazar de Ana',
      nombreSocio: 'Ana Pérez',
      contactoSocio: 'ana@example.com',
    }

    await BusinessRegistrationService.register(payload)
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/business-registration', payload)
  })

  it('propaga errores del servidor', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('offline'))
    await expect(
      BusinessRegistrationService.register({ nombreNegocio: '', nombreSocio: '', contactoSocio: '' })
    ).rejects.toThrow('offline')
  })
})
