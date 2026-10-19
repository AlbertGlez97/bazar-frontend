// El carrito guarda la marca y la presentación que vio quien vende, para mostrarlas en cada línea.
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCartStore } from '../cart.store'
import type { CartProductInput } from '../cart.store'

const product = (overrides: Partial<CartProductInput> = {}): CartProductInput => ({
  id: 'p-1', name: 'Playera', unitPriceMinor: 15000, tipo: 'cantidad', stock: 10, image: null, ...overrides,
})

beforeEach(() => setActivePinia(createPinia()))

describe('cart.store — marca y presentación', () => {
  it('la línea lleva la marca y la presentación del producto', () => {
    const cart = useCartStore()

    cart.add(product({ brand: 'Nike', presentation: 'XL' }))

    expect(cart.lines[0]).toMatchObject({ brand: 'Nike', presentation: 'XL' })
  })

  it('un producto sin ellas (o del catálogo guardado de antes) queda con nulos', () => {
    const cart = useCartStore()

    cart.add(product())

    expect(cart.lines[0]).toMatchObject({ brand: null, presentation: null })
  })

  it('dos tallas del mismo modelo son dos líneas distintas, cada una con la suya', () => {
    const cart = useCartStore()

    cart.add(product({ id: 'a', presentation: 'M' }))
    cart.add(product({ id: 'b', presentation: 'L' }))

    expect(cart.lines.map((line) => line.presentation)).toEqual(['M', 'L'])
  })

  it('agregar de nuevo el mismo no cambia lo guardado', () => {
    const cart = useCartStore()
    cart.add(product({ presentation: 'M' }))

    cart.add(product({ presentation: 'M' }))

    expect(cart.lines).toHaveLength(1)
    expect(cart.lines[0].quantity).toBe(2)
  })
})
