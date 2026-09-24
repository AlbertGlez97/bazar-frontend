import { describe, it, expect } from 'vitest'
import { shallowMount } from '@vue/test-utils'

vi.mock('vue-router', () => ({
  RouterLink: { template: '<a><slot /></a>' },
  RouterView: { template: '<div />' },
}))

import AuthLayout from '@/layouts/AuthLayout.vue'

describe('AuthLayout', () => {
  it('se monta y renderiza el layout', () => {
    const wrapper = shallowMount(AuthLayout)
    expect(wrapper.find('.auth-layout').exists()).toBe(true)
  })

  it('contiene el footer con la stack tecnológica', () => {
    const wrapper = shallowMount(AuthLayout)
    expect(wrapper.text()).toContain('NestJS')
  })

  it('renderiza el header con el logo', () => {
    const wrapper = shallowMount(AuthLayout)
    expect(wrapper.text()).toContain('FinanzasApp')
  })
})
