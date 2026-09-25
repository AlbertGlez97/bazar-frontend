/**
 * Hora de negocio: UTC-6 FIJO todo el año, sin horario de verano (Ciudad de
 * México; doc/api-contract-for-frontend.md §1.9). Es la misma zona con la que
 * el servidor entiende `from`/`to` de los reportes, así que el cliente NUNCA
 * usa la zona horaria del dispositivo: todo se calcula con aritmética UTC
 * sobre el instante desplazado 6 horas. Un día de negocio se nombra con una
 * clave `YYYY-MM-DD`, que es justo lo que aceptan los reportes.
 */

const BUSINESS_OFFSET_MS = -6 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export type RangePreset = 'hoy' | 'ayer' | 'semana' | 'mes'

/** Rango de días de negocio, ambos extremos inclusivos, como claves `YYYY-MM-DD`. */
export interface DateRange {
  from: string
  to: string
}

/** Por qué un rango no se puede consultar. */
export type RangeProblem = 'incomplete' | 'inverted' | 'future'

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const NO_DATE = '—'

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Fecha (UTC) cuyos campos UTC son la hora de pared del negocio para ese instante. */
function shifted(instant: Date | string | number): Date {
  return new Date(new Date(instant).getTime() + BUSINESS_OFFSET_MS)
}

function keyOf(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

function dateOfKey(key: string): Date {
  const [, y, m, d] = DATE_KEY_RE.exec(key)!
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
}

/** Día de negocio (`YYYY-MM-DD`) al que pertenece un instante. */
export function businessDayOf(instant: Date | string | number): string {
  return keyOf(shifted(instant))
}

/** Hoy, en hora de negocio (no en la del dispositivo). */
export function businessToday(now: Date = new Date()): string {
  return businessDayOf(now)
}

/** Suma (o resta) días a una clave `YYYY-MM-DD`. */
export function addDaysToKey(key: string, days: number): string {
  return keyOf(new Date(dateOfKey(key).getTime() + days * DAY_MS))
}

/**
 * Rangos rápidos, siempre en hora de negocio:
 * - `hoy` / `ayer`: ese día.
 * - `semana`: del domingo de la semana en curso (la semana de negocio va de
 *   domingo a sábado, igual que la del servidor) HASTA HOY.
 * - `mes`: del día 1 del mes en curso HASTA HOY.
 * "Esta semana" y "Este mes" terminan hoy y no al cierre del periodo: lo que
 * aún no ocurre no tiene ventas y solo alargaría el reporte.
 */
export function presetRange(preset: RangePreset, now: Date = new Date()): DateRange {
  const today = businessToday(now)
  switch (preset) {
    case 'hoy':
      return { from: today, to: today }
    case 'ayer': {
      const yesterday = addDaysToKey(today, -1)
      return { from: yesterday, to: yesterday }
    }
    case 'semana': {
      const weekday = dateOfKey(today).getUTCDay() // 0 = domingo
      return { from: addDaysToKey(today, -weekday), to: today }
    }
    case 'mes':
      return { from: `${today.slice(0, 8)}01`, to: today }
  }
}

/** ¿Es una fecha de calendario real con forma `YYYY-MM-DD`? */
export function isValidDateKey(value: string): boolean {
  if (!DATE_KEY_RE.test(value)) return false
  return keyOf(dateOfKey(value)) === value
}

/** Rango consultable: ambas fechas reales y `from <= to` (un solo día es válido). */
export function isValidRange(from: string, to: string): boolean {
  return isValidDateKey(from) && isValidDateKey(to) && from <= to
}

/**
 * Explica por qué un rango no se puede consultar (o `null` si sí se puede).
 * El servidor responde 200 con ceros a un rango invertido, así que la UI debe
 * impedirlo. Una fecha final futura tampoco tiene ventas que mostrar.
 */
export function validateRange(from: string, to: string, today: string): RangeProblem | null {
  if (!isValidDateKey(from) || !isValidDateKey(to)) return 'incomplete'
  if (from > to) return 'inverted'
  if (to > today) return 'future'
  return null
}

/** `dd/mm/yyyy` de una clave `YYYY-MM-DD`. */
export function formatDateKey(key: string): string {
  const match = DATE_KEY_RE.exec(key)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : NO_DATE
}

/** `dd/mm/yyyy` del día de negocio de un instante. */
export function formatBusinessDate(instant: string): string {
  if (Number.isNaN(new Date(instant).getTime())) return NO_DATE
  return formatDateKey(businessDayOf(instant))
}

/** `dd/mm/yyyy hh:mm` (24 h) en hora de negocio, p. ej. `24/09/2026 14:05`. */
export function formatBusinessDateTime(instant: string): string {
  if (Number.isNaN(new Date(instant).getTime())) return NO_DATE
  const wall = shifted(instant)
  return `${formatDateKey(keyOf(wall))} ${pad2(wall.getUTCHours())}:${pad2(wall.getUTCMinutes())}`
}

/**
 * Fecha para una celda de Excel: sus campos UTC son la hora de pared del
 * negocio. Excel guarda las fechas sin zona; escribirla así hace que la celda
 * muestre la hora en que se vendió, no la del dispositivo de quien abre el archivo.
 */
export function businessWallClock(instant: string): Date {
  return shifted(instant)
}
