// La línea tenue "Marca · Presentación" bajo el nombre del producto.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductCard from '../ProductCard.vue'
import source from '../ProductCard.vue?raw'
import { makeProduct } from '@/test/factories'

const css = source.slice(source.indexOf('<style')).replace(/<style[^>]*>/, '').replace(/\/\*[\s\S]*?\*\//g, '')
const rule = (selector: string) =>
  [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter(([, selectors]) => selectors!.split(',').map((part) => part.trim()).includes(selector))
    .map(([, , body]) => body)
    .join(';')

const subtitle = (wrapper: ReturnType<typeof mount>) => wrapper.find('.product-card__subtitle')

describe('ProductCard — marca y presentación', () => {
  it.each(['default', 'large', 'compact', 'list'] as const)('se ve en el tamaño %s', (size) => {
    const wrapper = mount(ProductCard, { props: { product: makeProduct({ brand: 'Nike', presentation: 'XL' }), size } })

    expect(subtitle(wrapper).text()).toBe('Nike · XL')
  })

  it('va después del nombre y antes del precio', () => {
    const wrapper = mount(ProductCard, { props: { product: makeProduct({ name: 'Playera', brand: 'Nike' }) } })
    const order = wrapper.findAll('.product-card__name, .product-card__subtitle, .product-card__price').map((el) => el.classes()[0])

    expect(order).toEqual(['product-card__name', 'product-card__subtitle', 'product-card__price'])
  })

  it('solo marca, o solo presentación', () => {
    expect(subtitle(mount(ProductCard, { props: { product: makeProduct({ brand: 'Nike' }) } })).text()).toBe('Nike')
    expect(subtitle(mount(ProductCard, { props: { product: makeProduct({ presentation: '24 oz' }) } })).text()).toBe('24 oz')
  })

  it('sin ninguna, no dibuja la línea (el producto de antes se ve igual)', () => {
    expect(subtitle(mount(ProductCard, { props: { product: makeProduct() } })).exists()).toBe(false)
  })

  it('el texto completo está en el título (tooltip) por si se trunca', () => {
    const long = 'Presentación muy larga que no cabe en la tarjeta de dos columnas'
    const wrapper = mount(ProductCard, { props: { product: makeProduct({ brand: 'Marca', presentation: long }) } })

    expect(subtitle(wrapper).attributes('title')).toBe(`Marca · ${long}`)
  })

  it('es tenue y se trunca con puntos suspensivos en una línea', () => {
    const body = rule('.product-card__subtitle')

    expect(body).toMatch(/color:\s*var\(--color-text-muted\)/)
    expect(body).toMatch(/white-space:\s*nowrap/)
    expect(body).toMatch(/overflow:\s*hidden/)
    expect(body).toMatch(/text-overflow:\s*ellipsis/)
  })

  it('en la tarjeta de lista conserva la columna del nombre (no empuja al precio)', () => {
    const wrapper = mount(ProductCard, { props: { product: makeProduct({ name: 'Playera', brand: 'Nike' }), size: 'list' } })

    expect(wrapper.find('.product-card__text').exists()).toBe(true)
    expect(wrapper.find('.product-card__text .product-card__name').exists()).toBe(true)
    expect(wrapper.find('.product-card__text .product-card__subtitle').exists()).toBe(true)
  })
})
