import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductCard from '../ProductCard.vue'
import { VOICE } from '@/config/voice'
import type { Product } from '@/types/product.types'

const base: Product = {
  id: '01a0ddd7-7f00-744a-8b23-72c005912b97', name: 'Bonsái Ficus', tipo: 'unica', unitPriceMinor: 150000, initialStock: 1, stock: 1,
  category: null, purchaseCostMinor: null, supplier: null, notes: null, createdAt: '2026-01-01T00:00:00.000Z', active: true, image: null,
}
const checkbox = (wrapper: ReturnType<typeof mount>) => wrapper.find('input[type="checkbox"]')

describe('ProductCard — selección para imprimir QR', () => {
  it('sin selección no hay casilla (el catálogo se ve igual que siempre)', () => {
    const wrapper = mount(ProductCard, { props: { product: base } })
    expect(checkbox(wrapper).exists()).toBe(false)
  })

  it('con selección muestra una casilla con nombre accesible', () => {
    const wrapper = mount(ProductCard, { props: { product: base, selectable: true } })
    const input = checkbox(wrapper)
    expect(input.exists()).toBe(true)
    expect(input.attributes('aria-label')).toBe(VOICE.labels.checkboxLabel('Bonsái Ficus'))
  })

  it('refleja si está seleccionado', () => {
    const on = mount(ProductCard, { props: { product: base, selectable: true, selected: true } })
    const off = mount(ProductCard, { props: { product: base, selectable: true, selected: false } })
    expect((checkbox(on).element as HTMLInputElement).checked).toBe(true)
    expect((checkbox(off).element as HTMLInputElement).checked).toBe(false)
    // La plantilla empieza con un comentario HTML (fragmento): se consulta la tarjeta, no el wrapper.
    expect(on.find('.product-card').classes()).toContain('product-card--selected')
    expect(off.find('.product-card').classes()).not.toContain('product-card--selected')
  })

  it('al marcarla emite toggle-select con el producto', async () => {
    const wrapper = mount(ProductCard, { props: { product: base, selectable: true } })
    await checkbox(wrapper).setValue(true)
    expect(wrapper.emitted('toggle-select')).toEqual([[base]])
  })

  it('un producto inactivo no se puede marcar y explica por qué', () => {
    const inactive = { ...base, active: false }
    const wrapper = mount(ProductCard, { props: { product: inactive, selectable: true } })
    expect(checkbox(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain(VOICE.labels.inactiveHint)
  })

  it('la casilla se puede usar con el teclado (es un input nativo enfocable)', () => {
    const wrapper = mount(ProductCard, { props: { product: base, selectable: true } })
    expect(checkbox(wrapper).attributes('tabindex')).not.toBe('-1')
  })

  it('las acciones de gestión siguen ahí junto a la casilla', () => {
    const wrapper = mount(ProductCard, { props: { product: base, selectable: true, showActions: true } })
    expect(wrapper.text()).toContain('Editar')
  })
})
