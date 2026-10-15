import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ActiveFilterChips from '../ActiveFilterChips.vue'

const chips = [
  { key: 'agotados', label: 'Agotados' },
  { key: 'tipo', label: 'Única' },
]
const removeLabel = (label: string) => `Quitar filtro ${label}`

describe('ActiveFilterChips', () => {
  it('sin chips no dibuja nada', () => {
    const wrapper = mount(ActiveFilterChips, { props: { chips: [], label: 'Filtros activos', removeLabel } })

    expect(wrapper.find('ul').exists()).toBe(false)
  })

  it('dibuja un chip por filtro dentro de una lista con nombre', () => {
    const wrapper = mount(ActiveFilterChips, { props: { chips, label: 'Filtros activos', removeLabel } })

    expect(wrapper.get('ul').attributes('aria-label')).toBe('Filtros activos')
    const items = wrapper.findAll('li')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toContain('Agotados')
    expect(items[1]!.text()).toContain('Única')
  })

  it('cada chip tiene una X con nombre accesible que dice qué quita', () => {
    const wrapper = mount(ActiveFilterChips, { props: { chips, label: 'Filtros activos', removeLabel } })

    const buttons = wrapper.findAll('button')
    expect(buttons.map((b) => b.attributes('aria-label'))).toEqual(['Quitar filtro Agotados', 'Quitar filtro Única'])
    expect(buttons.every((b) => b.attributes('type') === 'button')).toBe(true)
  })

  it('emite remove con la llave del chip', async () => {
    const wrapper = mount(ActiveFilterChips, { props: { chips, label: 'Filtros activos', removeLabel } })

    await wrapper.findAll('button')[1]!.trigger('click')

    expect(wrapper.emitted('remove')).toEqual([['tipo']])
  })
})
