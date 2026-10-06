import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DurationInput from '../DurationInput.vue'
import source from '../DurationInput.vue?raw'

const mountInput = (props: Record<string, unknown> = {}) =>
  mount(DurationInput, { props: { hours: '', minutes: '', ...props } })

describe('DurationInput', () => {
  it('renders two labelled whole-number fields, empty by default', () => {
    const w = mountInput()
    const inputs = w.findAll('input')
    expect(inputs).toHaveLength(2)
    expect(w.text()).toContain('Horas')
    expect(w.text()).toContain('Minutos')
    expect(inputs.map((i) => i.attributes('inputmode'))).toEqual(['numeric', 'numeric'])
    expect(inputs.map((i) => (i.element as HTMLInputElement).value)).toEqual(['', ''])
    expect(w.text()).toContain('vacíos si no sabes')
  })

  it('uses the id prefix for both fields so a label points at its input', () => {
    const w = mountInput({ idPrefix: 'shift' })
    expect(w.find('#shift-hours').exists()).toBe(true)
    expect(w.find('#shift-minutes').exists()).toBe(true)
    expect(w.find('label[for="shift-hours"]').text()).toBe('Horas')
  })

  it('emits each field separately and never converts or validates', async () => {
    const w = mountInput()
    await w.find('#duration-hours').setValue('8')
    await w.find('#duration-minutes').setValue('1.5')
    expect(w.emitted('update:hours')).toEqual([['8']])
    expect(w.emitted('update:minutes')).toEqual([['1.5']])
  })

  it('reflects the given values and can be disabled as a group', () => {
    const w = mountInput({ hours: '2', minutes: '30', disabled: true })
    const values = w.findAll('input').map((i) => (i.element as HTMLInputElement).value)
    expect(values).toEqual(['2', '30'])
    expect(w.findAll('input').every((i) => i.attributes('disabled') !== undefined)).toBe(true)
    expect(w.find('fieldset').attributes('disabled')).toBeDefined()
  })

  it('is a fieldset with a legend and has a two-column layout that can shrink on phones', () => {
    const w = mountInput()
    expect(w.find('legend').text()).toBe('Duración (opcional)')
    expect(source).toMatch(/grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
    expect(source).toMatch(/min-width: 0/)
  })
})
