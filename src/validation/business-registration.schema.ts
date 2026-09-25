import { z } from 'zod'

// Esquema del formulario de registro de negocio (POST /business-registration).
// Los límites son los del contrato del backend: nombreNegocio 1..200, nombre y
// apellidos 1..100, correo válido de hasta 254, telefono opcional de 1..30 sin
// formato estricto en el servidor. Aquí el teléfono es más exigente porque la
// audiencia es mexicana y así se evitan capturas basura; los mensajes están en
// la voz de La Marchanta (doc/brand-guidelines.md).

/**
 * Teléfono mexicano. Regla basada en el Plan Técnico Fundamental de Numeración
 * del IFT: desde el 3 de agosto de 2019 la marcación nacional es uniforme de
 * 10 dígitos (clave de área + número) y se eliminaron los prefijos 01, 044,
 * 045 y el "1" tras el código de país para móviles
 * (https://www.infobae.com/america/mexico/2019/06/20/asi-sera-la-nueva-marcacion-telefonica-que-entrara-en-vigor-en-agosto/,
 * https://en.wikipedia.org/wiki/Telephone_numbers_in_Mexico). En formato
 * internacional es +52 seguido de esos 10 dígitos; el "+52 1" heredado todavía
 * aparece en la práctica y se tolera. Las claves de área empiezan en 2-9
 * (55, 33, 81, 656, ...), coherente con la metadata de libphonenumber para MX:
 * esta expresión coincide con `isValidPhoneNumber(x, 'MX')` en los casos
 * comunes, sin cargar la librería.
 */
const MX_PHONE_RE = /^(?:(?:\+?52)1?)?[2-9]\d{9}$/

/** La gente escribe espacios, guiones, puntos y paréntesis: se ignoran al validar. */
const PHONE_SEPARATORS_RE = /[\s().-]/g

export function isValidMxPhone(value: string): boolean {
  return MX_PHONE_RE.test(value.replace(PHONE_SEPARATORS_RE, ''))
}

export const EMAIL_INVALID_MESSAGE = 'Ese correo no se ve bien. Revisa que tenga la forma nombre@dominio.com.'

export const businessRegistrationSchema = z.object({
  nombreNegocio: z
    .string()
    .trim()
    .min(1, 'Escribe el nombre de tu negocio.')
    .max(200, 'El nombre del negocio es muy largo (máximo 200 caracteres).'),
  nombre: z
    .string()
    .trim()
    .min(1, 'Escribe tu nombre.')
    .min(2, 'Tu nombre debe tener al menos 2 letras.')
    .max(100, 'Tu nombre es muy largo (máximo 100 caracteres).'),
  apellidos: z
    .string()
    .trim()
    .min(1, 'Escribe tus apellidos.')
    .min(2, 'Tus apellidos deben tener al menos 2 letras.')
    .max(100, 'Tus apellidos son muy largos (máximo 100 caracteres).'),
  correo: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Escribe tu correo.')
    .email(EMAIL_INVALID_MESSAGE)
    .max(254, 'Ese correo es muy largo (máximo 254 caracteres).'),
  // Opcional: en blanco es válido y sale del payload (undefined). Lleno, se
  // envía tal como lo escribió la persona (recortado): el backend no exige formato.
  telefono: z
    .string()
    .trim()
    .max(30, 'El teléfono es muy largo (máximo 30 caracteres).')
    .refine((v) => v === '' || isValidMxPhone(v), 'Escribe un teléfono de 10 dígitos, por ejemplo 55 1234 5678.')
    .transform((v) => (v === '' ? undefined : v)),
})

/** Lo que escribe la persona (antes de recortar y normalizar). */
export type BusinessRegistrationFormInput = z.input<typeof businessRegistrationSchema>
/** Lo que sale del esquema, listo para el contrato. */
export type BusinessRegistrationFormOutput = z.output<typeof businessRegistrationSchema>
