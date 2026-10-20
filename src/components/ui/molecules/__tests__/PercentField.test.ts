import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PercentField from '../PercentField.vue'

const mountIt = (props: Record<string, unknown> = {}) =>
  mount(PercentField, { props: { modelValue: 40, label: 'Por capital', ...props } })
const type = async (w: ReturnType<typeof mountIt>, value: string) => w.get('input').setValue(value)

describe('PercentField', () => {
  it('une la etiqueta con el campo y apaga el autocompletado', () => {
    const w = mountIt()
    const input = w.get('input')

    expect(w.get('label').attributes('for')).toBe(input.attributes('id'))
    expect(w.get('label').text()).toBe('Por capital')
    expect(input.attributes('autocomplete')).toBe('off')
    expect(input.attributes('inputmode')).toBe('decimal')
    expect((input.element as HTMLInputElement).value).toBe('40')
  })

  it('respeta el id que manda el padre', () => {
    const w = mountIt({ id: 'mi-campo' })
    expect(w.get('input').attributes('id')).toBe('mi-campo')
    expect(w.get('label').attributes('for')).toBe('mi-campo')
  })

  it('emite el número cuando el texto se entiende (coma, punto o %)', async () => {
    const w = mountIt()
    await type(w, '12,5')
    await type(w, '7%')
    await type(w, '100')

    expect(w.emitted('update:modelValue')).toEqual([[12.5], [7], [100]])
    expect(w.find('[role="alert"]').exists()).toBe(false)
  })

  it('un texto raro se marca, se explica y no se emite', async () => {
    const w = mountIt()
    await type(w, '150')

    expect(w.emitted('update:modelValue')).toBeUndefined()
    const alert = w.get('[role="alert"]')
    expect(alert.text()).toContain('Escribe un número de 0 a 100')
    expect(w.get('input').attributes('aria-invalid')).toBe('true')
    expect(w.get('input').attributes('aria-describedby')).toBe(alert.attributes('id'))
  })

  it.each(['', 'abc', '12.345', '-5'])('%j no se emite', async (value) => {
    const w = mountIt()
    await type(w, value)
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('al salir de un texto inválido regresa al último valor bueno', async () => {
    const w = mountIt()
    await type(w, 'abc')
    await w.get('input').trigger('blur')

    expect((w.get('input').element as HTMLInputElement).value).toBe('40')
    expect(w.find('[role="alert"]').exists()).toBe(false)
  })

  it('si el padre cambia el valor, el campo lo muestra', async () => {
    const w = mountIt()
    await w.setProps({ modelValue: 60 })
    expect((w.get('input').element as HTMLInputElement).value).toBe('60')
  })

  it('no pisa lo que se está escribiendo si ya equivale al valor', async () => {
    const w = mountIt()
    await type(w, '12,50')
    await w.setProps({ modelValue: 12.5 })
    expect((w.get('input').element as HTMLInputElement).value).toBe('12,50')
  })

  it('deshabilitado no se puede editar', () => {
    expect(mountIt({ disabled: true }).get('input').attributes('disabled')).toBeDefined()
  })
})
