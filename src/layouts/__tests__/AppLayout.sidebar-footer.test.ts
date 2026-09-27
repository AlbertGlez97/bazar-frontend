import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
// `?raw` lee el SFC como texto: jsdom no calcula layout, así que las
// declaraciones críticas de CSS se validan tal como están escritas.
import layoutSource from '../AppLayout.vue?raw'
import AppLayout from '@/layouts/AppLayout.vue'

/**
 * Bug: en un teléfono, con el menú lateral EXPANDIDO, el pie (perfil, engrane,
 * salir) desaparecía.
 *
 * Causa: el overlay móvil (`position: fixed; top: 0`, commit 42cceab) heredaba
 * `height: 100vh` de la barra (base 739731a). En un navegador móvil `100vh` es la
 * altura con la barra de direcciones ESCONDIDA, más alta que lo visible: el borde
 * inferior de la barra (donde vive el pie) queda fuera de pantalla, y como el
 * overlay es `fixed` y la barra `overflow: hidden`, no hay forma de llegar a él.
 * El pie es lo último de la columna, así que era lo primero en desaparecer.
 *
 * Arreglo: la barra mide lo VISIBLE (`100dvh`, y el overlay se ancla con
 * `top: 0; bottom: 0`), el `nav` es el único que hace scroll y el pie nunca se
 * encoge ni queda recortado.
 */

vi.mock('@/stores/sales-queue.store', () => ({
  useSalesQueueStore: () => ({
    pendingCount: 0, needsReviewCount: 0, needsReviewRecords: [], isSyncing: false,
    start: vi.fn(), stop: vi.fn(), dismissReview: vi.fn(),
  }),
}))

vi.mock('@/components', async () => ({
  AppButton:        { template: '<button :title="$attrs.title"><slot /></button>' },
  AppAvatar:        { template: '<div />' },
  InstallAppButton: { template: '<div />' },
  BrandLogo:        { template: '<div />' },
  AppBadge:         (await import('@/components/ui/atoms/AppBadge.vue')).default,
  UiModeSwitch:     (await import('@/components/ui/organisms/UiModeSwitch.vue')).default,
  SyncStatusIndicator: (await import('@/components/ui/organisms/SyncStatusIndicator.vue')).default,
}))

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

async function mountLayout(collapsed: boolean, mode: 'venta' | 'gestion' = 'gestion') {
  localStorage.setItem('la-marchanta-ui-mode', mode)
  sessionStorage.setItem('member_context', JSON.stringify({ id: 'm-1', name: 'Ana', role: 'socio', active: true }))
  // El pie empieza colapsado en un teléfono (matchMedia); aquí se controla a mano.
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: collapsed && query.includes('767'), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn(),
  }))
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{
      path: '/app', component: { render: () => h(RouterView) },
      children: [
        { path: '', name: 'AppHome', component: stub },
        { path: 'venta', name: 'Sale', component: stub },
        { path: 'productos', name: 'ProductCatalog', component: stub },
        { path: 'reportes', name: 'Reports', component: stub },
        { path: 'ajustes', name: 'Settings', component: stub },
      ],
    }],
  })
  router.push('/app')
  await router.isReady()
  return mount(AppLayout, { global: { plugins: [createPinia(), router] } })
}

