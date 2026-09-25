import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { APP_NAME } from '@/config/app'
import AppLayout from '@/layouts/AppLayout.vue'

// A diferencia de AppLayout.test.ts (que mockea vue-router), aquí se usa un
// router real: el estado activo de los enlaces depende de cómo vue-router
// compara rutas, y un mock no puede detectar que "Inicio" siga resaltado.
vi.mock('@/components', () => ({
  AppButton:        { template: '<button><slot /></button>' },
  AppAvatar:        { template: '<div />' },
  InstallAppButton: { template: '<div />' },
}))

async function mountAt(path: string) {
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      // Misma forma que router/index.ts: 'Inicio' es el hijo con path '' del
      // padre '/app'. Con esa forma vue-router considera activo el enlace a
      // '/app' también en '/app/productos', salvo que se compare exacto.
      {
        path: '/app',
        component: { render: () => h(RouterView) },
        children: [
          { path: '', name: 'AppHome', component: stub },
          { path: 'productos', name: 'ProductCatalog', component: stub },
        ],
      },
    ],
  })
  router.push(path)
  await router.isReady()
  return mount(AppLayout, { global: { plugins: [createPinia(), router] } })
}

const activeLabels = (wrapper: Awaited<ReturnType<typeof mountAt>>) =>
  wrapper.findAll('.sidebar__link--active').map((l) => l.text())

describe('AppLayout navegación', () => {
  it('muestra los enlaces a Inicio y Productos con sus rutas', async () => {
    const wrapper = await mountAt('/app')
    const links = wrapper.findAll('a.sidebar__link')
    expect(links).toHaveLength(2)
    expect(links.find((l) => l.text().includes('Productos'))?.attributes('href')).toBe('/app/productos')
    expect(links.find((l) => l.text().includes('Inicio'))?.attributes('href')).toBe('/app')
  })

  it('en /app solo "Inicio" está activo', async () => {
    const wrapper = await mountAt('/app')
    expect(activeLabels(wrapper)).toHaveLength(1)
    expect(activeLabels(wrapper)[0]).toContain('Inicio')
  })

  it('en /app/productos solo "Productos" está activo, no "Inicio"', async () => {
    const wrapper = await mountAt('/app/productos')
    expect(activeLabels(wrapper)).toHaveLength(1)
    expect(activeLabels(wrapper)[0]).toContain('Productos')
  })

  it('el título de la barra superior en /app/productos es "Productos"', async () => {
    const wrapper = await mountAt('/app/productos')
    expect(wrapper.find('.app-header__title').text()).toBe('Productos')
  })

  it('el logo enlaza al inicio de la app y muestra el nombre sin emoji', async () => {
    const wrapper = await mountAt('/app/productos')
    const brand = wrapper.get('a.sidebar__brand')
    expect(brand.attributes('href')).toBe('/app')
    expect(brand.text()).toBe(APP_NAME)
    expect(wrapper.text()).not.toContain('💰')
  })

  it('con el sidebar colapsado el logo sigue siendo un enlace con nombre accesible', async () => {
    const wrapper = await mountAt('/app')
    await wrapper.get('.sidebar__toggle').trigger('click')
    const brand = wrapper.get('a.sidebar__brand')
    expect(brand.attributes('href')).toBe('/app')
    expect(brand.attributes('aria-label')).toBe(APP_NAME)
    expect(brand.text()).toBe(APP_NAME.charAt(0))
  })

  it('al hacer clic en el logo desde otra vista vuelve a /app', async () => {
    const wrapper = await mountAt('/app/productos')
    await wrapper.get('a.sidebar__brand').trigger('click')
    await flushPromises()
    expect(wrapper.find('.app-header__title').text()).toBe('Inicio')
  })
})
