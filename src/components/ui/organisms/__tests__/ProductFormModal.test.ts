import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
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

// AppModal usa <Teleport to="body">: se stubea para que el contenido del modal
// quede dentro del wrapper y sea consultable desde el test.
const mountOptions = { global: { stubs: { teleport: true } } }

beforeEach(() => {
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock')
  globalThis.URL.revokeObjectURL = vi.fn()
})

describe('ProductFormModal — QR del producto', () => {
  const uuidProduct: Product = { ...product, id: '01a0ddd7-7f00-744a-8b23-72c005912b97', name: 'Bonsái Ficus' }

  it('en edición, con un producto que ya tiene id, muestra su QR y el botón de descarga', async () => {
    const wrapper = mount(ProductFormModal, { props: { modelValue: true, product: uuidProduct }, ...mountOptions })
    await vi.waitFor(() => {
      expect(wrapper.find('img[alt="Código QR de Bonsái Ficus"]').exists()).toBe(true)
    })
    expect(wrapper.text()).toContain('Descargar QR')
  })

  it('en creación NO muestra ningún QR (el producto todavía no tiene id)', async () => {
    const wrapper = mount(ProductFormModal, { props: { modelValue: true, product: null }, ...mountOptions })
    await flushPromises()
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Descargar QR')
  })

  it('un id que no es UUID no genera QR (no lo podría leer el escáner)', async () => {
    const wrapper = mount(ProductFormModal, { props: { modelValue: true, product }, ...mountOptions })
    await flushPromises()
    expect(wrapper.find('img').exists()).toBe(false)
  })
})

describe('ProductFormModal', () => {
  it('muestra el título "Nuevo producto" cuando no hay producto', () => {
    const wrapper = mount(ProductFormModal, { props: { modelValue: true, product: null }, ...mountOptions })
    expect(wrapper.text()).toContain('Nuevo producto')
  })

  it('muestra el título "Editar producto" cuando hay producto', () => {
    const wrapper = mount(ProductFormModal, { props: { modelValue: true, product }, ...mountOptions })
    expect(wrapper.text()).toContain('Editar producto')
  })

  it('reenvía el evento submit de ProductForm', async () => {
    const wrapper = mount(ProductFormModal, { props: { modelValue: true, product }, ...mountOptions })
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')).toBeTruthy()
  })

  it('cierra el modal (update:modelValue false) al cancelar', async () => {
    const wrapper = mount(ProductFormModal, { props: { modelValue: true, product }, ...mountOptions })
    const cancelButton = wrapper.findAll('button').find((b) => b.text() === 'Cancelar')
    await cancelButton?.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false])
  })
})
