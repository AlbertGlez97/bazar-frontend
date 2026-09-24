// Tests del átomo AppSelect — asociación label/control
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import AppSelect from '@/components/ui/atoms/AppSelect.vue'

// Slot con un par de <option> para que el select tenga contenido real
const options = () => [
  h('option', { value: 'a' }, 'A'),
  h('option', { value: 'b' }, 'B'),
]

describe('AppSelect', () => {
  it('vincula el label con el select usando un id generado', () => {
    // attachTo: el navegador resuelve label.control sobre el documento
    const wrapper = mount(AppSelect, {
      props: { label: 'Categoría' },
      slots: { default: options },
      attachTo: document.body,
    })
    const label = wrapper.get('label')
    const select = wrapper.get('select')

    expect(select.attributes('id')).toBeTruthy()
    expect(label.attributes('for')).toBe(select.attributes('id'))
    expect((label.element as HTMLLabelElement).control).toBe(select.element)
    wrapper.unmount()
  })

  it('respeta el id explícito y el label lo sigue', () => {
    const wrapper = mount(AppSelect, {
      props: { label: 'Categoría' },
      attrs: { id: 'categoria-explicita' },
      slots: { default: options },
      attachTo: document.body,
    })
    const label = wrapper.get('label')
    const select = wrapper.get('select')

    expect(select.attributes('id')).toBe('categoria-explicita')
    expect(label.attributes('for')).toBe('categoria-explicita')
    expect((label.element as HTMLLabelElement).control).toBe(select.element)
    wrapper.unmount()
  })

  it('asigna ids distintos a dos instancias y cada label apunta a su select', () => {
    const Parent = defineComponent({
      render: () => h('div', [
        h(AppSelect, { label: 'Uno' }, { default: options }),
        h(AppSelect, { label: 'Dos' }, { default: options }),
      ]),
    })
    const wrapper = mount(Parent, { attachTo: document.body })
    const labels = wrapper.findAll('label')
    const selects = wrapper.findAll('select')

    expect(selects[0].attributes('id')).not.toBe(selects[1].attributes('id'))
    expect((labels[0].element as HTMLLabelElement).control).toBe(selects[0].element)
    expect((labels[1].element as HTMLLabelElement).control).toBe(selects[1].element)
    wrapper.unmount()
  })
})
