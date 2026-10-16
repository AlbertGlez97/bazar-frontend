import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductCard from '../ProductCard.vue'
import ProductCatalogGrid from '../ProductCatalogGrid.vue'
import type { Product } from '@/types/product.types'

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p-1', name: 'Lámpara', tipo: 'cantidad', unitPriceMinor: 5000, initialStock: 10, stock: 3,
  category: null, purchaseCostMinor: 1000, supplier: null, notes: null,
  createdAt: '2026-01-01T00:00:00.000Z', active: true, image: null, ...overrides,
})

const restockButton = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('button').find((b) => b.text() === 'Reponer')

describe('ProductCard — acción "Reponer"', () => {
  it('un producto por cantidad, activo y con acciones habilitadas la ofrece', () => {
    const wrapper = mount(ProductCard, { props: { product: product(), showActions: true } })

    expect(restockButton(wrapper)).toBeDefined()
  })

  it('su nombre accesible dice de qué producto es', () => {
    const wrapper = mount(ProductCard, { props: { product: product(), showActions: true } })

    expect(restockButton(wrapper)!.attributes('aria-label')).toBe('Reponer existencia de Lámpara')
  })

  it('al tocarla emite restock con el producto', async () => {
    const item = product()
    const wrapper = mount(ProductCard, { props: { product: item, showActions: true } })

    await restockButton(wrapper)!.trigger('click')

    expect(wrapper.emitted('restock')).toEqual([[item]])
  })

  it('también se ofrece en un producto agotado (justo cuando hace falta)', () => {
    const wrapper = mount(ProductCard, { props: { product: product({ stock: 0 }), showActions: true } })

    expect(restockButton(wrapper)).toBeDefined()
  })

  it('también en la fila de la vista de lista', () => {
    const wrapper = mount(ProductCard, { props: { product: product(), showActions: true, size: 'list' } })

    expect(restockButton(wrapper)).toBeDefined()
  })

  it.each([
    ['una pieza única', product({ tipo: 'unica', stock: 0 })],
    ['un producto desactivado', product({ active: false })],
  ])('no se ofrece en %s', (_label, item) => {
    const wrapper = mount(ProductCard, { props: { product: item, showActions: true } })

    expect(restockButton(wrapper)).toBeUndefined()
  })

  it('sin acciones (colaborador o Modo Venta) no se ofrece', () => {
    const wrapper = mount(ProductCard, { props: { product: product(), showActions: false } })

    expect(restockButton(wrapper)).toBeUndefined()
  })

  it('no estorba a Editar y Desactivar', () => {
    const wrapper = mount(ProductCard, { props: { product: product(), showActions: true } })
    const texts = wrapper.findAll('button').map((b) => b.text())

    expect(texts).toEqual(expect.arrayContaining(['Editar', 'Reponer', 'Desactivar']))
  })
})

describe('ProductCatalogGrid — reenvía "restock"', () => {
  it('emite restock con el producto de la tarjeta tocada', async () => {
    const item = product({ id: 'p-9', name: 'Taza' })
    const wrapper = mount(ProductCatalogGrid, {
      props: { products: [product(), item], page: 1, totalPages: 1, showActions: true },
    })

    const cards = wrapper.findAll('.product-card')
    await cards[1]!.findAll('button').find((b) => b.text() === 'Reponer')!.trigger('click')

    expect(wrapper.emitted('restock')).toEqual([[item]])
  })

  it('en Modo Venta no hay botón Reponer aunque el padre habilite las acciones', () => {
    const wrapper = mount(ProductCatalogGrid, {
      props: { products: [product()], page: 1, totalPages: 1, showActions: true, mode: 'venta' },
    })

    expect(restockButton(wrapper)).toBeUndefined()
  })
})
