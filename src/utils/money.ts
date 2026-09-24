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
