/**
 * Comisión de un colaborador: porcentaje que se escribe <-> puntos base enteros
 * que guarda el backend (1000 = 10.00 %).
 *
 * Igual que en `money.ts`, la conversión trabaja sobre los DÍGITOS del texto y
 * nunca multiplica floats (`0.29 * 100` da `28.999999999999996` en JS).
 */

/** Tope del contrato: 10 000 puntos base = 100 %. */
export const MAX_COMMISSION_BPS = 10_000

// Hasta 3 dígitos enteros y, opcional, punto con 1 o 2 decimales; o solo decimales (".5").
const PERCENT_RE = /^(?:(\d{1,3})(?:\.(\d{1,2}))?|\.(\d{1,2}))$/

/**
 * Texto de porcentaje -> puntos base, o `null` si no es un porcentaje válido
 * (vacío, letras, coma, signo, más de 2 decimales, más de 100). Tolera espacios
 * y un "%" al final. El caller decide qué significa un campo vacío.
 */
export function percentTextToBps(text: string): number | null {
  if (typeof text !== 'string') return null
  const raw = text.trim().replace(/%$/, '').trim()
  const match = PERCENT_RE.exec(raw)
  if (!match) return null

  const whole = match[1] ?? '0'
  const decimals = match[2] ?? match[3] ?? ''
  const bps = Number(whole) * 100 + Number(decimals.padEnd(2, '0'))
  return bps <= MAX_COMMISSION_BPS ? bps : null
}

/**
 * Puntos base -> texto de porcentaje sin ceros de sobra ("10", "10.5", "10.05"),
 * con aritmética entera. Un valor que no es un entero entre 0 y 10 000 da "".
 */
export function bpsToPercentText(bps: number): string {
  if (!Number.isInteger(bps) || bps < 0 || bps > MAX_COMMISSION_BPS) return ''
  const whole = Math.floor(bps / 100)
  const rest = bps % 100
  if (rest === 0) return String(whole)
  return `${whole}.${rest % 10 === 0 ? rest / 10 : String(rest).padStart(2, '0')}`
}
