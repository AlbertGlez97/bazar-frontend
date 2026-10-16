import { z } from 'zod'
import type { BusinessType } from '@/types/business-registration.types'

// Esquema del formulario de registro de negocio (POST /business-registration).
// Los límites son los del contrato del backend: nombreNegocio 1..200, tipoNegocio de
// una lista de 8, queVende 10..400, dondeVende ≤200, recomendadoPor ≤120, nombre y
// apellidos 1..100, correo válido de hasta 254 y teléfono de México OBLIGATORIO (el
// servidor lo guarda a 10 dígitos; aquí se manda ya normalizado). Los mensajes están
// en la voz de La Marchanta (doc/brand-guidelines.md): frases cortas, qué hacer.

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

/**
 * Deja solo los 10 dígitos del número: quita separadores y el prefijo de país
 * (+52, 52, o el heredado +52 1). El servidor acepta espacios, guiones y +52, pero no
 * paréntesis ni puntos, así que se manda ya limpio.
 */
export function normalizeMxPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('521')) return digits.slice(3)
  if (digits.length === 12 && digits.startsWith('52')) return digits.slice(2)
  return digits
}

export const BUSINESS_TYPE_OPTIONS = [
  { value: 'bazar_o_tianguis', label: 'Bazar o tianguis' },
  { value: 'abarrotes', label: 'Abarrotes o tiendita' },
  { value: 'ropa_y_accesorios', label: 'Ropa y accesorios' },
  { value: 'comida_y_bebidas', label: 'Comida y bebidas' },
  { value: 'plantas_y_jardineria', label: 'Plantas y jardinería' },
  { value: 'artesanias', label: 'Artesanías' },
  { value: 'servicios', label: 'Servicios' },
  { value: 'otro', label: 'Otro' },
] as const satisfies readonly { value: BusinessType; label: string }[]

/** Texto opcional: en blanco sale ausente (no se manda la clave). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Es muy largo: máximo ${max} caracteres.`)
    .transform((v) => (v === '' ? undefined : v))


export const EMAIL_INVALID_MESSAGE = 'Ese correo no se ve bien. Revisa que tenga la forma nombre@dominio.com.'

export const businessRegistrationSchema = z.object({
  nombreNegocio: z
    .string()
    .trim()
    .min(1, 'Escribe el nombre de tu negocio.')
    .max(200, 'El nombre del negocio es muy largo (máximo 200 caracteres).'),
  tipoNegocio: z.enum(BUSINESS_TYPE_OPTIONS.map((o) => o.value) as [BusinessType, ...BusinessType[]], {
    message: 'Elige el tipo de tu negocio.',
  }),
  queVende: z
    .string()
    .trim()
    .min(1, 'Cuéntanos qué vendes.')
    .min(10, 'Cuéntanos un poco más: escribe al menos 10 letras.')
    .max(400, 'Es muy largo: máximo 400 caracteres.'),
  dondeVende: optionalText(200),
  recomendadoPor: optionalText(120),
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
  telefono: z
    .string()
    .trim()
    .min(1, 'Escribe tu número de WhatsApp.')
    .max(30, 'Ese número es muy largo.')
    .refine(isValidMxPhone, 'Escribe un número de 10 dígitos, por ejemplo 55 1234 5678.')
    .transform(normalizeMxPhone),
  aceptaLegal: z.literal(true, { errorMap: () => ({ message: 'Para continuar, acepta el Aviso de privacidad y los Términos.' }) }),
})

/** Lo que escribe la persona (antes de recortar y normalizar). */
export type BusinessRegistrationFormInput = z.input<typeof businessRegistrationSchema>
/** Lo que sale del esquema, listo para el contrato. */
export type BusinessRegistrationFormOutput = z.output<typeof businessRegistrationSchema>
