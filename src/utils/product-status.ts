import type { Product } from '@/types/product.types'

/**
 * Se puede vender/agregar: `stock` positivo. Único punto de verdad — antes
 * duplicado como `isSoldOut` en SaleCatalogPicker (`stock <= 0`) y como el
 * chequeo inline de ProductCard (`stock > 0`). Ambos coinciden para todo
 * número válido (incluido negativo), pero divergían para `stock === undefined`:
 * `isSoldOut` lo trataba como disponible (comparación con NaN es `false`),
 * ProductCard como agotado. `Product.stock` está tipado `number` no-nulo, así
 * que en la práctica esto no ocurre con datos que respetan el contrato, pero
 * si llegara (dato corrupto, mock incompleto) se trata como NO disponible:
 * no se puede confirmar que hay existencia, y ofrecerlo a la venta arriesga
 * sobrevender.
 */
export function isProductAvailable(product: Product): boolean {
  return typeof product.stock === 'number' && Number.isFinite(product.stock) && product.stock > 0
}
