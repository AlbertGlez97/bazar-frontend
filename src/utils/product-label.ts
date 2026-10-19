import type { Product } from '@/types/product.types'

/**
 * La línea tenue que acompaña al nombre de un producto: "Marca · Presentación".
 * Solo con lo que exista; sin ninguno de los dos es cadena vacía y quien la muestra
 * no dibuja la línea. Acepta un producto guardado antes de que existieran los campos.
 */
export function productSubtitle(product: Pick<Partial<Product>, 'brand' | 'presentation'>): string {
  return [product.brand, product.presentation]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part !== '')
    .join(' · ')
}
