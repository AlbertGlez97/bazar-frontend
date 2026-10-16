import { VOICE } from '@/config/voice'
import type { Product, RestockProductPayload } from '@/types/product.types'
import { parseMoneyText } from '@/utils/money'

/** Tope de existencia (y de un costo en centavos) que acepta el servidor: el rango de un entero de 32 bits. */
export const MAX_STOCK = 2_147_483_647
const MAX_NOTE_LENGTH = 1000

/**
 * ¿Se puede reponer? Solo productos por cantidad y activos. Una pieza única
 * que "vuelve" es una devolución o una corrección, no una compra; y un
 * producto desactivado primero se reactiva (el servidor responde 400 igual).
 */
export function canRestock(product: Pick<Product, 'tipo' | 'active'>): boolean {
  return product.tipo === 'cantidad' && product.active
}

/** Cuántas piezas se pueden sumar todavía sin pasar del máximo. */
export function maxRestockQuantity(product: Pick<Product, 'stock'>): number {
  return Math.max(0, MAX_STOCK - product.stock)
}

export function stockAfterRestock(product: Pick<Product, 'stock'>, quantity: number): number {
  return product.stock + quantity
}

export interface RestockDraft {
  quantity: number
  /** Costo unitario de esta compra, en pesos, tal como lo escribió la persona. */
  costText: string
  note: string
}

export interface RestockErrors {
  quantity?: string
  cost?: string
  note?: string
}

export type RestockPayloadResult =
  | { ok: true, payload: RestockProductPayload }
  | { ok: false, errors: RestockErrors }

/**
 * Valida lo capturado y arma el cuerpo de la petición. Solo incluye lo que la
 * persona llenó: sin costo el servidor no toca el costo del producto (un campo
 * vacío NO es 0 — "no sé cuánto costó" y "me salió gratis" son cosas distintas),
 * y una nota en blanco no se manda. El costo viaja en centavos, con la misma
 * lectura es-MX que el resto de los campos de dinero.
 */
export function buildRestockPayload(draft: RestockDraft, product: Pick<Product, 'stock'>): RestockPayloadResult {
  const copy = VOICE.productRestock
  const errors: RestockErrors = {}

  const { quantity } = draft
  if (!Number.isInteger(quantity) || quantity < 1) errors.quantity = copy.quantityRequired
  else if (quantity > maxRestockQuantity(product)) errors.quantity = copy.quantityTooMany

  let unitCostMinor: number | undefined
  const costText = draft.costText.trim()
  if (costText) {
    const parsed = parseMoneyText(costText)
    if (parsed === null) errors.cost = copy.costAmbiguous
    else if (parsed > MAX_STOCK) errors.cost = copy.costTooLarge
    else unitCostMinor = parsed
  }

  const note = draft.note.trim()
  if (note.length > MAX_NOTE_LENGTH) errors.note = copy.noteTooLong

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  const payload: RestockProductPayload = { quantity }
  if (unitCostMinor !== undefined) payload.unitCostMinor = unitCostMinor
  if (note) payload.note = note
  return { ok: true, payload }
}
