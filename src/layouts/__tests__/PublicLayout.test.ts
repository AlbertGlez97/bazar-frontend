import { beforeEach, describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { APP_NAME } from '@/config/app'
import PublicLayout from '@/layouts/PublicLayout.vue'

beforeEach(() => localStorage.clear())

async function mountLayout({ authenticated = false } = {}) {
  // El auth store lee la sesión de localStorage al crearse
  if (authenticated) {
    localStorage.setItem('access_token', 'tok')
    localStorage.setItem('token_expires_at', String(Date.now() + 60_000))
  }
  const pinia = createPinia()
  setActivePinia(pinia)
  const stub = { template: '<div class="child">child</div>' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'Landing', component: stub },
      { path: '/login', name: 'Login', component: stub },
    ],
  })
  router.push('/')
  await router.isReady()
  const wrapper = mount(PublicLayout, { global: { plugins: [pinia, router] } })
  return { wrapper, router }
}

describe('PublicLayout', () => {
  it('muestra el toldo decorativo, el logo enlazado a "/" y el pie de marca', async () => {
    const { wrapper } = await mountLayout()
    expect(wrapper.get('.brand-awning').attributes('aria-hidden')).toBe('true')
    const logo = wrapper.get('a.public-layout__logo')
    expect(logo.attributes('href')).toBe('/')
    expect(logo.attributes('aria-label')).toBe(APP_NAME)
    expect(wrapper.get('footer').text()).toContain(APP_NAME)
    expect(wrapper.get('footer').text()).toContain('Para quien vende de tú a tú.')
  })

  it('renderiza la vista hija', async () => {
    const { wrapper } = await mountLayout()
    expect(wrapper.find('main .child').exists()).toBe(true)
  })

  it('sin sesión ofrece "Entrar" hacia el login', async () => {
    const { wrapper } = await mountLayout()
    const enter = wrapper.get('a.public-layout__login')
    expect(enter.text()).toBe('Entrar')
    expect(enter.attributes('href')).toBe('/login')
  })

  it('con sesión activa no muestra "Entrar"', async () => {
    const { wrapper } = await mountLayout({ authenticated: true })
    expect(wrapper.find('a.public-layout__login').exists()).toBe(false)
  })
})
