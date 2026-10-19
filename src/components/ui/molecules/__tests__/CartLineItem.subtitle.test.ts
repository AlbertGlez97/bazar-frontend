import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CartLineItem from '../CartLineItem.vue'

const line = {
  productId: 'p-1', name: 'Playera', unitPriceMinor: 15000, quantity: 1, tipo: 'cantidad' as 'unica' | 'cantidad',
  stockAvailable: 10, image: null as string | null, brand: null as string | null, presentation: null as string | null,
}

const mountLine = (overrides: Partial<typeof line> = {}) => mount(CartLineItem, { props: { line: { ...line, ...overrides } } })

describe('CartLineItem — marca y presentación', () => {
  it('muestra "Marca · Presentación" bajo el nombre', () => {
    const wrapper = mountLine({ brand: 'Nike', presentation: 'XL' })

    expect(wrapper.get('.cart-line__subtitle').text()).toBe('Nike · XL')
  })

  it('con la talla sola también (lo que distingue una línea de otra)', () => {
    expect(mountLine({ presentation: 'Azul · 28' }).get('.cart-line__subtitle').text()).toBe('Azul · 28')
  })

  it('sin datos no hay línea', () => {
    expect(mountLine().find('.cart-line__subtitle').exists()).toBe(false)
  })

  it('una línea anterior a los campos (sin las propiedades) se ve igual que antes', () => {
    const { brand: _b, presentation: _p, ...old } = line
    const wrapper = mount(CartLineItem, { props: { line: old } })

    expect(wrapper.find('.cart-line__subtitle').exists()).toBe(false)
  })

  it('se trunca en una línea y su título trae el texto completo', () => {
    const wrapper = mountLine({ brand: 'Marca', presentation: 'Muy larga '.repeat(8) })

    expect(wrapper.get('.cart-line__subtitle').attributes('title')).toContain('Marca · Muy larga')
  })

  it('el nombre accesible distingue las líneas del mismo producto: "Quitar Playera, Nike · XL"', () => {
    const wrapper = mountLine({ brand: 'Nike', presentation: 'XL' })

    expect(wrapper.get('[data-action="remove"]').attributes('aria-label')).toBe('Quitar Playera, Nike · XL')
  })

  it('sin datos el nombre accesible es el de siempre', () => {
    expect(mountLine().get('[data-action="remove"]').attributes('aria-label')).toBe('Quitar Playera')
  })

  it('el selector de cantidad también nombra la talla', () => {
    const wrapper = mountLine({ presentation: 'XL' })

    expect(wrapper.html()).toContain('Playera, XL')
  })
})
