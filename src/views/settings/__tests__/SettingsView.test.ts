// Vista de ajustes (contenedor): store de sesión REAL y router REAL; solo se
// sustituyen las entradas del menú para poder probar la visibilidad por rol
// sin depender de cuántas pantallas existan ya.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import SettingsView from '../SettingsView.vue'
import { useSessionStore } from '@/stores/session.store'
import type { SettingsItemDef } from '@/layouts/settings-items'

const sample = vi.hoisted<SettingsItemDef[]>(() => [
  { to: '/app/ajustes/contrasena', label: 'Cambiar mi contraseña', hint: 'Elige una contraseña nueva.', icon: '🔑' },
  { to: '/app/ajustes/solo-socios', label: 'Solo para socios', hint: 'Cosas de socios.', icon: '👥', socioOnly: true },
])

vi.mock('@/layouts/settings-items', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/layouts/settings-items')>()
  return {
    ...actual,
    SETTINGS_ITEMS: sample,
    getSettingsItems: (context: { isSocio?: boolean }) => actual.getSettingsItems(context, sample),
  }
})

async function mountView(role: 'socio' | 'colaborador' | null) {
  const session = useSessionStore()
  if (role) session.setMember({ id: 'm-1', name: 'Ana', role, active: true })
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/app', name: 'AppHome', component: stub },
      { path: '/app/ajustes', name: 'Settings', component: SettingsView },
      { path: '/app/ajustes/contrasena', name: 'ChangePassword', component: stub },
      { path: '/app/ajustes/solo-socios', name: 'SoloSocios', component: stub },
    ],
  })
  router.push('/app/ajustes')
  await router.isReady()
  const wrapper = mount(SettingsView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router, session }
}

const links = (w: Awaited<ReturnType<typeof mountView>>['wrapper']) => w.findAll('a.settings-view__link')

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('SettingsView', () => {
  it('tiene un título "Ajustes" y una navegación con nombre accesible', async () => {
    const { wrapper } = await mountView('colaborador')
    expect(wrapper.get('h1').text()).toBe('Ajustes')
    expect(wrapper.get('nav').attributes('aria-label')).toBe('Ajustes')
  })

  it('una colaboradora ve solo "Cambiar mi contraseña"', async () => {
    const { wrapper } = await mountView('colaborador')
    expect(links(wrapper)).toHaveLength(1)
    expect(links(wrapper)[0].text()).toContain('Cambiar mi contraseña')
    expect(wrapper.text()).not.toContain('Solo para socios')
  })

  it('un socio ve además las entradas de socios', async () => {
    const { wrapper } = await mountView('socio')
    expect(links(wrapper).map((l) => l.get('.settings-view__label').text())).toEqual([
      'Cambiar mi contraseña', 'Solo para socios',
    ])
  })

  it('sin persona elegida no se muestran entradas de socios', async () => {
    const { wrapper } = await mountView(null)
    expect(wrapper.text()).not.toContain('Solo para socios')
  })

  it('cada entrada lleva su ayuda y enlaza a su ruta', async () => {
    const { wrapper } = await mountView('socio')
    const [password, socios] = links(wrapper)
    expect(password.attributes('href')).toBe('/app/ajustes/contrasena')
    expect(password.text()).toContain('Elige una contraseña nueva.')
    expect(socios.attributes('href')).toBe('/app/ajustes/solo-socios')
  })

  it('el ícono es decorativo (aria-hidden): el nombre accesible es el texto', async () => {
    const { wrapper } = await mountView('socio')
    for (const icon of wrapper.findAll('.settings-view__icon')) {
      expect(icon.attributes('aria-hidden')).toBe('true')
    }
  })

  it('si la persona cambia de socio a colaborador con la vista abierta, las entradas de socios desaparecen', async () => {
    const { wrapper, session } = await mountView('socio')
    expect(links(wrapper)).toHaveLength(2)
    session.setMember({ id: 'm-2', name: 'Beto', role: 'colaborador', active: true })
    await flushPromises()
    expect(links(wrapper)).toHaveLength(1)
  })

  it('es navegable con el teclado: son enlaces reales, en orden de lectura', async () => {
    const { wrapper } = await mountView('socio')
    for (const link of links(wrapper)) {
      expect(link.element.tagName).toBe('A')
      expect(link.attributes('tabindex')).toBeUndefined()
    }
  })
})
