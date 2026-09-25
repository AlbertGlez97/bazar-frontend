import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ReportRangePicker from '../ReportRangePicker.vue'

function mountPicker(props: Record<string, unknown> = {}) {
  return mount(ReportRangePicker, {
    props: { from: '2026-09-24', to: '2026-09-24', preset: 'hoy', max: '2026-09-24', ...props },
  })
}

const presetButtons = (wrapper: ReturnType<typeof mountPicker>) => wrapper.findAll('.report-range-picker__preset')

describe('ReportRangePicker', () => {
  it('offers the four presets in order, in Spanish', () => {
    expect(presetButtons(mountPicker()).map((b) => b.text())).toEqual(['Hoy', 'Ayer', 'Esta semana', 'Este mes'])
  })

  it('marks only the selected preset as pressed (text/state, not just color)', () => {
    const buttons = presetButtons(mountPicker({ preset: 'semana' }))
    expect(buttons.map((b) => b.attributes('aria-pressed'))).toEqual(['false', 'false', 'true', 'false'])
  })

  it('no preset is pressed while the dates are custom', () => {
    const buttons = presetButtons(mountPicker({ preset: null }))
    expect(buttons.every((b) => b.attributes('aria-pressed') === 'false')).toBe(true)
  })

  it('emits the preset key when one is clicked', async () => {
    const wrapper = mountPicker()
    await presetButtons(wrapper)[2].trigger('click')
    await presetButtons(wrapper)[3].trigger('click')
    expect(wrapper.emitted('select-preset')).toEqual([['semana'], ['mes']])
  })

  it('groups the presets with an accessible name', () => {
    expect(mountPicker().get('[role="group"]').attributes('aria-label')).toBe('Periodo')
  })

  it('shows the two date inputs with labels, values and today as the max', () => {
    const wrapper = mountPicker({ from: '2026-09-01', to: '2026-09-24' })
    const inputs = wrapper.findAll('input[type="date"]')
    expect(inputs).toHaveLength(2)
    expect((inputs[0].element as HTMLInputElement).value).toBe('2026-09-01')
    expect((inputs[1].element as HTMLInputElement).value).toBe('2026-09-24')
    expect(inputs.map((i) => i.attributes('max'))).toEqual(['2026-09-24', '2026-09-24'])
    expect(wrapper.text()).toContain('Desde')
    expect(wrapper.text()).toContain('Hasta')
  })

  it('emits the typed dates', async () => {
    const wrapper = mountPicker()
    const [from, to] = wrapper.findAll('input[type="date"]')
    await from.setValue('2026-09-10')
    await to.setValue('2026-09-20')
    expect(wrapper.emitted('update:from')).toEqual([['2026-09-10']])
    expect(wrapper.emitted('update:to')).toEqual([['2026-09-20']])
  })

  it('emits apply from the Actualizar button, and on Enter in a date field', async () => {
    // jsdom solo envía formularios que están en el documento.
    const wrapper = mount(ReportRangePicker, {
      props: { from: '2026-09-24', to: '2026-09-24', preset: 'hoy', max: '2026-09-24' },
      attachTo: document.body,
    })
    await wrapper.get('.report-range-picker__apply').trigger('click')
    expect(wrapper.emitted('apply')).toHaveLength(1)
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('apply')).toHaveLength(2)
    wrapper.unmount()
  })

  it('shows an error under the dates and refuses to apply', async () => {
    const wrapper = mountPicker({ error: 'La fecha inicial es posterior a la final. Cámbialas para ver el reporte.' })
    expect(wrapper.get('.report-range-picker__error').text()).toContain('La fecha inicial es posterior')
    expect(wrapper.get('.report-range-picker__apply').attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('apply')).toBeUndefined()
  })

  it('disables every control while busy', async () => {
    const wrapper = mountPicker({ disabled: true })
    expect(presetButtons(wrapper).every((b) => b.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.findAll('input').every((i) => i.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.get('.report-range-picker__apply').attributes('disabled')).toBeDefined()
  })
})
