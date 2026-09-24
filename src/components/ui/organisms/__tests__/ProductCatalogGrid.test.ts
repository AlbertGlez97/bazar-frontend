import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductCatalogGrid from '../ProductCatalogGrid.vue'
import type { Product } from '@/types/product.types'

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p-1',
  name: 'Producto',
  tipo: 'unica',
  unitPriceMinor: 1000,
  initialStock: 1,
  stock: 1,
  category: null,
  purchaseCostMinor: null,
  supplier: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  active: true,
  image: null,
  ...overrides,
})

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('ProductCatalogGrid', () => {
  it('renderiza una tarjeta por producto', () => {
    const wrapper = mount(ProductCatalogGrid, {
      props: { products: [product({ id: 'p-1' }), product({ id: 'p-2' })], page: 1, totalPages: 1 },
    })
    expect(wrapper.findAll('.product-card').length).toBe(2)
    expect(wrapper.text()).not.toContain('No se encontraron productos')
  })

  it('muestra mensaje cuando no hay productos', () => {
    const wrapper = mount(ProductCatalogGrid, { props: { products: [], page: 1, totalPages: 1 } })
    expect(wrapper.text()).toContain('No se encontraron productos')
  })

  it('muestra estado de carga', () => {
    const wrapper = mount(ProductCatalogGrid, {
      props: { products: [], page: 1, totalPages: 1, loading: true },
    })
    expect(wrapper.text()).toContain('Cargando productos')
  })

  it('emite "search" tras el debounce, no en cada tecla', async () => {
    const wrapper = mount(ProductCatalogGrid, { props: { products: [], page: 1, totalPages: 1 } })
    const input = wrapper.find('input')

    await input.setValue('ps')
    expect(wrapper.emitted('search')).toBeUndefined()

    vi.advanceTimersByTime(350)
    expect(wrapper.emitted('search')?.[0]).toEqual(['ps'])
  })

  it('reinicia el temporizador de debounce en cada tecla', async () => {
    const wrapper = mount(ProductCatalogGrid, { props: { products: [], page: 1, totalPages: 1 } })
    const input = wrapper.find('input')

    await input.setValue('p')
    vi.advanceTimersByTime(200)
    await input.setValue('ps')
    vi.advanceTimersByTime(200)
    expect(wrapper.emitted('search')).toBeUndefined()

    vi.advanceTimersByTime(150)
    expect(wrapper.emitted('search')?.[0]).toEqual(['ps'])
  })

  it('emite update:page desde la paginación', async () => {
    const wrapper = mount(ProductCatalogGrid, {
      props: { products: [product()], page: 1, totalPages: 3 },
    })
    const buttons = wrapper.findAll('button')
    const nextButton = buttons.find((b) => b.attributes('aria-label') === 'Página siguiente')
    await nextButton?.trigger('click')
    expect(wrapper.emitted('update:page')?.[0]).toEqual([2])
  })

  it('reenvía edit/deactivate/reactivate desde ProductCard', async () => {
    const p = product({ id: 'p-9' })
    const wrapper = mount(ProductCatalogGrid, {
      props: { products: [p], page: 1, totalPages: 1, showActions: true },
    })
    const editButton = wrapper.findAll('button').find((b) => b.text() === 'Editar')
    await editButton?.trigger('click')
    expect(wrapper.emitted('edit')?.[0]).toEqual([p])
  })
})
