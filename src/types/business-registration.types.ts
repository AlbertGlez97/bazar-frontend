// Contrato real de bazar-api para POST /business-registration (ver
// doc/api-contract-for-frontend.md). Propiedades desconocidas = 400, así que el
// payload lleva exactamente estos campos: `telefono` se omite cuando está en
// blanco (no se manda vacío).
export interface BusinessRegistrationPayload {
  /** 1..200 */
  nombreNegocio: string
  /** 1..100 */
  nombre: string
  /** 1..100 */
  apellidos: string
  /** Correo válido, máx. 254 */
  correo: string
  /** Opcional, 1..30, sin formato estricto en el servidor */
  telefono?: string
}
