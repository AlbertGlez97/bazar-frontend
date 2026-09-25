import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { APP_NAME } from '@/config/app'
import AuthLayout from '@/layouts/AuthLayout.vue'

// Router real: que el logo lleve a "/" depende de cómo vue-router resuelve el
// enlace y la navegación, algo que un mock de RouterLink no puede comprobar.
// AuthLayout se monta directo (no como ruta) para que su <RouterView> no se
// renderice a sí mismo.
async function mountAtLogin() {
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'Landing', component: stub },
      { path: '/login', name: 'Login', component: stub },
    ],
  })
  router.push('/login')
  await router.isReady()
  const wrapper = mount(AuthLayout, { global: { plugins: [router] } })
  return { wrapper, router }
}

describe('AuthLayout', () => {
  it('se monta y renderiza el layout', async () => {
    const { wrapper } = await mountAtLogin()
    expect(wrapper.find('.auth-layout').exists()).toBe(true)
  })

  it('no anuncia la stack tecnológica ni deja un footer vacío', async () => {
    const { wrapper } = await mountAtLogin()
    expect(wrapper.text()).not.toMatch(/NestJS|Vue 3|PostgreSQL|Construido con/)
    expect(wrapper.find('footer').exists()).toBe(false)
  })

  it('renderiza el header con el nombre de la app', async () => {
    const { wrapper } = await mountAtLogin()
    expect(wrapper.get('.auth-logo').text()).toContain(APP_NAME)
  })

  it('el logo es un enlace a la landing "/" con el nombre accesible de la app', async () => {
    const { wrapper } = await mountAtLogin()
    const logo = wrapper.get('a.auth-logo')
    expect(logo.attributes('href')).toBe('/')
    expect(logo.attributes('aria-label')).toBe(APP_NAME)
    // El isotipo es decorativo: el nombre accesible lo da el aria-label del enlace
    expect(logo.get('svg').attributes('aria-hidden')).toBe('true')
  })

  it('usa el logotipo de marca y el toldo decorativo, sin el fondo oscuro anterior', async () => {
    const { wrapper } = await mountAtLogin()
    expect(wrapper.find('.brand-logo').exists()).toBe(true)
    expect(wrapper.get('.brand-awning').attributes('aria-hidden')).toBe('true')
    expect(wrapper.find('.auth-layout__blob').exists()).toBe(false)
  })

  it('al hacer clic en el logo navega a "/"', async () => {
    const { wrapper, router } = await mountAtLogin()
    expect(router.currentRoute.value.path).toBe('/login')
    await wrapper.get('a.auth-logo').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/')
  })
})
