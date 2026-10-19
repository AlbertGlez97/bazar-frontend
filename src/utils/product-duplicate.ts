import type { Product, ProductDraft } from '@/types/product.types'

/**
 * "Crear otro igual": copia de un producto lo que se repite entre sus combinaciones
 * (modelo, talla, color) y deja fuera lo que es propio de cada una: la presentación
 * y la existencia. Tampoco copia la identidad (id, fechas, activo).
 */
export function duplicateDraft(product: Product): ProductDraft {
  return {
    sourceId: product.id,
    name: product.name,
    tipo: product.tipo,
    brand: product.brand ?? null,
    category: product.category,
    unitPriceMinor: product.unitPriceMinor,
    purchaseCostMinor: product.purchaseCostMinor ?? null,
    supplier: product.supplier,
    notes: product.notes,
    description: product.description ?? null,
    imageUrl: product.image,
  }
}
