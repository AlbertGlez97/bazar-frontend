import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductForm from '../ProductForm.vue'
import ProductFormModal from '../ProductFormModal.vue'
import type { Product } from '@/types/product.types'

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p-1', name: 'Lámpara', tipo: 'cantidad', unitPriceMinor: 5000, initialStock: 10, stock: 8,
  category: null, purchaseCostMinor: 1000, supplier: null, notes: null,
  createdAt: '2026-01-01T00:00:00.000Z', active: true, image: null, ...overrides,
})

const restockButton = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('button').find((b) => b.text() === 'Reponer existencia')

beforeEach(() => {
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock')
  globalThis.URL.revokeObjectURL = vi.fn()
})

describe('ProductForm — existencia y "Reponer existencia" (edición)', () => {
  it('ya no manda a una sección de inventario que no existe', () => {
    const wrapper = mount(ProductForm, { props: { product: product() } })

    expect(wrapper.text()).not.toContain('ventas/inventario')
  })

  it('dice la existencia actual y cómo sumar piezas', () => {
    const wrapper = mount(ProductForm, { props: { product: product() } })

    expect(wrapper.text()).toContain('Existencia actual: 8')
    expect(wrapper.text()).toContain('«Reponer existencia»')
  })

  it('ofrece el botón y avisa con restock al tocarlo', async () => {
    const wrapper = mount(ProductForm, { props: { product: product() } })

    await restockButton(wrapper)!.trigger('click')

    expect(wrapper.emitted('restock')).toHaveLength(1)
  })

  it('el botón no envía el formulario de edición', async () => {
    const wrapper = mount(ProductForm, { props: { product: product() } })

    await restockButton(wrapper)!.trigger('click')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(restockButton(wrapper)!.attributes('type')).toBe('button')
  })

  it('una pieza única: no hay botón y se dice por qué', () => {
    const wrapper = mount(ProductForm, { props: { product: product({ tipo: 'unica', stock: 0 }) } })

    expect(restockButton(wrapper)).toBeUndefined()
    expect(wrapper.text()).toContain('Es una pieza única: no se repone.')
  })

  it('un producto desactivado: no hay botón y se dice cómo seguir', () => {
    const wrapper = mount(ProductForm, { props: { product: product({ active: false }) } })

    expect(restockButton(wrapper)).toBeUndefined()
    expect(wrapper.text()).toContain('Está desactivado: reactívalo para reponerlo.')
  })

  it('al crear un producto no hay existencia que reponer', () => {
    const wrapper = mount(ProductForm)

    expect(restockButton(wrapper)).toBeUndefined()
    expect(wrapper.text()).not.toContain('Existencia actual')
  })
})

describe('ProductFormModal — reenvía "restock"', () => {
  it('emite restock cuando el formulario lo pide', async () => {
    const wrapper = mount(ProductFormModal, {
      props: { modelValue: true, product: product() },
      global: { stubs: { teleport: true } },
    })

    await restockButton(wrapper)!.trigger('click')

    expect(wrapper.emitted('restock')).toHaveLength(1)
  })
})
