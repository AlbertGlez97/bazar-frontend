import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductFormModal from '../ProductFormModal.vue'
import type { Product } from '@/types/product.types'

const product: Product = {
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
}

beforeEach(() => {
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock')
  globalThis.URL.revokeObjectURL = vi.fn()
})

describe('ProductFormModal', () => {
  it('muestra el título "Nuevo producto" cuando no hay producto', () => {
    const wrapper = mount(ProductFormModal, { props: { modelValue: true, product: null } })
    expect(wrapper.text()).toContain('Nuevo producto')
  })

  it('muestra el título "Editar producto" cuando hay producto', () => {
    const wrapper = mount(ProductFormModal, { props: { modelValue: true, product } })
    expect(wrapper.text()).toContain('Editar producto')
  })

  it('reenvía el evento submit de ProductForm', async () => {
    const wrapper = mount(ProductFormModal, { props: { modelValue: true, product } })
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')).toBeTruthy()
  })

  it('cierra el modal (update:modelValue false) al cancelar', async () => {
    const wrapper = mount(ProductFormModal, { props: { modelValue: true, product } })
    const cancelButton = wrapper.findAll('button').find((b) => b.text() === 'Cancelar')
    await cancelButton?.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false])
  })
})
