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
 * Limpia lo que la persona escribe (o pega) en el campo de efectivo: quita lo
 * que no puede ser parte de un monto (letras, símbolos, espacios: "$ 1 500",
 * "-20", "1e5") y topa los dígitos (8 enteros, 2 decimales).
 *
 * NO reinterpreta comas ni puntos: lo que queda en el campo es lo que se lee,
 * y si es ambiguo ("100,50") lo rechaza `parseCashInput` en vez de adivinar.
 */
export function sanitizeCashText(input: string): string {
  const kept = input.replace(/[^\d.,]/g, '')

  const dot = kept.indexOf('.')
  const integerPart = dot >= 0 ? kept.slice(0, dot) : kept
  let rest = dot >= 0 ? kept.slice(dot) : ''

  // Tope de dígitos enteros (las comas de miles no cuentan).
  let digits = 0
  let integer = ''
  for (const char of integerPart) {
    if (char !== ',') {
      if (digits >= MAX_CASH_INT_DIGITS) continue
      digits += 1
    }
    integer += char
  }

  // Máximo dos decimales; con más de un punto o una coma después del punto el
  // texto ya es inválido y se deja como está para que se vea y se rechace.
  if (/^\.\d*$/.test(rest)) rest = rest.slice(0, 3)

  return integer + rest
}

// Entero (con miles bien agrupados o sin agrupar) y hasta 2 decimales tras el
// punto; o solo decimales (".5"). Un punto final ("1000.") es texto a medias.
const CASH_TEXT_RE = /^(?:(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{0,2}))?|\.(\d{1,2}))$/

/**
 * Efectivo que la persona escribió -> centavos, con la convención de México
 * (es-MX): la COMA agrupa miles y el PUNTO es el decimal. "1,000" -> 100000,
 * "1,000.50" -> 100050, "1000.5" -> 100050.
 *
 * Falla hacia el lado seguro: si el texto es ambiguo o no tiene forma de
 * monto devuelve `null` en vez de adivinar. Ejemplos que rechaza: "100,50"
 * (¿100.50 o 10,050?), "1,5", "1.000,50" (convención europea), "10.005"
 * (no hay fracciones de centavo), "-20", "1e5".
 * - Vacío o solo espacios: 0 (todavía no se captura nada).
 * - Un "$" al inicio se tolera.
 * - La coma solo vale como separador de miles bien puesto (grupos de 3).
 *
 * Reutiliza `displayToMinor` para pasar a centavos con dinero exacto (sin
 * aritmética de floats).
 */
export function parseCashInput(text: string): number | null {
  if (typeof text !== 'string') return null
  const raw = text.trim().replace(/^\$\s*/, '')
  if (raw === '') return 0

  const match = CASH_TEXT_RE.exec(raw)
  if (!match) return null

  const integer = (match[1] ?? '0').replace(/,/g, '')
  const decimals = match[2] ?? match[3] ?? ''
  return displayToMinor(decimals ? `${integer}.${decimals}` : integer)
}
