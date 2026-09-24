import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginView from '../LoginView.vue'
import { useAuthStore } from '@/stores/auth.store'
const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
beforeEach(() => { localStorage.clear(); vi.clearAllMocks() })
function render() {
  return mount(LoginView, { global: { plugins: [createTestingPinia({ createSpy: vi.fn })] } })
}
describe('login form', () => {
  it('submits the legacy credentials and opens the shell', async () => {
    const wrapper = render()
    await wrapper.get('input[type=email]').setValue('ana@test.com')
    await wrapper.get('input[type=password]').setValue('password')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(useAuthStore().login).toHaveBeenCalledWith({ email: 'ana@test.com', password: 'password' })
    expect(push).toHaveBeenCalledWith({ name: 'AppHome' })
    expect(wrapper.find('a').exists()).toBe(false)
    wrapper.unmount()
  })
  it('keeps failed login on the form', async () => {
    const wrapper = render()
    vi.mocked(useAuthStore().login).mockRejectedValue(new Error('Denied'))
    await wrapper.get('input[type=email]').setValue('ana@test.com')
    await wrapper.get('input[type=password]').setValue('password')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(push).not.toHaveBeenCalled(); wrapper.unmount()
  })
  it.each([['', ''], ['invalid', '123'], ['ana@test.com', '']])('blocks invalid fields %s/%s', async (email, password) => {
    const wrapper = render()
    await wrapper.get('input[type=email]').setValue(email)
    await wrapper.get('input[type=password]').setValue(password)
    await wrapper.get('input[type=email]').trigger('blur')
    await wrapper.get('input[type=password]').trigger('blur')
    await wrapper.get('form').trigger('submit')
    expect(useAuthStore().login).not.toHaveBeenCalled(); wrapper.unmount()
  })
  it('toggles password visibility', async () => {
    const wrapper = render()
    await wrapper.get('.login__eye-btn').trigger('click')
    expect(wrapper.find('input[type=password]').exists()).toBe(false)
    await wrapper.get('.login__eye-btn').trigger('click')
    expect(wrapper.find('input[type=password]').exists()).toBe(true); wrapper.unmount()
  })
})
