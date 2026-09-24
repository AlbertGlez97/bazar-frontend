// Contrato real de bazar-api para el alta de negocios.
// OJO: el backend expone un único campo `contactoSocio` (string libre), no
// email/teléfono por separado. El formulario del frontend valida que ese
// campo tenga forma de correo O de teléfono (ver BusinessRegistrationForm),
// pero el payload que viaja a la API es siempre este contrato plano.
export interface BusinessRegistrationPayload {
  nombreNegocio: string
  nombreSocio: string
  contactoSocio: string
}
