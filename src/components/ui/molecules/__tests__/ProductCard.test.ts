import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductCard from '../ProductCard.vue'
import type { Product } from '@/types/product.types'

const baseProduct: Product = {
  id: 'p-1',
  name: 'Consola PS5 usada',
  tipo: 'unica',
  unitPriceMinor: 850000,
  initialStock: 1,
  stock: 1,
  category: null,
  purchaseCostMinor: null,
  supplier: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  active: true,
  image: null,
}

describe('ProductCard', () => {
  it('renderiza nombre y precio formateado en pesos', () => {
    const wrapper = mount(ProductCard, { props: { product: baseProduct } })
    expect(wrapper.text()).toContain('Consola PS5 usada')
    expect(wrapper.text()).toContain('8500.00')
  })

  it('muestra placeholder cuando no hay imagen', () => {
    const wrapper = mount(ProductCard, { props: { product: baseProduct } })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('.product-card__placeholder').exists()).toBe(true)
  })

  it('renderiza la imagen cuando el producto la tiene', () => {
    const wrapper = mount(ProductCard, {
      props: { product: { ...baseProduct, image: '/uploads/products/a.png' } },
    })
    expect(wrapper.find('img').attributes('src')).toBe('/uploads/products/a.png')
  })

  it('muestra "Disponible"/"Agotado" para tipo unica según stock', () => {
    const disponible = mount(ProductCard, { props: { product: baseProduct } })
    expect(disponible.text()).toContain('Disponible')

    const agotado = mount(ProductCard, { props: { product: { ...baseProduct, stock: 0 } } })
    expect(agotado.text()).toContain('Agotado')
  })

  it('muestra el número de existencias para tipo cantidad', () => {
    const wrapper = mount(ProductCard, {
      props: { product: { ...baseProduct, tipo: 'cantidad', stock: 7, initialStock: 10 } },
    })
    expect(wrapper.text()).toContain('7 en existencia')
  })

  it('muestra el badge de inactivo cuando active=false', () => {
    const wrapper = mount(ProductCard, { props: { product: { ...baseProduct, active: false } } })
    expect(wrapper.text()).toContain('Inactivo')
  })

  it('no muestra acciones si showActions es false', () => {
    const wrapper = mount(ProductCard, { props: { product: baseProduct, showActions: false } })
    expect(wrapper.find('.product-card__footer').exists()).toBe(false)
  })

  it('emite "edit" y "deactivate" al hacer click en las acciones', async () => {
    const wrapper = mount(ProductCard, { props: { product: baseProduct, showActions: true } })
    const buttons = wrapper.findAll('button')

    await buttons[0].trigger('click')
    expect(wrapper.emitted('edit')?.[0]).toEqual([baseProduct])

    await buttons[1].trigger('click')
    expect(wrapper.emitted('deactivate')?.[0]).toEqual([baseProduct])
  })

  it('emite "reactivate" cuando el producto está inactivo', async () => {
    const inactive = { ...baseProduct, active: false }
    const wrapper = mount(ProductCard, { props: { product: inactive, showActions: true } })
    const buttons = wrapper.findAll('button')

    await buttons[1].trigger('click')
    expect(wrapper.emitted('reactivate')?.[0]).toEqual([inactive])
  })
})
