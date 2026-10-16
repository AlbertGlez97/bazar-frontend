import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentMethodPicker from '../PaymentMethodPicker.vue'

const mountPicker = (props: Record<string, unknown> = {}) =>
  mount(PaymentMethodPicker, { props: { modelValue: 'EFECTIVO', ...props } })

describe('PaymentMethodPicker', () => {
  it('ofrece los tres métodos, con palabras, en este orden', () => {
    const wrapper = mountPicker()

    expect(wrapper.findAll('button').map((b) => b.text())).toEqual(['Efectivo', 'Transferencia', 'Tarjeta'])
  })

  it('pregunta con una frase corta y el grupo tiene nombre accesible', () => {
    const wrapper = mountPicker()

    expect(wrapper.text()).toContain('¿Cómo pagan?')
    expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe('Método de pago')
  })

  it.each([
    ['EFECTIVO', ['true', 'false', 'false']],
    ['TRANSFERENCIA', ['false', 'true', 'false']],
    ['TARJETA', ['false', 'false', 'true']],
  ])('con %s activo marca solo ese botón', (modelValue, pressed) => {
    const wrapper = mountPicker({ modelValue })

    expect(wrapper.findAll('button').map((b) => b.attributes('aria-pressed'))).toEqual(pressed)
  })

  it.each([
    [1, 'TRANSFERENCIA'],
    [2, 'TARJETA'],
  ])('tocar el botón %i emite %s', async (index, method) => {
    const wrapper = mountPicker()

    await wrapper.findAll('button')[index]!.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[method]])
  })

  it('tocar el activo no emite', async () => {
    const wrapper = mountPicker()

    await wrapper.findAll('button')[0]!.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('mientras se cobra queda bloqueado', () => {
    const wrapper = mountPicker({ disabled: true })

    expect(wrapper.findAll('button').every((b) => b.attributes('disabled') !== undefined)).toBe(true)
  })

  it('usa botones grandes (lg) y ninguno es el botón de color fuerte de la pantalla', () => {
    const wrapper = mountPicker()

    expect(wrapper.get('.segmented-control').classes()).toContain('segmented-control--lg')
    expect(wrapper.find('.app-btn--primary').exists()).toBe(false)
  })
})
