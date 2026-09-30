// isProductAvailable: predicado único de "se puede vender", antes duplicado como
// `isSoldOut` (SaleCatalogPicker, `stock <= 0`) y como el chequeo inline de
// ProductCard (`stock > 0`). `Product.stock` está tipado `number` no-nulo, pero
// el predicado también se prueba con valores fuera de ese contrato (null,
// undefined, NaN) porque el runtime no garantiza lo que promete el tipo.
import { describe, expect, it } from 'vitest'
import { isProductAvailable } from '../product-status'
import { makeProduct } from '@/test/factories'
import type { Product } from '@/types/product.types'

describe('isProductAvailable', () => {
  it('con stock positivo, disponible', () => {
    expect(isProductAvailable(makeProduct({ stock: 7 }))).toBe(true)
  })

  it('con stock en cero, no disponible', () => {
    expect(isProductAvailable(makeProduct({ stock: 0 }))).toBe(false)
  })

  it('con stock negativo, no disponible', () => {
    expect(isProductAvailable(makeProduct({ stock: -1 }))).toBe(false)
  })

  // Fuera del contrato de tipos (Product.stock es `number` no-nulo): el
  // predicado unificado trata estos valores como "no disponible" — no se
  // puede confirmar que hay existencia, así que no se ofrece a la venta.
  it('con stock null, no disponible (no se puede confirmar existencia)', () => {
    const product = { ...makeProduct(), stock: null } as unknown as Product
    expect(isProductAvailable(product)).toBe(false)
  })

  it('con stock undefined, no disponible (antes divergía: isSoldOut decía que sí)', () => {
    const product = { ...makeProduct(), stock: undefined } as unknown as Product
    expect(isProductAvailable(product)).toBe(false)
  })

  it('con stock NaN, no disponible', () => {
    expect(isProductAvailable(makeProduct({ stock: Number.NaN }))).toBe(false)
  })
})
