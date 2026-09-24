// Tests del átomo AppTextarea — render, v-model, error y disabled
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import AppTextarea from '@/components/ui/atoms/AppTextarea.vue'

describe('AppTextarea', () => {
  it('renderiza el label cuando se recibe la prop', () => {
    const wrapper = mount(AppTextarea, { props: { label: 'Mensaje' } })
    expect(wrapper.text()).toContain('Mensaje')
  })

  it('renderiza el valor recibido en modelValue', () => {
    const wrapper = mount(AppTextarea, { props: { modelValue: 'hola' } })
    expect(wrapper.find('textarea').element.value).toBe('hola')
  })

  it('emite update:modelValue al escribir', async () => {
    const wrapper = mount(AppTextarea)
    await wrapper.find('textarea').setValue('nuevo texto')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['nuevo texto'])
  })

  it('muestra el mensaje de error cuando se recibe la prop error', () => {
    const wrapper = mount(AppTextarea, { props: { error: 'Campo requerido' } })
    expect(wrapper.text()).toContain('Campo requerido')
  })

  it('deshabilita el textarea cuando disabled es true', () => {
    const wrapper = mount(AppTextarea, { props: { disabled: true } })
    expect(wrapper.find('textarea').attributes('disabled')).toBeDefined()
  })

  it('usa 4 filas por defecto', () => {
    const wrapper = mount(AppTextarea)
    expect(wrapper.find('textarea').attributes('rows')).toBe('4')
  })

  describe('asociación label/control', () => {
    it('vincula el label con el textarea usando un id generado', () => {
      // attachTo: el navegador resuelve label.control sobre el documento
      const wrapper = mount(AppTextarea, { props: { label: 'Mensaje' }, attachTo: document.body })
      const label = wrapper.get('label')
      const textarea = wrapper.get('textarea')

      expect(textarea.attributes('id')).toBeTruthy()
      expect(label.attributes('for')).toBe(textarea.attributes('id'))
      expect((label.element as HTMLLabelElement).control).toBe(textarea.element)
      wrapper.unmount()
    })

    it('respeta el id explícito y el label lo sigue', () => {
      const wrapper = mount(AppTextarea, {
        props: { label: 'Mensaje' },
        attrs: { id: 'mensaje-explicito' },
        attachTo: document.body,
      })
      const label = wrapper.get('label')
      const textarea = wrapper.get('textarea')

      expect(textarea.attributes('id')).toBe('mensaje-explicito')
      expect(label.attributes('for')).toBe('mensaje-explicito')
      expect((label.element as HTMLLabelElement).control).toBe(textarea.element)
      wrapper.unmount()
    })

    it('asigna ids distintos a dos instancias y cada label apunta a su textarea', () => {
      const Parent = defineComponent({
        render: () => h('div', [
          h(AppTextarea, { label: 'Uno' }),
          h(AppTextarea, { label: 'Dos' }),
        ]),
      })
      const wrapper = mount(Parent, { attachTo: document.body })
      const labels = wrapper.findAll('label')
      const textareas = wrapper.findAll('textarea')

      expect(textareas[0].attributes('id')).not.toBe(textareas[1].attributes('id'))
      expect((labels[0].element as HTMLLabelElement).control).toBe(textareas[0].element)
      expect((labels[1].element as HTMLLabelElement).control).toBe(textareas[1].element)
      wrapper.unmount()
    })
  })
})
