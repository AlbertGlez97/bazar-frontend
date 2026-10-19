import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppSuggestInput from '../AppSuggestInput.vue'

const mountField = (props: Record<string, unknown> = {}) =>
  mount(AppSuggestInput, { props: { modelValue: '', label: 'Marca', maxlength: 40, ...props }, attachTo: document.body })

describe('AppSuggestInput', () => {
  it('el campo tiene su etiqueta enlazada (for / id)', () => {
    const wrapper = mountField()
    const input = wrapper.find('input')

    expect(wrapper.find('label').text()).toBe('Marca')
    expect(wrapper.find('label').attributes('for')).toBe(input.attributes('id'))
    expect(input.attributes('id')).toBeTruthy()
  })

  it('limita la escritura al máximo y no autocompleta del navegador', () => {
    const input = mountField({ maxlength: 40 }).find('input')

    expect(input.attributes('maxlength')).toBe('40')
    expect(input.attributes('autocomplete')).toBe('off')
  })

  it('las sugerencias son una lista de opciones enlazada al campo (list)', () => {
    const wrapper = mountField({ suggestions: ['Adidas', 'Nike'] })
    const input = wrapper.find('input')
    const list = wrapper.find('datalist')

    expect(input.attributes('list')).toBe(list.attributes('id'))
    expect(list.findAll('option').map((option) => option.attributes('value'))).toEqual(['Adidas', 'Nike'])
  })

  it('sin sugerencias no hay lista (ni atributo list apuntando a nada)', () => {
    const wrapper = mountField({ suggestions: [] })

    expect(wrapper.find('datalist').exists()).toBe(false)
    expect(wrapper.find('input').attributes('list')).toBeUndefined()
  })

  it('la ayuda corta y el contador describen al campo (aria-describedby)', () => {
    const wrapper = mountField({ hint: 'Ej. Nike, Sony', modelValue: 'Nike' })
    const described = wrapper.find('input').attributes('aria-describedby')!.split(' ')
    const hint = wrapper.find('.app-suggest-input__hint')
    const counter = wrapper.find('.app-char-counter')

    expect(hint.text()).toBe('Ej. Nike, Sony')
    expect(described).toContain(hint.attributes('id'))
    expect(described).toContain(counter.attributes('id'))
  })

  it('el contador cuenta lo escrito', () => {
    const wrapper = mountField({ modelValue: 'Nike', maxlength: 40 })

    expect(wrapper.find('.app-char-counter').text()).toContain('4/40')
  })

  it('sin ayuda no dibuja el párrafo vacío', () => {
    expect(mountField().find('.app-suggest-input__hint').exists()).toBe(false)
  })

  it('escribir emite update:modelValue', async () => {
    const wrapper = mountField()

    await wrapper.find('input').setValue('Puma')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['Puma'])
  })

  it('un error se muestra y marca el campo inválido, conservando la ayuda en aria-describedby', () => {
    const wrapper = mountField({ error: 'Muy largo', hint: 'Ej. Nike' })
    const input = wrapper.find('input')

    expect(wrapper.text()).toContain('Muy largo')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toContain(wrapper.find('.app-suggest-input__hint').attributes('id'))
  })

  it('aguanta 200 sugerencias sin repetir ninguna', () => {
    const many = Array.from({ length: 200 }, (_, index) => `Marca ${index}`)
    const wrapper = mountField({ suggestions: [...many, ...many] })

    expect(wrapper.findAll('option')).toHaveLength(200)
  })
})
