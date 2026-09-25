import { describe, it, expect, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { APP_NAME } from '@/config/app'

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

  it('renderiza el header con el nombre de la app', () => {
    const wrapper = shallowMount(AuthLayout)
    expect(wrapper.text()).toContain(APP_NAME)
  })
})
