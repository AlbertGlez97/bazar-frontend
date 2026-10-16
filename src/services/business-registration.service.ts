import api from './api'
import type { BusinessRegistrationPayload } from '@/types/business-registration.types'

const BusinessRegistrationService = {
  /**
   * Crea una solicitud de registro (queda "pendiente_correo"): el backend manda un
   * enlace al correo de la persona y NO avisa al aprobador hasta que lo confirme.
   * Responde siempre 202 { ok: true } para una petición bien formada, exista o no
   * el correo. Un campo fuera del contrato es un 400.
   */
  async register(payload: BusinessRegistrationPayload): Promise<void> {
    await api.post('/business-registration', payload)
  },

  /** Confirma el correo con el token del enlace. Es POST a propósito (los escáneres de correo abren los GET). */
  async verifyEmail(token: string): Promise<void> {
    await api.post('/business-registration/verify-email', { token })
  },

  /** Pide otro enlace. Siempre 202 { ok: true }: no revela si el correo existe. */
  async resend(correo: string): Promise<void> {
    await api.post('/business-registration/resend', { correo })
  },
}

export default BusinessRegistrationService
