/**
 * Construcción del cuerpo de POST /sales (doc/api-contract-for-frontend.md §6)
 * y generación del id de venta.
 *
 * El servidor rechaza con 400 cualquier propiedad desconocida (también dentro
 * de `items`), así que el cuerpo se arma campo por campo: nunca se esparce un
 * objeto de carrito. Toda validación de rango vive aquí para que un dato
 * imposible falle al construir (error de programación) y no como un 400 tardío
 * al sincronizar la cola.
 */
import { v7 as uuidv7 } from 'uuid'
import type { CreateSaleItemPayload, CreateSalePayload } from '@/types/sale.types'

/** Límites del contrato (§6). */
const MAX_MINOR_UNITS = 2147483647
const MAX_QUANTITY = 100000
const MAX_ITEMS = 500

/**
 * Id de venta: UUID v7 generado en el cliente. Es la clave de idempotencia:
 * reintentar tras una respuesta perdida SIEMPRE reenvía el mismo id.
 */
export function newSaleId(): string {
  return uuidv7()
}

export interface SaleLineInput {
  productId: string
  quantity: number
  /** Solo trazabilidad: el servidor cobra con el precio actual del catálogo. */
  unitPriceMinor?: number
}

export interface BuildSalePayloadInput {
  id: string
  memberId: string
  deviceId: string
  /** Instante de la venta; un `Date` se serializa como ISO 8601 UTC con `Z`. */
  occurredAt: string | Date
  cashReceivedMinor: number
  lines: SaleLineInput[]
}

function assertMinor(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > MAX_MINOR_UNITS) {
    throw new RangeError(`${label} debe ser un entero de centavos entre 0 y ${MAX_MINOR_UNITS}`)
  }
}

function toIsoInstant(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('occurredAt no es una fecha válida')
  }
  // Un string ya en ISO se conserva tal cual (el instante congelado de la
  // cola no debe reescribirse); solo un Date se serializa.
  return value instanceof Date ? date.toISOString() : value
}

/**
 * Arma el cuerpo del contrato (`currency` siempre `MXN`).
 *
 * Decisión: las líneas repetidas de un mismo `productId` se FUSIONAN sumando
 * cantidades, en orden de primera aparición. El servidor procesaría las
 * partidas repetidas en orden (§6) y la idempotencia compara el conjunto de
 * `{productId, quantity}`, así que un cuerpo con productos únicos es más
 * simple de razonar y estable ante reintentos. El primer `unitPriceMinor` de
 * cada producto se conserva como trazabilidad.
 */
export function buildSalePayload(input: BuildSalePayloadInput): CreateSalePayload {
  assertMinor(input.cashReceivedMinor, 'cashReceivedMinor')
  const occurredAt = toIsoInstant(input.occurredAt)

  if (input.lines.length === 0) {
    throw new RangeError('Una venta necesita al menos un producto')
  }

  const merged = new Map<string, CreateSaleItemPayload>()
  for (const line of input.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QUANTITY) {
      throw new RangeError(`quantity debe ser un entero entre 1 y ${MAX_QUANTITY}`)
    }
    if (line.unitPriceMinor !== undefined) assertMinor(line.unitPriceMinor, 'unitPriceMinor')

    const existing = merged.get(line.productId)
    if (existing) {
      existing.quantity += line.quantity
      if (existing.quantity > MAX_QUANTITY) {
        throw new RangeError(`quantity debe ser un entero entre 1 y ${MAX_QUANTITY}`)
      }
      continue
    }
    const item: CreateSaleItemPayload = { productId: line.productId, quantity: line.quantity }
    if (line.unitPriceMinor !== undefined) item.unitPriceMinor = line.unitPriceMinor
    merged.set(line.productId, item)
  }

  if (merged.size > MAX_ITEMS) {
    throw new RangeError(`Una venta admite hasta ${MAX_ITEMS} productos distintos`)
  }

  return {
    id: input.id,
    memberId: input.memberId,
    deviceId: input.deviceId,
    occurredAt,
    currency: 'MXN',
    cashReceivedMinor: input.cashReceivedMinor,
    items: [...merged.values()],
  }
}
