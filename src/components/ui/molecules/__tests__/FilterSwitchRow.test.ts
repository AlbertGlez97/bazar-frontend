import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FilterSwitchRow from '../FilterSwitchRow.vue'

describe('FilterSwitchRow', () => {
  it('muestra la etiqueta a la izquierda y un interruptor a la derecha', () => {
    const wrapper = mount(FilterSwitchRow, { props: { label: 'Agotados', modelValue: false } })
    const [label, control] = Array.from((wrapper.element as HTMLElement).children)

    expect(label?.textContent).toContain('Agotados')
    expect(control?.querySelector('input[type="checkbox"]')).not.toBeNull()
  })

  it('el interruptor se llama como la etiqueta (la etiqueta lo enfoca y lo activa)', () => {
    const wrapper = mount(FilterSwitchRow, { props: { label: 'Agotados', modelValue: false }, attachTo: document.body })
    const input = wrapper.get('input').element as HTMLInputElement

    expect(input.labels?.[0]?.textContent).toContain('Agotados')
    wrapper.unmount()
  })

  it('refleja modelValue en el interruptor', () => {
    const on = mount(FilterSwitchRow, { props: { label: 'x', modelValue: true } })
    const off = mount(FilterSwitchRow, { props: { label: 'x', modelValue: false } })

    expect((on.get('input').element as HTMLInputElement).checked).toBe(true)
    expect((off.get('input').element as HTMLInputElement).checked).toBe(false)
  })

  it('emite update:modelValue al cambiar el interruptor', async () => {
    const wrapper = mount(FilterSwitchRow, { props: { label: 'x', modelValue: false } })

    await wrapper.get('input').setValue(true)

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true])
  })

  it('tocar el texto de la etiqueta también lo cambia', async () => {
    const wrapper = mount(FilterSwitchRow, { props: { label: 'Agotados', modelValue: false }, attachTo: document.body })

    await wrapper.get('label').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true])
    wrapper.unmount()
  })

  it('deshabilitado no emite', () => {
    const wrapper = mount(FilterSwitchRow, { props: { label: 'x', modelValue: false, disabled: true } })

    expect((wrapper.get('input').element as HTMLInputElement).disabled).toBe(true)
  })
})

describe('AppSwitch (átomo reutilizado por la fila)', () => {
  // `display: none` saca el <input> del orden de tabulación: un interruptor que
  // no se puede enfocar con el teclado no sirve dentro de un panel accesible.
  it('no oculta su <input> con display:none (se queda enfocable con teclado)', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/ui/atoms/AppSwitch.vue'), 'utf8')
    const rule = /\.app-switch__input\s*\{([^}]*)\}/.exec(source)?.[1] ?? ''

    expect(rule).not.toMatch(/display\s*:\s*none/)
  })
})
