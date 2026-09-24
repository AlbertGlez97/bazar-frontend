import { shallowMount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import App from '../App.vue'
import { useAuthStore } from '@/stores/auth.store'
import { beforeEach, expect, it } from 'vitest'
beforeEach(() => localStorage.clear())
it('mounts one global toast without a recovery splash', () => {
  const pinia = createPinia()
  const wrapper = shallowMount(App, { global: { plugins: [pinia], stubs: { RouterView: true } } })
  expect(wrapper.findAll('app-toast-stub')).toHaveLength(1)
  expect(wrapper.find('.app-splash').exists()).toBe(false)
  expect(useAuthStore(pinia).isAuthenticated).toBe(false)
})
