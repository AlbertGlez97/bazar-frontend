import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppCharCounter from '../AppCharCounter.vue'

describe('AppCharCounter', () => {
  it('muestra "usados/máximo"', () => {
    const wrapper = mount(AppCharCounter, { props: { current: 12, max: 40 } })

    expect(wrapper.find('[aria-hidden="true"]').text()).toBe('12/40')
  })

  it('para el lector de pantalla dice la frase completa, no los números sueltos', () => {
    const wrapper = mount(AppCharCounter, { props: { current: 12, max: 40 } })

    expect(wrapper.find('.app-char-counter__sr').text()).toBe('12 de 40 caracteres')
  })

  it('con 1 carácter no dice "caracteres" en plural de más', () => {
    const wrapper = mount(AppCharCounter, { props: { current: 1, max: 40 } })

    expect(wrapper.find('.app-char-counter__sr').text()).toBe('1 de 40 caracteres')
  })

  it('lejos del límite no se marca', () => {
    const wrapper = mount(AppCharCounter, { props: { current: 35, max: 40 } })

    expect(wrapper.get('.app-char-counter').classes()).not.toContain('app-char-counter--near')
    expect(wrapper.get('.app-char-counter').classes()).not.toContain('app-char-counter--full')
  })

  it('a partir del 90 % avisa que se acerca', () => {
    const wrapper = mount(AppCharCounter, { props: { current: 36, max: 40 } })

    expect(wrapper.get('.app-char-counter').classes()).toContain('app-char-counter--near')
    expect(wrapper.get('.app-char-counter').classes()).not.toContain('app-char-counter--full')
  })

  it('en el máximo, lleno', () => {
    const wrapper = mount(AppCharCounter, { props: { current: 40, max: 40 } })

    expect(wrapper.get('.app-char-counter').classes()).toContain('app-char-counter--full')
  })

  it('no es una región viva: no habla en cada letra', () => {
    const wrapper = mount(AppCharCounter, { props: { current: 5, max: 40 } })

    expect(wrapper.find('[aria-live]').exists()).toBe(false)
  })

  it('acepta un id para enlazarlo con aria-describedby', () => {
    const wrapper = mount(AppCharCounter, { props: { current: 5, max: 40, id: 'cnt' } })

    expect(wrapper.get('.app-char-counter').attributes('id')).toBe('cnt')
  })
})
