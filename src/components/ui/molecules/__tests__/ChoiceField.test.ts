import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ChoiceField from '../ChoiceField.vue'
import FilterSwitchRow from '../FilterSwitchRow.vue'
import AppHint from '../../atoms/AppHint.vue'

const options = [{ value: 'a', label: 'Uno' }, { value: 'b', label: 'Dos' }]

describe('AppHint', () => {
  it('muestra la línea de ayuda', () => {
    expect(mount(AppHint, { slots: { default: 'Una ayuda corta' } }).get('p.app-hint').text()).toBe('Una ayuda corta')
  })
})

describe('ChoiceField', () => {
  it('muestra título, opciones y la línea de por qué; marca la elegida', () => {
    const wrapper = mount(ChoiceField, { props: { label: 'Columnas', modelValue: 'b', options, hint: 'Dos cabe bien.' } })
    expect(wrapper.text()).toContain('Columnas')
    expect(wrapper.text()).toContain('Dos cabe bien.')
    expect(wrapper.get('[data-value="b"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-value="a"]').attributes('aria-pressed')).toBe('false')
    expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe('Columnas')
  })

  it('emite la opción nueva y nada si se toca la que ya estaba', async () => {
    const wrapper = mount(ChoiceField, { props: { label: 'Columnas', modelValue: 'a', options } })
    await wrapper.get('[data-value="a"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await wrapper.get('[data-value="b"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['b']])
  })

  it('sin ayuda no deja un párrafo vacío', () => {
    expect(mount(ChoiceField, { props: { label: 'Columnas', modelValue: 'a', options } }).find('.app-hint').exists()).toBe(false)
  })
})

describe('FilterSwitchRow con ayuda', () => {
  it('la línea de ayuda es opcional y va bajo la etiqueta', () => {
    const plain = mount(FilterSwitchRow, { props: { label: 'Marca', modelValue: true } })
    expect(plain.find('.app-hint').exists()).toBe(false)
    const withHint = mount(FilterSwitchRow, { props: { label: 'Marca', hint: 'Distingue productos parecidos.', modelValue: true } })
    expect(withHint.get('.app-hint').text()).toBe('Distingue productos parecidos.')
  })

  it('el interruptor sigue emitiendo el cambio', async () => {
    const wrapper = mount(FilterSwitchRow, { props: { label: 'Marca', hint: 'x', modelValue: true } })
    await wrapper.get('input[type="checkbox"]').setValue(false)
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })
})
