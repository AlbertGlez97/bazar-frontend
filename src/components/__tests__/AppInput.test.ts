// Tests del átomo AppInput — render, v-model y asociación label/control
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import AppInput from '@/components/ui/atoms/AppInput.vue'

describe('AppInput', () => {
  it('renderiza el input nativo sin label cuando no se recibe la prop', () => {
    const wrapper = mount(AppInput, { props: { modelValue: 'hola' } })
    expect(wrapper.find('label').exists()).toBe(false)
    expect(wrapper.get('input').element.value).toBe('hola')
  })

  it('emite update:modelValue al escribir', async () => {
    const wrapper = mount(AppInput)
    await wrapper.get('input').setValue('texto')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['texto'])
  })

  describe('asociación label/control', () => {
    it('vincula el label con el input usando un id generado', () => {
      // attachTo: el navegador resuelve label.control sobre el documento
      const wrapper = mount(AppInput, { props: { label: 'Nombre' }, attachTo: document.body })
      const label = wrapper.get('label')
      const input = wrapper.get('input')

      expect(input.attributes('id')).toBeTruthy()
      expect(label.attributes('for')).toBe(input.attributes('id'))
      expect((label.element as HTMLLabelElement).control).toBe(input.element)
      wrapper.unmount()
    })

    it('respeta el id explícito y el label lo sigue', () => {
      const wrapper = mount(AppInput, {
        props: { label: 'Nombre' },
        attrs: { id: 'nombre-explicito' },
        attachTo: document.body,
      })
      const label = wrapper.get('label')
      const input = wrapper.get('input')

      expect(input.attributes('id')).toBe('nombre-explicito')
      expect(label.attributes('for')).toBe('nombre-explicito')
      expect((label.element as HTMLLabelElement).control).toBe(input.element)
      wrapper.unmount()
    })

    it('ignora un id explícito en blanco y usa el generado', () => {
      const wrapper = mount(AppInput, {
        props: { label: 'Nombre' },
        attrs: { id: '  ' },
        attachTo: document.body,
      })
      const label = wrapper.get('label')
      const input = wrapper.get('input')

      expect(input.attributes('id')?.trim()).toBeTruthy()
      expect((label.element as HTMLLabelElement).control).toBe(input.element)
      wrapper.unmount()
    })

    it('asigna ids distintos a dos instancias y cada label apunta a su input', () => {
      const Parent = defineComponent({
        render: () => h('div', [
          h(AppInput, { label: 'Uno' }),
          h(AppInput, { label: 'Dos' }),
        ]),
      })
      const wrapper = mount(Parent, { attachTo: document.body })
      const labels = wrapper.findAll('label')
      const inputs = wrapper.findAll('input')

      expect(inputs[0].attributes('id')).not.toBe(inputs[1].attributes('id'))
      expect((labels[0].element as HTMLLabelElement).control).toBe(inputs[0].element)
      expect((labels[1].element as HTMLLabelElement).control).toBe(inputs[1].element)
      wrapper.unmount()
    })
  })
})
