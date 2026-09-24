// Tests de la molécula FeatureCard — renderiza icon/title/description por props
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FeatureCard from '@/components/ui/molecules/FeatureCard.vue'

describe('FeatureCard', () => {
  const props = {
    icon: '⚡',
    title: 'Venta rápida',
    description: 'Registra varios productos en segundos.',
  }

  it('renderiza el título recibido por props', () => {
    const wrapper = mount(FeatureCard, { props })
    expect(wrapper.text()).toContain('Venta rápida')
  })

  it('renderiza la descripción recibida por props', () => {
    const wrapper = mount(FeatureCard, { props })
    expect(wrapper.text()).toContain('Registra varios productos en segundos.')
  })

  it('renderiza el icono recibido por props', () => {
    const wrapper = mount(FeatureCard, { props })
    expect(wrapper.find('.feature-card__icon').text()).toBe('⚡')
  })
})
