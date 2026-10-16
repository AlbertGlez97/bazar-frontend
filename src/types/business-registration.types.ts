// Contrato real de bazar-api para el registro de negocio v2 (ver
// doc/api-contract-for-frontend.md, sección 11). Propiedades desconocidas = 400,
// así que el payload lleva exactamente estos campos.
export type BusinessType =
  | 'bazar_o_tianguis'
  | 'abarrotes'
  | 'ropa_y_accesorios'
  | 'comida_y_bebidas'
  | 'plantas_y_jardineria'
  | 'artesanias'
  | 'servicios'
  | 'otro'

export interface BusinessRegistrationPayload {
  /** 1..200 */
  nombreNegocio: string
  tipoNegocio: BusinessType
  /** 10..400 */
  queVende: string
  /** Opcional, máx. 200 (si está en blanco no se manda la clave) */
  dondeVende?: string
  /** Opcional, máx. 120 (si está en blanco no se manda la clave) */
  recomendadoPor?: string
  /** 1..100 */
  nombre: string
  /** 1..100 */
  apellidos: string
  /** Correo válido, máx. 254 */
  correo: string
  /** Obligatorio: 10 dígitos de México (WhatsApp) */
  telefono: string
  /** Siempre true: sin la casilla marcada no se envía */
  aceptaLegal: true
  /** AAAA-MM-DD: versión de los textos legales que vio la persona (LEGAL_VERSION) */
  versionLegal: string
  /** Token de un solo uso del widget de Cloudflare Turnstile */
  turnstileToken: string
  /** Campo trampa: las personas lo dejan vacío */
  sitioWebEmpresa: string
}
