// Datos legales de La Marchanta, en UN solo lugar. Los textos de /privacidad y
// /terminos (src/legal/privacy-notice.ts y terms.ts) toman de aquí el nombre, el
// domicilio, el correo y los plazos: ningún texto repite estos datos a mano, así
// un cambio aquí no puede dejar un texto contradiciendo a otro.
//
// Cada cambio al TEXTO de los documentos exige subir LEGAL_VERSION (versions.ts).

export const LEGAL_RESPONSIBLE = {
  name: 'Juan Alberto González de la Cruz',
  kind: 'persona física',
  // provisional, revisar con abogado: domicilio del responsable.
  address: 'Acolman, Estado de México',
  // Correo de contacto y de privacidad (el mismo para los dos fines).
  email: 'albert.gonzalez0297@gmail.com',
} as const

/** Correo para dudas, privacidad y ejercicio de derechos ARCO. */
export const LEGAL_CONTACT_EMAIL = LEGAL_RESPONSIBLE.email

/**
 * Plazos de conservación, en días. Son una decisión de negocio, no algo que la ley
 * fije; hoy el sistema NO borra solas las solicitudes (ver doc/legal/inventario-datos.md).
 */
export const RETENTION = {
  // provisional, revisar con abogado: solicitudes con el correo sin confirmar.
  unconfirmedRegistrationDays: 7,
  // provisional, revisar con abogado: solicitudes rechazadas o vencidas.
  rejectedOrExpiredRegistrationDays: 30,
} as const

/**
 * Plazos para atender derechos ARCO. Vienen de la ley (LFPDPPP de 2025): 20 días para
 * responder y 15 más para hacerlo efectivo. Ver doc/legal/fuentes-consultadas.md.
 */
export const ARCO = {
  responseDays: 20,
  effectDays: 15,
} as const

/**
 * Ley y tribunales de los Términos. provisional, revisar con abogado: se eligieron los
 * del domicilio del responsable (Estado de México).
 */
export const LEGAL_JURISDICTION = 'los tribunales competentes del Estado de México'
