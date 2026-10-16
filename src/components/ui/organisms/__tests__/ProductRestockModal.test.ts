import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductRestockModal from '../ProductRestockModal.vue'
import type { Product } from '@/types/product.types'

const product: Product = {
  id: 'p-1', name: 'Lámpara', tipo: 'cantidad', unitPriceMinor: 5000, initialStock: 10, stock: 10,
  category: null, purchaseCostMinor: 1000, supplier: null, notes: null,
  createdAt: '2026-01-01T00:00:00.000Z', active: true, image: null,
}

// AppModal usa <Teleport to="body">: se stubea para que quede dentro del wrapper.
const mountModal = (props: Record<string, unknown> = {}) =>
  mount(ProductRestockModal, {
    props: { modelValue: true, product, ...props },
    global: { stubs: { teleport: true } },
  })

describe('ProductRestockModal', () => {
  it('cerrado no pinta nada', () => {
    const wrapper = mountModal({ modelValue: false })

    expect(wrapper.text()).not.toContain('Reponer existencia')
  })

  it('abierto muestra el título y el formulario del producto', () => {
    const wrapper = mountModal()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    expect(wrapper.get('h2').text()).toBe('Reponer existencia')
    expect(wrapper.text()).toContain('Lámpara')
    expect(wrapper.find('form').exists()).toBe(true)
  })

  it('no trae el pie genérico del modal: el formulario ya tiene sus botones', () => {
    const wrapper = mountModal()

    expect(wrapper.find('.app-modal__footer').exists()).toBe(false)
    expect(wrapper.findAll('button[type="submit"]')).toHaveLength(1)
  })

  it('reenvía lo que emite el formulario', async () => {
    const wrapper = mountModal()
    await wrapper.get('button[data-action="increment"]').trigger('click')

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([[{ quantity: 2 }]])
  })

  it('Cancelar lo cierra', async () => {
    const wrapper = mountModal()

    await wrapper.findAll('button').find((b) => b.text() === 'Cancelar')!.trigger('click')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false])
  })

  it('pasa loading al formulario (botón deshabilitado)', () => {
    const wrapper = mountModal({ loading: true })

    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('cada vez que se abre arranca limpio (no recuerda la captura anterior)', async () => {
    const wrapper = mountModal()
    await wrapper.get('button[data-action="increment"]').trigger('click')
    expect(wrapper.text()).toContain('Después de reponer: 12')

    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true })

    expect(wrapper.text()).toContain('Después de reponer: 11')
  })
})
