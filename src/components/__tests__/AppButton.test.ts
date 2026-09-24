// Tests del átomo AppButton — verifica variantes, estados y eventos
// Nota: el template comienza con un comentario HTML, por lo que wrapper.element
// apunta al nodo comentario. Se usa wrapper.find('button') para obtener el elemento raíz real.
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AppButton from '@/components/ui/atoms/AppButton.vue'

describe('AppButton', () => {
  // ── Render básico ───────────────────────────────────────────────────────────
  it('renderiza el slot por defecto', () => {
    const wrapper = mount(AppButton, { slots: { default: 'Guardar' } })
    expect(wrapper.text()).toContain('Guardar')
  })

  it('aplica la clase de variante correcta — prefijo app-btn--', () => {
    const wrapper = mount(AppButton, { props: { variant: 'danger' } })
    expect(wrapper.find('button').classes()).toContain('app-btn--danger')
  })

  it('aplica la clase de tamaño correcta — prefijo app-btn--', () => {
    const wrapper = mount(AppButton, { props: { size: 'lg' } })
    expect(wrapper.find('button').classes()).toContain('app-btn--lg')
  })

  // ── Estado: disabled ────────────────────────────────────────────────────────
  it('agrega el atributo disabled cuando la prop disabled es true', () => {
    const wrapper = mount(AppButton, { props: { disabled: true } })
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('no invoca el handler click cuando está disabled', async () => {
    const onClick = vi.fn()
    const wrapper = mount(AppButton, {
      props: { disabled: true },
      attrs: { onClick },
    })
    await wrapper.find('button').trigger('click')
    expect(onClick).not.toHaveBeenCalled()
  })

  // ── Estado: loading ─────────────────────────────────────────────────────────
  it('muestra el spinner cuando loading es true', () => {
    const wrapper = mount(AppButton, { props: { loading: true } })
    expect(wrapper.find('.app-btn__spinner').exists()).toBe(true)
  })

  it('deshabilita el botón mientras loading es true', () => {
    const wrapper = mount(AppButton, { props: { loading: true } })
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('oculta el slot mientras loading es true', () => {
    const wrapper = mount(AppButton, {
      props: { loading: true },
      slots: { default: 'Cargando...' },
    })
    expect(wrapper.text()).not.toContain('Cargando...')
  })

  // ── Estado: block ───────────────────────────────────────────────────────────
  it('aplica la clase app-btn--block cuando block es true', () => {
    const wrapper = mount(AppButton, { props: { block: true } })
    expect(wrapper.find('button').classes()).toContain('app-btn--block')
  })

  // ── Evento click ────────────────────────────────────────────────────────────
  it('ejecuta el handler onClick en estado normal', async () => {
    const onClick = vi.fn()
    const wrapper = mount(AppButton, { attrs: { onClick } })
    await wrapper.find('button').trigger('click')
    expect(onClick).toHaveBeenCalledOnce()
  })

  // ── Variante y tamaño por defecto ───────────────────────────────────────────
  it('usa variante "primary" por defecto', () => {
    const wrapper = mount(AppButton)
    expect(wrapper.find('button').classes()).toContain('app-btn--primary')
  })

  it('usa tamaño "md" por defecto', () => {
    const wrapper = mount(AppButton)
    expect(wrapper.find('button').classes()).toContain('app-btn--md')
  })
})
