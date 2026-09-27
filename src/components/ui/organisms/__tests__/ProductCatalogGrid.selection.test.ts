import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductCatalogGrid from '../ProductCatalogGrid.vue'
import type { Product } from '@/types/product.types'

const make = (n: number, overrides: Partial<Product> = {}): Product => ({
  id: `01a0ddd7-7f00-744a-8b23-${String(n).padStart(12, '0')}`, name: `Producto ${n}`, tipo: 'unica', unitPriceMinor: 1000, initialStock: 1, stock: 1,
  category: null, purchaseCostMinor: null, supplier: null, notes: null, createdAt: '2026-01-01T00:00:00.000Z', active: true, image: null, ...overrides,
})
const products = [make(1), make(2), make(3)]
const boxes = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('input[type="checkbox"]')

describe('ProductCatalogGrid — modo selección', () => {
  it('sin modo selección no hay casillas', () => {
    const wrapper = mount(ProductCatalogGrid, { props: { products, page: 1, totalPages: 1 } })
    expect(boxes(wrapper)).toHaveLength(0)
  })

  it('en modo selección cada tarjeta trae su casilla', () => {
    const wrapper = mount(ProductCatalogGrid, { props: { products, page: 1, totalPages: 1, selectionMode: true, selectedIds: [] } })
    expect(boxes(wrapper)).toHaveLength(3)
  })

  it('marca las casillas de los ids seleccionados (incluidos los de otras páginas no se ven)', () => {
    const wrapper = mount(ProductCatalogGrid, {
      props: { products, page: 1, totalPages: 1, selectionMode: true, selectedIds: [products[1]!.id, make(99).id] },
    })
    const checked = boxes(wrapper).map((b) => (b.element as HTMLInputElement).checked)
    expect(checked).toEqual([false, true, false])
  })

  it('reenvía toggle-select con el producto tocado', async () => {
    const wrapper = mount(ProductCatalogGrid, { props: { products, page: 1, totalPages: 1, selectionMode: true, selectedIds: [] } })
    await boxes(wrapper)[2]!.setValue(true)
    expect(wrapper.emitted('toggle-select')).toEqual([[products[2]]])
  })

  it('en Modo Venta no se ofrece selección aunque el padre la pida (imprimir etiquetas es gestión)', () => {
    const wrapper = mount(ProductCatalogGrid, { props: { products, page: 1, totalPages: 1, mode: 'venta', selectionMode: true, selectedIds: [] } })
    expect(boxes(wrapper)).toHaveLength(0)
  })

  it('un producto inactivo aparece pero su casilla está deshabilitada', () => {
    const wrapper = mount(ProductCatalogGrid, {
      props: { products: [make(1), make(2, { active: false })], page: 1, totalPages: 1, selectionMode: true, selectedIds: [] },
    })
    expect(boxes(wrapper).map((b) => b.attributes('disabled') !== undefined)).toEqual([false, true])
  })
})
