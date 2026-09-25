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

  describe('tamaño (size)', () => {
    it('por defecto es "default" y no usa la variante grande', () => {
      const wrapper = mount(ProductCard, { props: { product: baseProduct } })
      expect(wrapper.get('.product-card').classes()).toContain('product-card--default')
      expect(wrapper.get('.product-card').classes()).not.toContain('product-card--large')
    })

    it('size="large" aplica la variante grande y conserva nombre y precio', () => {
      const wrapper = mount(ProductCard, { props: { product: baseProduct, size: 'large' } })
      expect(wrapper.get('.product-card').classes()).toContain('product-card--large')
      expect(wrapper.get('.product-card').classes()).not.toContain('product-card--default')
      expect(wrapper.get('.product-card__name').text()).toBe('Consola PS5 usada')
      expect(wrapper.get('.product-card__price').text()).toBe('$8500.00')
    })

    it('en grande la disponibilidad se simplifica a Disponible / Agotado también para tipo cantidad', () => {
      const cantidad = { ...baseProduct, tipo: 'cantidad' as const, stock: 7, initialStock: 10 }
      const disponible = mount(ProductCard, { props: { product: cantidad, size: 'large' } })
      expect(disponible.text()).toContain('Disponible')
      expect(disponible.text()).not.toContain('en existencia')

      const agotado = mount(ProductCard, { props: { product: { ...cantidad, stock: 0 }, size: 'large' } })
      expect(agotado.text()).toContain('Agotado')
    })

    it('en tamaño normal tipo cantidad sigue mostrando las existencias', () => {
      const wrapper = mount(ProductCard, {
        props: { product: { ...baseProduct, tipo: 'cantidad', stock: 7, initialStock: 10 }, size: 'default' },
      })
      expect(wrapper.text()).toContain('7 en existencia')
    })

    it('no expone costo ni proveedor en ningún tamaño', () => {
      const withPrivate = { ...baseProduct, purchaseCostMinor: 500000, supplier: 'Proveedor Secreto' }
      for (const size of ['default', 'large'] as const) {
        const text = mount(ProductCard, { props: { product: withPrivate, size } }).text()
        expect(text).not.toContain('Proveedor Secreto')
        expect(text).not.toContain('5000.00')
      }
    })
  })

  it('emite "reactivate" cuando el producto está inactivo', async () => {
    const inactive = { ...baseProduct, active: false }
    const wrapper = mount(ProductCard, { props: { product: inactive, showActions: true } })
    const buttons = wrapper.findAll('button')

    await buttons[1].trigger('click')
    expect(wrapper.emitted('reactivate')?.[0]).toEqual([inactive])
  })
})
