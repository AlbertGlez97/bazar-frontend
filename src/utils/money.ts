/**
 * Conversión de dinero centavos <-> pesos.
 *
 * El backend maneja SIEMPRE enteros en centavos de MXN (`unitPriceMinor`,
 * `purchaseCostMinor`, etc. — ver doc/api-contract-for-frontend.md §1.4).
 * El frontend es responsable de convertir hacia/desde pesos con 2 decimales
 * para que la persona capture/lea montos normales ("125.50") en vez de
 * centavos ("12550"). Un error de redondeo aquí se propaga a cada
 * formulario de dinero del proyecto, así que se maneja con cuidado.
 *
 * La ARITMÉTICA de centavos (sumar, restar, multiplicar por cantidad, cambio,
 * faltante) vive aquí y usa dinero.js, la misma librería y versión que
 * bazar-api: nadie hace `+`/`-`/`*` directo sobre centavos en el resto de la
 * app, ni siquiera offline, donde el backend no valida en tiempo real.
 */
import { add, dinero, multiply, subtract, toSnapshot, type Dinero } from 'dinero.js'
import { MXN } from 'dinero.js/currencies'

// ── Aritmética de centavos (dinero.js) ─────────────────────────────────────

function toDinero(minor: number): Dinero<number> {
  // dinero.js ya rechaza lo que no es entero (1.5, NaN, '5'); esto añade el
  // tope de enteros exactos de JS.
  if (!Number.isSafeInteger(minor)) throw new RangeError('El monto debe ser un entero exacto en centavos')
  return dinero({ amount: minor, currency: MXN })
}

/**
 * Devuelve los centavos de un resultado. dinero.js suma en `number`, así que
 * un resultado fuera de los enteros exactos de JS (más de ~9e15 centavos) ya
 * perdió precisión: falla fuerte (como `toMinorUnits` del backend) en vez de
 * devolver un monto inexacto.
 */
function toMinor(value: Dinero<number>): number {
  const { amount } = toSnapshot(value)
  if (!Number.isSafeInteger(amount)) throw new RangeError('El resultado excede los centavos que se pueden calcular con exactitud')
  return amount
}

/** a + b, en centavos enteros. */
export function addMinor(a: number, b: number): number {
  return toMinor(add(toDinero(a), toDinero(b)))
}

/** a - b, en centavos enteros. Puede ser negativo. */
export function subtractMinor(a: number, b: number): number {
  return toMinor(subtract(toDinero(a), toDinero(b)))
}

/** Precio unitario × cantidad entera >= 0, en centavos enteros. */
export function multiplyMinor(unitMinor: number, quantity: number): number {
  if (!Number.isSafeInteger(quantity) || quantity < 0) throw new RangeError('La cantidad debe ser un entero >= 0')
  return toMinor(multiply(toDinero(unitMinor), quantity))
}

/** Suma una lista de centavos (vacía = 0). */
export function sumMinor(values: readonly number[]): number {
  return toMinor(values.reduce((acc, value) => add(acc, toDinero(value)), toDinero(0)))
}

/** Cambio a devolver: efectivo - total, nunca negativo. */
export function changeDueMinor(cashMinor: number, totalMinor: number): number {
  return Math.max(0, subtractMinor(cashMinor, totalMinor))
}

/** Efectivo que falta para cubrir el total; 0 si ya alcanza. */
export function shortfallMinor(cashMinor: number, totalMinor: number): number {
  return Math.max(0, subtractMinor(totalMinor, cashMinor))
}

// ── Conversión centavos <-> pesos ──────────────────────────────────────────

/**
 * Centavos (entero) -> pesos con 2 decimales, ej. `12550 -> "125.50"`.
 * Es exactamente la fórmula que documenta el propio contrato del backend:
 * `(minor / 100).toFixed(2)`.
 */
export function minorToDisplay(minor: number): string {
  if (!Number.isFinite(minor)) return '0.00'
  return (minor / 100).toFixed(2)
}

/**
 * Centavos (entero) -> texto de moneda para vistas y archivos: `125000 ->
 * "$1,250.00"`. Es la ÚNICA presentación con separador de miles (PDF, vista de
 * reportes y valores impresos), y es exacta: trabaja con la parte entera y los
 * centavos por separado, sin dividir a flotantes ni depender del `Intl` del
 * dispositivo (los reportes deben verse igual en cualquier equipo).
 * El signo va delante del símbolo: `-$125.50`.
 */
export function formatMinorMoney(minor: number): string {
  if (!Number.isFinite(minor)) return '$0.00'
  const negative = minor < 0
  const abs = Math.abs(Math.trunc(minor))
  const pesos = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const cents = String(abs % 100).padStart(2, '0')
  return `${negative ? '-' : ''}$${pesos}.${cents}`
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
const MONEY_TEXT_RE = /^(?:(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{0,2}))?|\.(\d{1,2}))$/

/**
 * Monto que la persona escribió -> centavos, con la convención de México
 * (es-MX): la COMA agrupa miles y el PUNTO es el decimal. "1,000" -> 100000,
 * "1,000.50" -> 100050, "1000.5" -> 100050.
 *
 * Es la ÚNICA regla de lectura de montos escritos: la comparten el campo de
 * efectivo (`parseCashInput`), el formulario de producto y `displayToMinor`.
 *
 * Falla hacia el lado seguro: si el texto es ambiguo o no tiene forma de
 * monto devuelve `null` en vez de adivinar. Ejemplos que rechaza: "100,50"
 * (¿100.50 o 10,050?), "1,5", "1.000,50" (convención europea), "10.005"
 * (no hay fracciones de centavo), "-20", "1e5".
 * - Vacío o solo espacios: 0 (todavía no se captura nada).
 * - Un "$" al inicio se tolera.
 * - La coma solo vale como separador de miles bien puesto (grupos de 3).
 *
 * Trabaja sobre los DÍGITOS del texto (parte entera x 100 + centavos), sin
 * aritmética de floats: `10.005 * 100` da `1000.4999999999999` en JS.
 */
export function parseMoneyText(text: string): number | null {
  if (typeof text !== 'string') return null
  const raw = text.trim().replace(/^\$\s*/, '')
  if (raw === '') return 0

  const match = MONEY_TEXT_RE.exec(raw)
  if (!match) return null

  const integer = (match[1] ?? '0').replace(/,/g, '')
  const decimals = (match[2] ?? match[3] ?? '').padEnd(2, '0')
  const minor = Number(integer) * 100 + Number(decimals)
  return Number.isSafeInteger(minor) ? minor : null
}

/** Efectivo que la persona escribió -> centavos: el nombre de `parseMoneyText` en el campo de efectivo. */
export const parseCashInput = parseMoneyText

/**
 * Pesos capturados (string o number) -> centavos (entero), con la misma
 * convención es-MX que el campo de efectivo (coma = miles, punto = decimal).
 *
 * Devuelve `0` si el valor no tiene forma de monto o es ambiguo ("100,50",
 * "10.005", "-20"): no adivina. Quien necesite distinguir un 0 real de un
 * texto inválido (un formulario que debe avisar) usa `parseMoneyText`, que
 * devuelve `null` en ese caso.
 */
export function displayToMinor(display: string | number): number {
  if (display === null || display === undefined) return 0
  return parseMoneyText(String(display)) ?? 0
}
