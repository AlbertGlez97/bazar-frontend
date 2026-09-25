// Tests de BusinessRegistrationService — llamada real a POST /business-registration
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BusinessRegistrationService from '../business-registration.service'
import api from '../api'

vi.mock('../api', () => ({ default: { post: vi.fn() } }))

describe('BusinessRegistrationService.register', () => {
  beforeEach(() => vi.clearAllMocks())

  it('envía el contrato plano a POST /business-registration (con teléfono)', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { status: 'pendiente' } })
    const payload = {
      nombreNegocio: 'Abarrotes Los Pinos',
      nombre: 'Ana',
      apellidos: 'Pérez Soto',
      correo: 'ana@example.com',
      telefono: '55 1234 5678',
    }

    await BusinessRegistrationService.register(payload)
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/business-registration', payload)
  })

  it('sin teléfono el cuerpo no lleva la clave, y nunca los campos del contrato anterior', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { status: 'pendiente' } })

    await BusinessRegistrationService.register({
      nombreNegocio: 'Abarrotes Los Pinos',
      nombre: 'Ana',
      apellidos: 'Pérez Soto',
      correo: 'ana@example.com',
    })

    const body = vi.mocked(api.post).mock.calls[0][1] as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(['apellidos', 'correo', 'nombre', 'nombreNegocio'])
    expect(body).not.toHaveProperty('nombreSocio')
    expect(body).not.toHaveProperty('contactoSocio')
  })

  it('propaga errores del servidor', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('offline'))
    await expect(
      BusinessRegistrationService.register({ nombreNegocio: '', nombre: '', apellidos: '', correo: '' })
    ).rejects.toThrow('offline')
  })
})
