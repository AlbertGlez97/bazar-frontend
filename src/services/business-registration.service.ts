import api from './api'
import type { BusinessRegistrationPayload } from '@/types/business-registration.types'

const BusinessRegistrationService = {
  /**
   * Crea una solicitud de registro de negocio. El backend NO autentica ni
   * abre sesión aquí — solo deja la solicitud en estado "pendiente" y
   * dispara un correo de aprobación manual a Alberto.
   */
  async register(payload: BusinessRegistrationPayload): Promise<void> {
    await api.post('/business-registration', payload)
  },
}

export default BusinessRegistrationService
