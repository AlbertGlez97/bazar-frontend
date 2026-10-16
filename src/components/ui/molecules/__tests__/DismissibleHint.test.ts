import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DismissibleHint from '../DismissibleHint.vue'
import source from '../DismissibleHint.vue?raw'

const css = source.slice(source.indexOf('<style')).replace(/<style[^>]*>/, '').replace(/\/\*[\s\S]*?\*\//g, '')
const rule = (selector: string) =>
  [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter(([, selectors]) => selectors!.split(',').map((part) => part.trim()).includes(selector))
    .map(([, , body]) => body)
    .join(';')

describe('DismissibleHint', () => {
  it('muestra el texto y una ✕ con nombre accesible "Cerrar aviso"', () => {
    const wrapper = mount(DismissibleHint, { props: { text: 'Toca un producto para agregarlo.' } })

    expect(wrapper.text()).toContain('Toca un producto para agregarlo.')
    const close = wrapper.get('button')
    expect(close.attributes('aria-label')).toBe('Cerrar aviso')
    expect(close.attributes('type')).toBe('button')
    expect(close.get('[aria-hidden="true"]').text()).toBe('✕')
  })

  it('tocar la ✕ emite dismiss (quien lo usa decide qué recordar)', async () => {
    const wrapper = mount(DismissibleHint, { props: { text: 'Hola' } })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })

  it('es una nota, no una alerta: no roba el foco ni se anuncia a gritos', () => {
    const wrapper = mount(DismissibleHint, { props: { text: 'Hola' } })

    expect(wrapper.find('[role="note"]').exists()).toBe(true)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('[aria-live="assertive"]').exists()).toBe(false)
  })

  it('el botón de cerrar mide 32 px con mouse y 44 px con dedo (token compacto)', () => {
    expect(rule('.dismissible-hint__close')).toMatch(/min-height:\s*var\(--control-height-compact\)/)
    expect(rule('.dismissible-hint__close')).toMatch(/min-width:\s*var\(--control-height-compact\)/)
  })
})
