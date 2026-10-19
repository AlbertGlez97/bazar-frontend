// productSubtitle: la línea tenue "Marca · Presentación" que acompaña al nombre.
import { describe, expect, it } from 'vitest'
import { productSubtitle } from '../product-label'

describe('productSubtitle', () => {
  it('marca y presentación juntas con un punto medio', () => {
    expect(productSubtitle({ brand: 'Nike', presentation: 'XL' })).toBe('Nike · XL')
  })

  it('solo la marca', () => {
    expect(productSubtitle({ brand: 'Nike', presentation: null })).toBe('Nike')
  })

  it('solo la presentación', () => {
    expect(productSubtitle({ brand: null, presentation: '24 oz' })).toBe('24 oz')
  })

  it('ninguna: cadena vacía (no se dibuja la línea)', () => {
    expect(productSubtitle({ brand: null, presentation: null })).toBe('')
  })

  it('un producto guardado antes de existir los campos (propiedades ausentes)', () => {
    expect(productSubtitle({})).toBe('')
  })

  it('recorta espacios y trata lo que queda en blanco como ausente', () => {
    expect(productSubtitle({ brand: '  Nike ', presentation: '   ' })).toBe('Nike')
    expect(productSubtitle({ brand: ' ', presentation: ' XL ' })).toBe('XL')
  })

  it('el color dentro de la presentación se respeta tal cual', () => {
    expect(productSubtitle({ brand: 'Casa Vieja', presentation: 'Azul · 28' })).toBe('Casa Vieja · Azul · 28')
  })
})
