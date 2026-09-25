import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CategoryQuickFilter from '../CategoryQuickFilter.vue'

function mountFilter(props: { categories?: string[]; modelValue?: string } = {}) {
  return mount(CategoryQuickFilter, {
    props: { categories: ['Bebidas', 'Dulces', 'Ropa'], modelValue: '', ...props },
  })
}

const buttons = (w: ReturnType<typeof mountFilter>) => w.findAll('button')

describe('CategoryQuickFilter', () => {
  it('muestra "Todo" primero y luego cada categoría, como botones reales', () => {
    const wrapper = mountFilter()
    expect(buttons(wrapper).map((b) => b.text())).toEqual(['Todo', 'Bebidas', 'Dulces', 'Ropa'])
    expect(buttons(wrapper).every((b) => b.attributes('type') === 'button')).toBe(true)
  })

  it('es un grupo con nombre', () => {
    expect(mountFilter().get('[role="group"]').attributes('aria-label')).toBe('Filtrar por categoría')
  })

  it('"Todo" está presionado cuando no hay categoría elegida', () => {
    const wrapper = mountFilter({ modelValue: '' })
    expect(buttons(wrapper).map((b) => b.attributes('aria-pressed'))).toEqual(['true', 'false', 'false', 'false'])
  })

  it('marca (aria-pressed) solo la categoría elegida', () => {
    const wrapper = mountFilter({ modelValue: 'Dulces' })
    expect(buttons(wrapper).map((b) => b.attributes('aria-pressed'))).toEqual(['false', 'false', 'true', 'false'])
  })

  it('tocar una categoría emite su nombre; "Todo" emite cadena vacía', async () => {
    const wrapper = mountFilter({ modelValue: 'Ropa' })
    await buttons(wrapper)[1].trigger('click')
    await buttons(wrapper)[0].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['Bebidas'], ['']])
  })

  it('tocar la categoría ya elegida no la apaga: vuelve a emitirla (no hay "nada seleccionado")', async () => {
    const wrapper = mountFilter({ modelValue: 'Ropa' })
    await buttons(wrapper)[3].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['Ropa']])
  })

  it('sin categorías no dibuja nada (no hay qué filtrar)', () => {
    const wrapper = mountFilter({ categories: [] })
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('el marcado activo también se ve en clase (además del color, lleva aria-pressed)', () => {
    const wrapper = mountFilter({ modelValue: 'Bebidas' })
    expect(buttons(wrapper)[1].classes()).toContain('category-filter__btn--active')
    expect(buttons(wrapper)[0].classes()).not.toContain('category-filter__btn--active')
  })
})