/** El CSS del SFC sin comentarios (para leer selectores y declaraciones tal cual). */
const styleSource = layoutSource
  .slice(layoutSource.indexOf('<style scoped>'))
  .replace(/\/\*[\s\S]*?\*\//g, '')

/** Los cuerpos de TODAS las reglas cuyo selector es exactamente `selector` (o lo lista junto a otros), unidos. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const bodies = Array.from(styleSource.matchAll(new RegExp(`(?:^|[\\n,}])\\s*${escaped}\\s*(?:,[^{]*)?\\{([^}]*)\\}`, 'g'))).map((m) => m[1])
  if (bodies.length === 0) throw new Error(`No se encontró la regla "${selector}" en AppLayout.vue`)
  return bodies.join('\n')
}

describe('pie del menú lateral: estructura (jsdom)', () => {
  it.each([[false, 'expandido'], [true, 'colapsado']])('%s (%s): el pie existe con avatar, engrane y salir', async (collapsed) => {
    const wrapper = await mountLayout(collapsed)
    const footer = wrapper.find('.sidebar__footer')
    expect(footer.exists()).toBe(true)
    expect(footer.find('a.sidebar__settings[href="/app/ajustes"]').exists()).toBe(true)
    expect(footer.find('.sidebar__logout').exists()).toBe(true)
  })

  it('el pie es HERMANO del nav (no está dentro de la zona que hace scroll) y va al final de la barra', async () => {
    const wrapper = await mountLayout(false)
    const sidebar = wrapper.get('aside.sidebar')
    const children = Array.from(sidebar.element.children).map((el) => el.className.split(' ')[0])
    expect(children.at(-1)).toBe('sidebar__footer')
    expect(children.indexOf('sidebar__nav')).toBeLessThan(children.indexOf('sidebar__footer'))
    expect(wrapper.get('.sidebar__nav').element.contains(wrapper.get('.sidebar__footer').element)).toBe(false)
  })

  it('expandido muestra el nombre de la persona; colapsado lo omite pero conserva el engrane y salir', async () => {
    const expanded = await mountLayout(false)
    expect(expanded.find('.sidebar__user').exists()).toBe(true)
    const collapsed = await mountLayout(true)
    expect(collapsed.find('.sidebar__user').exists()).toBe(false)
    expect(collapsed.find('a.sidebar__settings').exists()).toBe(true)
    expect(collapsed.find('.sidebar__logout').exists()).toBe(true)
  })

  it('los controles del pie tienen nombre accesible', async () => {
    const wrapper = await mountLayout(false)
    expect(wrapper.get('a.sidebar__settings').attributes('aria-label')).toBe('Ajustes')
    expect(wrapper.get('.sidebar__logout').attributes('title')).toBe('Cerrar sesión')
  })

  it('en Modo Venta y en Gestión el pie es el mismo', async () => {
    for (const mode of ['venta', 'gestion'] as const) {
      const wrapper = await mountLayout(false, mode)
      expect(wrapper.find('.sidebar__footer a.sidebar__settings').exists()).toBe(true)
    }
  })
})

describe('pie del menú lateral: contrato de CSS (lo que jsdom no puede medir)', () => {
  it('la barra mide lo VISIBLE: 100dvh (con 100vh solo como respaldo para navegadores viejos)', () => {
    const sidebar = rule('.sidebar')
    expect(sidebar).toMatch(/height:\s*100vh/)
    expect(sidebar).toMatch(/height:\s*100dvh/)
    expect(sidebar.indexOf('100vh')).toBeLessThan(sidebar.indexOf('100dvh'))
  })

  it('el overlay móvil se ancla arriba Y abajo del viewport (no depende de una altura fija)', () => {
    const style = layoutSource.slice(layoutSource.indexOf('@media (max-width: 767px)'))
    const overlay = /\.app-layout:not\(\.app-layout--collapsed\)\s+\.sidebar\s*\{([^}]*)\}/.exec(style)?.[1] ?? ''
    expect(overlay).toMatch(/position:\s*fixed/)
    expect(overlay).toMatch(/top:\s*0/)
    expect(overlay).toMatch(/bottom:\s*0/)
    expect(overlay).toMatch(/height:\s*auto/)
  })

  it('el nav es el ÚNICO dueño del scroll y puede encogerse (min-height: 0)', () => {
    const nav = rule('.sidebar__nav')
    expect(nav).toMatch(/flex:\s*1/)
    expect(nav).toMatch(/overflow-y:\s*auto/)
    expect(nav).toMatch(/min-height:\s*0/)
  })

  it.each(['.sidebar__header', '.sidebar__mode', '.sidebar__install', '.sidebar__footer'])('%s no se encoge: el nav cede el espacio, no el pie', (selector) => {
    // `.sidebar__header` y `.sidebar__mode` pueden declararlo en una regla común.
    const style = layoutSource.slice(layoutSource.indexOf('<style scoped>'))
    expect(style).toMatch(new RegExp(`${selector.replace('.', '\\.')}[^{]*\\{[^}]*flex-shrink:\\s*0`))
  })

  it('el pie respeta el área segura inferior (iPhone con barra de gestos)', () => {
    expect(rule('.sidebar__footer')).toMatch(/env\(safe-area-inset-bottom/)
  })

  it('el pie colapsado (apilado) también respeta el área segura', () => {
    const style = layoutSource.slice(layoutSource.indexOf('<style scoped>'))
    const stacked = /\.app-layout--collapsed\s+\.sidebar__footer\s*\{([^}]*)\}/.exec(style)?.[1] ?? ''
    expect(stacked).toMatch(/env\(safe-area-inset-bottom/)
  })

  it('en pantallas bajas (teléfono en horizontal) se oculta "Instalar app" para que quepan el modo, el menú y el pie', () => {
    const style = layoutSource.slice(layoutSource.indexOf('<style scoped>'))
    const short = /@media \(max-height:\s*\d+px\)\s*\{([\s\S]*?)\n\}/.exec(style)?.[1] ?? ''
    expect(short).toMatch(/\.sidebar__install\s*\{[^}]*display:\s*none/)
  })

  it('ningún ancestro recorta el pie: solo `.sidebar` tiene overflow hidden y es el contenedor que ya mide lo visible', () => {
    const hidden = Array.from(styleSource.matchAll(/([^{}]+)\{[^}]*overflow:\s*hidden[^}]*\}/g)).map((m) => m[1].trim())
    // `.sidebar__user` (nombre con puntos suspensivos) es hijo del pie, no un ancestro.
    expect(hidden.filter((s) => !s.startsWith('.sidebar__user'))).toEqual(['.sidebar'])
  })

  it('las barras fijas de la venta (z-index 30 y 40) siguen por debajo del overlay del menú (60)', async () => {
    const sale = (await import('@/views/sales/SaleView.vue?raw')).default
    const zs = Array.from(sale.matchAll(/z-index:\s*(\d+)/g)).map((m) => Number(m[1]))
    expect(Math.max(...zs)).toBeLessThan(60)
    expect(layoutSource).toMatch(/z-index:\s*60/)
  })

  it('no se toca el offset que usan las barras de la venta', () => {
    expect(layoutSource).toMatch(/--app-sidebar-offset:\s*var\(--sidebar-width-collapsed\)/)
    expect(layoutSource).toMatch(/\.app-layout--collapsed\s*\{\s*--app-sidebar-offset:\s*var\(--sidebar-width-collapsed\)/)
  })
})
