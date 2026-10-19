import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppTextarea from '../AppTextarea.vue'

const mountField = (props: Record<string, unknown> = {}, attrs: Record<string, unknown> = {}) =>
  mount(AppTextarea, { props: { modelValue: '', label: 'Descripción', ...props }, attrs, attachTo: document.body })

describe('AppTextarea — ayuda y contador opcionales', () => {
  it('sin pedirlos no dibuja ni ayuda ni contador (como siempre)', () => {
    const wrapper = mountField()

    expect(wrapper.find('.app-textarea__hint').exists()).toBe(false)
    expect(wrapper.find('.app-char-counter').exists()).toBe(false)
  })

  it('con `counter` y maxlength muestra el contador y lo describe en aria-describedby', () => {
    const wrapper = mountField({ modelValue: 'Algodón', counter: true }, { maxlength: 200 })

    expect(wrapper.get('.app-char-counter').text()).toContain('7/200')
    expect(wrapper.get('textarea').attributes('maxlength')).toBe('200')
    expect(wrapper.get('textarea').attributes('aria-describedby')).toContain(wrapper.get('.app-char-counter').attributes('id'))
  })

  it('`counter` sin maxlength no inventa un máximo: no se dibuja', () => {
    expect(mountField({ counter: true }).find('.app-char-counter').exists()).toBe(false)
  })

  it('la ayuda se dibuja y describe al campo', () => {
    const wrapper = mountField({ hint: 'Una frase corta.' })

    expect(wrapper.get('.app-textarea__hint').text()).toBe('Una frase corta.')
    expect(wrapper.get('textarea').attributes('aria-describedby')).toContain(wrapper.get('.app-textarea__hint').attributes('id'))
  })

  it('con error conserva la ayuda y el contador en aria-describedby', () => {
    const wrapper = mountField({ hint: 'Ayuda', counter: true, error: 'Muy largo' }, { maxlength: 200 })
    const described = wrapper.get('textarea').attributes('aria-describedby')!

    expect(described).toContain(wrapper.get('.app-textarea__hint').attributes('id'))
    expect(described).toContain(wrapper.get('.app-char-counter').attributes('id'))
    expect(described).toContain('-error')
  })
})
