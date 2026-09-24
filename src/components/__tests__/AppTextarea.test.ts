// Tests del átomo AppTextarea — render, v-model, error y disabled
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
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
})
