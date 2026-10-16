// Fábricas de datos para tests de la pantalla de venta.
import type { Product } from '@/types/product.types'
import type { PaymentMethodTotals } from '@/types/report.types'

let seq = 0

/** Producto activo por cantidad con stock 10; sobrescribe lo que necesites. */
export function makeProduct(overrides: Partial<Product> = {}): Product {
  seq += 1
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    name: `Producto ${seq}`,
    tipo: 'cantidad',
    unitPriceMinor: 1000,
    initialStock: 10,
    stock: 10,
    category: null,
    purchaseCostMinor: null,
    supplier: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    active: true,
    image: null,
    ...overrides,
  }
}

/**
 * `porMetodoPago` de un reporte de prueba: todo el dinero en EFECTIVO salvo que
 * se indique otra cosa. La suma de los `totalMinor` siempre es `totalMinor`.
 */
export function methodTotals(
  totalMinor = 0,
  split: Partial<Record<'TRANSFERENCIA' | 'TARJETA', number>> = {},
): PaymentMethodTotals {
  const transferencia = split.TRANSFERENCIA ?? 0
  const tarjeta = split.TARJETA ?? 0
  const efectivo = totalMinor - transferencia - tarjeta
  const line = (value: number) => ({ ventasMinor: value, abonosMinor: 0, totalMinor: value })
  return { EFECTIVO: line(efectivo), TRANSFERENCIA: line(transferencia), TARJETA: line(tarjeta) }
}
