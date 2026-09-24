// Tests del átomo AppProgress — barra de progreso, etiqueta y límites
// El template inicia con un comentario HTML (fragmento), por lo que wrapper.classes()
// apunta al nodo comentario. Las clases se verifican en hijos vía wrapper.find().
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppProgress from '@/components/ui/atoms/AppProgress.vue'

describe('AppProgress', () => {
  it('renderiza la barra con el ancho correcto según value', () => {
    const wrapper = mount(AppProgress, { props: { value: 60 } })
    const bar = wrapper.find('.app-progress__bar')
    expect(bar.attributes('style')).toContain('60%')
  })

  it('clampea el valor a 0 cuando es negativo', () => {
    const wrapper = mount(AppProgress, { props: { value: -10 } })
    expect(wrapper.find('.app-progress__bar').attributes('style')).toContain('0%')
  })

  it('clampea el valor a 100 cuando supera el máximo', () => {
    const wrapper = mount(AppProgress, { props: { value: 150 } })
    expect(wrapper.find('.app-progress__bar').attributes('style')).toContain('100%')
  })

  it('muestra la etiqueta de porcentaje cuando showLabel es true', () => {
    const wrapper = mount(AppProgress, { props: { value: 45, showLabel: true } })
    expect(wrapper.text()).toContain('45%')
  })

  it('no muestra la etiqueta por defecto', () => {
    const wrapper = mount(AppProgress, { props: { value: 45 } })
    // Sin showLabel no hay texto visible
    expect(wrapper.find('.app-progress__label').exists()).toBe(false)
  })

  it('aplica la clase de color correcta a la barra — prefijo app-progress__bar--', () => {
    const wrapper = mount(AppProgress, { props: { value: 80, color: 'success' } })
    expect(wrapper.find('.app-progress__bar').classes()).toContain('app-progress__bar--success')
  })

  it('aplica aria-valuenow en el elemento de la barra para accesibilidad', () => {
    const wrapper = mount(AppProgress, { props: { value: 33 } })
    // aria-valuenow está en .app-progress__bar, no en el wrapper raíz
    expect(wrapper.find('[role="progressbar"]').attributes('aria-valuenow')).toBe('33')
  })

  it('usa color "primary" por defecto', () => {
    const wrapper = mount(AppProgress, { props: { value: 50 } })
    expect(wrapper.find('.app-progress__bar').classes()).toContain('app-progress__bar--primary')
  })

  it('redondea el value al entero más cercano', () => {
    const wrapper = mount(AppProgress, { props: { value: 33.7 } })
    expect(wrapper.find('.app-progress__bar').attributes('style')).toContain('34%')
  })
})
