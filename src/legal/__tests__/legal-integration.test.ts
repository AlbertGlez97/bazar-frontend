import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createAppRouter } from '@/router'
import { useSessionStore } from '@/stores/session.store'
import { LEGAL_VERSION } from '../versions'
import { PRIVACY_NOTICE } from '../privacy-notice'
import { TERMS } from '../terms'
import PrivacyView from '@/views/legal/PrivacyView.vue'
import TermsView from '@/views/legal/TermsView.vue'
import SettingsView from '@/views/settings/SettingsView.vue'
import AppNavDrawer from '@/components/ui/organisms/AppNavDrawer.vue'
import AccountMenu from '@/components/ui/molecules/AccountMenu.vue'
import PublicLayout from '@/layouts/PublicLayout.vue'
import AuthLayout from '@/layouts/AuthLayout.vue'

vi.mock('@/services/auth.service', () => ({ default: { login: vi.fn(), me: vi.fn() } }))
vi.stubGlobal('scrollTo', vi.fn())

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActivePinia(createPinia())
})
afterEach(() => {
  document.body.innerHTML = ''
})

const stub = { template: '<div />' }
const links = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('a').map((a) => a.attributes('href'))

describe('rutas /privacidad y /terminos', () => {
  it('existen, son públicas y viven dentro del layout público (con su pie)', () => {
    const router = createAppRouter(createMemoryHistory())

    for (const [path, name] of [['/privacidad', 'Privacy'], ['/terminos', 'Terms']] as const) {
      const route = router.resolve(path)
      expect(route.name).toBe(name)
      expect(route.meta.requiresAuth).toBeFalsy()
      expect(route.meta.redirectIfAuth).toBeFalsy()
      expect(route.matched[0]!.components?.default).toBeDefined()
    }
  })

  it('se pueden abrir SIN sesión sin que el guard mande al login', async () => {
    const router = createAppRouter(createMemoryHistory())

    await router.push('/privacidad')
    expect(router.currentRoute.value.name).toBe('Privacy')
    await router.push('/terminos')
    expect(router.currentRoute.value.name).toBe('Terms')
  })

  it('se pueden abrir CON sesión sin que mande a /app', async () => {
    localStorage.setItem('access_token', 'a.' + btoa(JSON.stringify({ sub: 'account-a' })) + '.z')
    localStorage.setItem('token_expires_at', String(Date.now() + 60_000))
    const router = createAppRouter(createMemoryHistory())

    await router.push('/privacidad')

    expect(router.currentRoute.value.name).toBe('Privacy')
  })
})

describe('vistas: encabezados y versión', () => {
  const mountView = (view: typeof PrivacyView) => mount(view, { global: { stubs: { RouterLink: RouterLinkStub } } })

  it('/privacidad: un h1 "Aviso de Privacidad", la versión y las secciones del documento', () => {
    const wrapper = mountView(PrivacyView)

    expect(wrapper.findAll('h1')).toHaveLength(1)
    expect(wrapper.get('h1').text()).toBe('Aviso de Privacidad')
    expect(wrapper.get('.legal-document__version').text()).toContain(`Versión ${LEGAL_VERSION}`)
    expect(wrapper.findAll('section.legal-document__section')).toHaveLength(PRIVACY_NOTICE.sections.length)
  })

  it('/terminos: un h1 "Términos y Condiciones de Uso", la versión y las secciones', () => {
    const wrapper = mountView(TermsView)

    expect(wrapper.get('h1').text()).toBe('Términos y Condiciones de Uso')
    expect(wrapper.get('.legal-document__version').text()).toContain(`Versión ${LEGAL_VERSION}`)
    expect(wrapper.findAll('section.legal-document__section')).toHaveLength(TERMS.sections.length)
  })

  it('el título de la pestaña del navegador dice cuál documento es', async () => {
    mountView(PrivacyView)
    await nextTick()
    expect(document.title).toContain('Aviso de Privacidad')
    mountView(TermsView)
    await nextTick()
    expect(document.title).toContain('Términos y Condiciones')
  })
})

