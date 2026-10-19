// El selector de archivo es un campo más: su etiqueta tiene que estar enlazada (for / id).
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppImageUpload from '../AppImageUpload.vue'

describe('AppImageUpload — etiqueta enlazada', () => {
  it('la etiqueta apunta al input de archivo por for / id', () => {
    const wrapper = mount(AppImageUpload, { props: { label: 'Imagen del producto' } })
    const input = wrapper.get('input[type="file"]')

    expect(input.attributes('id')).toBeTruthy()
    expect(wrapper.get('label').attributes('for')).toBe(input.attributes('id'))
  })

  it('respeta un id puesto por quien lo usa', () => {
    const wrapper = mount(AppImageUpload, { props: { label: 'Foto' }, attrs: { id: 'foto-producto' } })

    expect(wrapper.get('input[type="file"]').attributes('id')).toBe('foto-producto')
    expect(wrapper.get('label').attributes('for')).toBe('foto-producto')
  })

  it('sin etiqueta, el input conserva un id (y no hay label)', () => {
    const wrapper = mount(AppImageUpload)

    expect(wrapper.find('label').exists()).toBe(false)
    expect(wrapper.get('input[type="file"]').attributes('id')).toBeTruthy()
  })

  it('el id no se duplica en la raíz', () => {
    const wrapper = mount(AppImageUpload, { props: { label: 'Foto' }, attrs: { id: 'foto-producto' } })

    expect(wrapper.html().match(/id="foto-producto"/g)).toHaveLength(1)
  })
})
