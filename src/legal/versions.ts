/**
 * Versión de los textos legales (AAAA-MM-DD): la fecha en que quedaron vigentes.
 * CAMBIA cada vez que cambie el texto de /privacidad o de /terminos. Se muestra en la
 * parte de arriba de los dos documentos y se guardará con la aceptación del registro.
 */
export const LEGAL_VERSION = '2026-10-16'

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** "2026-10-16" → "16 de octubre de 2026". Un valor que no es fecha se devuelve igual. */
export function formatLegalVersionDate(version: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(version)
  if (!match) return version
  const month = MONTHS[Number(match[2]) - 1]
  if (!month) return version
  return `${Number(match[3])} de ${month} de ${match[1]}`
}