describe('pie público en las páginas públicas', () => {
  async function mountLayout(component: typeof PublicLayout | typeof AuthLayout, path: string) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'Landing', component: stub },
        { path: '/login', name: 'Login', component: stub },
        { path: '/registro-negocio', name: 'BusinessRegistration', component: stub },
        { path: '/privacidad', name: 'Privacy', component: stub },
        { path: '/terminos', name: 'Terms', component: stub },
      ],
    })
    await router.push(path)
    await router.isReady()
    return mount(component, { global: { plugins: [createPinia(), router] } })
  }

  it.each([['inicio', '/'], ['registro', '/registro-negocio']])('PublicLayout (%s) trae los dos enlaces legales y el correo', async (_name, path) => {
    const wrapper = await mountLayout(PublicLayout, path)
    const footer = wrapper.get('footer')

    expect(footer.findAll('a').map((a) => a.attributes('href'))).toEqual(expect.arrayContaining(['/privacidad', '/terminos']))
    expect(footer.text()).toContain('Aviso de privacidad')
    expect(footer.text()).toContain('Términos y condiciones')
    expect(footer.find('a[href^="mailto:"]').exists()).toBe(true)
  })

  it('AuthLayout (entrar) también trae el pie con los enlaces legales', async () => {
    const wrapper = await mountLayout(AuthLayout, '/login')

    expect(links(wrapper)).toEqual(expect.arrayContaining(['/privacidad', '/terminos']))
    expect(wrapper.find('footer').exists()).toBe(true)
  })
})

describe('dentro de la app: Ajustes, cajón y "Mi cuenta"', () => {
  async function mountSettings(role: 'socio' | 'colaborador') {
    useSessionStore().setMember({ id: 'm-1', name: 'Ana', role, active: true })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/app/ajustes', name: 'Settings', component: SettingsView },
        { path: '/app/ajustes/:rest(.*)*', component: stub },
        { path: '/privacidad', name: 'Privacy', component: stub },
        { path: '/terminos', name: 'Terms', component: stub },
      ],
    })
    await router.push('/app/ajustes')
    await router.isReady()
    return mount(SettingsView, { global: { plugins: [router] } })
  }

  it.each(['socio', 'colaborador'] as const)('Ajustes (%s) ofrece los dos textos legales', async (role) => {
    const wrapper = await mountSettings(role)
    const legal = wrapper.get('nav[aria-label="Información legal"]')

    expect(legal.findAll('a').map((a) => a.attributes('href'))).toEqual(['/privacidad', '/terminos'])
    expect(legal.text()).toContain('Aviso de privacidad')
    expect(legal.text()).toContain('Términos y condiciones')
  })

  it('el cajón del socio trae los dos enlaces legales y cierra al tocarlos', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: stub }] })
    await router.push('/app')
    const wrapper = mount(AppNavDrawer, {
      attachTo: document.body,
      props: { modelValue: true, items: [], mode: 'gestion', accountName: 'Ana' },
      global: { plugins: [router] },
    })
    await flushPromises()
    const nav = document.body.querySelector('nav[aria-label="Información legal"]')!

    expect([...nav.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['/privacidad', '/terminos'])
    ;(nav.querySelector('a') as HTMLAnchorElement).click()
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
    wrapper.unmount()
  })

  it('"Mi cuenta" del colaborador trae los dos enlaces legales', async () => {
    const wrapper = mount(AccountMenu, { attachTo: document.body, props: { online: true }, global: { stubs: { RouterLink: RouterLinkStub } } })
    await wrapper.get('.account-menu__trigger').trigger('click')
    await nextTick()
    const nav = document.body.querySelector('nav[aria-label="Información legal"]')!

    expect(nav.textContent).toContain('Aviso de privacidad')
    expect(nav.textContent).toContain('Términos y condiciones')
    expect(nav.querySelectorAll('a')).toHaveLength(2)
    wrapper.unmount()
  })
})

describe('anclas del índice', () => {
  it('un enlace #ancla de /privacidad o /terminos lleva a la sección, no arriba de la página', () => {
    const router = createAppRouter(createMemoryHistory())
    const scroll = router.options.scrollBehavior!

    expect(scroll({ name: 'Privacy', hash: '#derechos-arco' } as never, {} as never, null)).toEqual({ el: '#derechos-arco' })
    expect(scroll({ name: 'Terms', hash: '#contacto' } as never, {} as never, null)).toEqual({ el: '#contacto' })
  })

  it('el resto de las rutas siguen arrancando arriba', () => {
    const router = createAppRouter(createMemoryHistory())
    const scroll = router.options.scrollBehavior!

    expect(scroll({ name: 'Landing', hash: '' } as never, {} as never, null)).toEqual({ top: 0 })
  })
})
