// Tests de BusinessRegistrationService — las tres llamadas públicas del registro v2
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BusinessRegistrationService from '../business-registration.service'
import api from '../api'

vi.mock('../api', () => ({ default: { post: vi.fn() } }))

const payload = {
  nombreNegocio: 'Abarrotes Los Pinos',
  tipoNegocio: 'abarrotes' as const,
  queVende: 'Abarrotes, dulces y refrescos',
  nombre: 'Ana',
  apellidos: 'Pérez Soto',
  correo: 'ana@example.com',
  telefono: '5512345678',
  aceptaLegal: true as const,
  versionLegal: '2026-10-16',
  turnstileToken: 'token-de-un-solo-uso',
  sitioWebEmpresa: '',
}

beforeEach(() => vi.clearAllMocks())

describe('BusinessRegistrationService.register', () => {
  it('envía el contrato plano a POST /business-registration', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ok: true } })

    await BusinessRegistrationService.register(payload)

    expect(api.post).toHaveBeenCalledExactlyOnceWith('/business-registration', payload)
  })

  it('propaga errores del servidor', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('offline'))
    await expect(BusinessRegistrationService.register(payload)).rejects.toThrow('offline')
  })
})

describe('BusinessRegistrationService.verifyEmail', () => {
  it('manda el token por POST (nunca por GET) a /business-registration/verify-email', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ok: true } })

    await BusinessRegistrationService.verifyEmail('abc-token')

    expect(api.post).toHaveBeenCalledExactlyOnceWith('/business-registration/verify-email', { token: 'abc-token' })
  })

  it('propaga el rechazo para que la vista distinga enlace inválido de error', async () => {
    const rejection = { response: { status: 400, data: { code: 'link_invalid' } } }
    vi.mocked(api.post).mockRejectedValue(rejection)
    await expect(BusinessRegistrationService.verifyEmail('x')).rejects.toBe(rejection)
  })
})

describe('BusinessRegistrationService.resend', () => {
  it('manda el correo a POST /business-registration/resend', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ok: true } })

    await BusinessRegistrationService.resend('ana@example.com')

    expect(api.post).toHaveBeenCalledExactlyOnceWith('/business-registration/resend', { correo: 'ana@example.com' })
  })
})
