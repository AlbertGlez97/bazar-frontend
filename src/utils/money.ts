/**
 * Conversión de dinero centavos <-> pesos.
 *
 * El backend maneja SIEMPRE enteros en centavos de MXN (`unitPriceMinor`,
 * `purchaseCostMinor`, etc. — ver doc/api-contract-for-frontend.md §1.4).
 * El frontend es responsable de convertir hacia/desde pesos con 2 decimales
 * para que la persona capture/lea montos normales ("125.50") en vez de
 * centavos ("12550"). Un error de redondeo aquí se propaga a cada
 * formulario de dinero del proyecto, así que se maneja con cuidado.
 */

/**
 * Centavos (entero) -> pesos con 2 decimales, ej. `12550 -> "125.50"`.
 * Es exactamente la fórmula que documenta el propio contrato del backend:
 * `(minor / 100).toFixed(2)`.
 */
export function minorToDisplay(minor: number): string {
  if (!Number.isFinite(minor)) return '0.00'
  return (minor / 100).toFixed(2)
}

// Regex de un número decimal simple: signo opcional, parte entera obligatoria,
// hasta un separador decimal (punto o coma) con cualquier cantidad de dígitos.
const NUMERIC_RE = /^(-?)(\d+)(?:[.,](\d*))?$/

/**
 * Pesos capturados (string o number) -> centavos (entero), redondeando
 * correctamente al segundo decimal en vez de truncar (ej. `"10.005"` debe
 * dar `1001`, no `1000`).
 *
 * OJO: multiplicar directo por 100 (`Number(display) * 100`) es la trampa
 * clásica de punto flotante — `10.005 * 100` da `1000.4999999999999` en JS,
 * y `Math.round(...)` de ese valor trunca a `1000` en vez de redondear a
 * `1001`. Para evitarlo, esta función trabaja sobre los DÍGITOS del string
 * (parte entera + hasta 3 decimales) en vez de hacer aritmética de floats.
 * Devuelve `0` si el valor no tiene forma de número.
 */
export function displayToMinor(display: string | number): number {
  if (display === null || display === undefined) return 0
  const raw = (typeof display === 'number' ? display.toString() : display).trim()
  const match = NUMERIC_RE.exec(raw)
  if (!match) return 0

  const [, sign, intPart, decPart = ''] = match
  // Tomamos 3 decimales (rellenando con ceros) para poder redondear el
  // tercero hacia el segundo sin arrastrar imprecisión de floats.
  const threeDecimals = (decPart + '000').slice(0, 3)
  const cents = Number(intPart) * 100 + Math.round(Number(threeDecimals) / 10)

  return sign === '-' ? -cents : cents
}

/** Dígitos enteros máximos del efectivo: el contrato tope en 21,474,836.47 (2147483647 centavos). */
const MAX_CASH_INT_DIGITS = 8

/**
 * Limpia lo que la persona escribe (o pega) en el campo de efectivo y deja un
 * texto que `displayToMinor` entiende: solo dígitos y un separador decimal,
 * con a lo más dos decimales.
 * - Quita todo lo que no es dígito, punto o coma ("$ 1 500", "-20", "1e5").
 * - Un solo separador es el decimal ("100,50" -> "100,50"; el teclado numérico
 *   de un celular en español ofrece la coma).
 * - Punto y coma juntos: el ÚLTIMO es el decimal y el otro es de miles
 *   ("1,000.50" -> "1000.50", "1.000,50" -> "1000,50").
 * - Varios del mismo tipo son de miles ("1,000,000" -> "1000000").
 * - Empezar por el separador antepone un 0 (".5" -> "0.5"), que si no vale 0.
 */
export function sanitizeCashText(input: string): string {
  const kept = input.replace(/[^\d.,]/g, '')

  const lastDot = kept.lastIndexOf('.')
  const lastComma = kept.lastIndexOf(',')
  let decimalIndex = -1
  if (lastDot >= 0 && lastComma >= 0) {
    decimalIndex = Math.max(lastDot, lastComma)
  } else {
    const separator = lastDot >= 0 ? '.' : ','
    const count = kept.split(separator).length - 1
    if (count === 1) decimalIndex = kept.indexOf(separator)
  }

  let integer: string
  let decimals = ''
  let separator = ''
  if (decimalIndex >= 0) {
    integer = kept.slice(0, decimalIndex).replace(/[.,]/g, '')
    separator = kept[decimalIndex]
    decimals = kept.slice(decimalIndex + 1).replace(/[.,]/g, '').slice(0, 2)
  } else {
    integer = kept.replace(/[.,]/g, '')
  }

  integer = integer.slice(0, MAX_CASH_INT_DIGITS)
  if (!separator) return integer
  return `${integer || '0'}${separator}${decimals}`
}
