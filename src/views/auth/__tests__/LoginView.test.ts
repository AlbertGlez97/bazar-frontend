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
  it('envía usuario/contraseña y navega al shell tras éxito', async () => {
    const wrapper = render()
    await wrapper.get('input[autocomplete=username]').setValue('ana')
    await wrapper.get('input[type=password]').setValue('secret123')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(useAuthStore().login).toHaveBeenCalledWith({ username: 'ana', password: 'secret123' })
    expect(push).toHaveBeenCalledWith({ name: 'AppHome' })
    wrapper.unmount()
  })

  it('mantiene el formulario visible si el login falla', async () => {
    const wrapper = render()
    vi.mocked(useAuthStore().login).mockRejectedValue(new Error('Denied'))
    await wrapper.get('input[autocomplete=username]').setValue('ana')
    await wrapper.get('input[type=password]').setValue('secret123')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(push).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it.each([
    ['', ''],
    ['', '123456'],
    ['ana', ''],
    ['ana', '123'],
  ])('bloquea el envío con campos inválidos %s/%s', async (username, password) => {
    const wrapper = render()
    await wrapper.get('input[autocomplete=username]').setValue(username)
    await wrapper.get('input[type=password]').setValue(password)
    await wrapper.get('input[autocomplete=username]').trigger('blur')
    await wrapper.get('input[type=password]').trigger('blur')
    await wrapper.get('form').trigger('submit')

    expect(useAuthStore().login).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('saluda en la voz de la marca y explica qué se pide', () => {
    const wrapper = render()
    expect(wrapper.get('.login__title').text()).toBe('Pásale')
    expect(wrapper.get('.login__subtitle').text()).toBe('Entra con el usuario y la contraseña de tu negocio.')
    expect(wrapper.get('form button[type=submit]').text()).toContain('Entrar')
    wrapper.unmount()
  })

  it('cada validación dice qué falta, con su propio mensaje', async () => {
    const wrapper = render()
    await wrapper.get('input[autocomplete=username]').trigger('blur')
    await wrapper.get('input[type=password]').trigger('blur')
    expect(wrapper.text()).toContain('Escribe tu usuario.')
    expect(wrapper.text()).toContain('Escribe tu contraseña.')
    await wrapper.get('input[type=password]').setValue('123')
    await wrapper.get('input[type=password]').trigger('blur')
    expect(wrapper.text()).toContain('Tu contraseña tiene al menos 6 caracteres.')
    wrapper.unmount()
  })

  it('el aviso de seguridad no nombra JWT ni algoritmos de hash', () => {
    const wrapper = render()
    const notice = wrapper.get('.login__security').text()
    expect(notice).toBe('Tus datos de acceso se almacenan de forma segura.')
    expect(notice).not.toMatch(/JWT|BCrypt|Argon|cifrad/i)
    wrapper.unmount()
  })

  it('asocia cada label con su control (accesibilidad)', () => {
    // attachTo: el navegador resuelve label.control sobre el documento
    const wrapper = mount(LoginView, {
      global: { plugins: [createTestingPinia({ createSpy: vi.fn })] },
      attachTo: document.body,
    })
    const labelOf = (text: string) =>
      wrapper.findAll('label').find((l) => l.text() === text)?.element as HTMLLabelElement

    expect(labelOf('Usuario').control).toBe(wrapper.get('input[autocomplete=username]').element)
    expect(labelOf('Contraseña').control).toBe(wrapper.get('input[type=password]').element)
    wrapper.unmount()
  })

  it('alterna la visibilidad de la contraseña', async () => {
    const wrapper = render()
    await wrapper.get('.login__eye-btn').trigger('click')
    expect(wrapper.find('input[type=password]').exists()).toBe(false)
    await wrapper.get('.login__eye-btn').trigger('click')
    expect(wrapper.find('input[type=password]').exists()).toBe(true)
    wrapper.unmount()
  })
})
