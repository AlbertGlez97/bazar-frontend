import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { initPwaInstall, resetPwaInstallState } from '@/composables/usePwaInstall'
import AppNavDrawer from '../AppNavDrawer.vue'

afterEach(() => {
  document.body.innerHTML = ''
  document.body.style.overflow = ''
})

const items = [
  { to: '/app', label: 'Inicio', icon: '🏠', exact: true },
  { to: '/app/productos', label: 'Productos', icon: '📦', exact: false },
]

async function host() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { render: () => null } }],
  })
  await router.push('/app')
  const open = ref(false)
  const mode = ref<'venta' | 'gestion'>('gestion')
  const events: string[] = []
  const Host = defineComponent({
    setup() {
      return () => h('div', [
        h('button', { id: 'opener', onClick: () => { open.value = true } }, 'Menú'),
        h(AppNavDrawer, {
          modelValue: open.value,
          'onUpdate:modelValue': (value: boolean) => { open.value = value },
          items,
          mode: mode.value,
          'onUpdate:mode': (value: 'venta' | 'gestion') => { mode.value = value; events.push(`mode:${value}`) },
          accountName: 'Ana',
          onLogout: () => events.push('logout'),
        }),
      ])
    },
  })
  const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [router] } })
  document.getElementById('opener')!.focus()
  document.getElementById('opener')!.click()
  await nextTick()
  await nextTick()
  return { wrapper, open, mode, events, router }
}

const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]')!
const press = (key: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))

describe('AppNavDrawer', () => {
  it('es un diálogo modal con nombre "Menú" y se abre desde la izquierda', async () => {
    const { wrapper } = await host()

    expect(dialog().getAttribute('aria-modal')).toBe('true')
    expect(dialog().textContent).toContain('Menú')
    expect(document.body.querySelector('.app-drawer-root--left')).not.toBeNull()
    wrapper.unmount()
  })

  it('muestra el cambio Venta/Gestión, los ítems del modo, la cuenta y "Cerrar sesión"', async () => {
    const { wrapper } = await host()
    const text = dialog().textContent!

    expect(dialog().querySelector('.ui-mode-switch')).not.toBeNull()
    expect(text).toContain('Inicio')
    expect(text).toContain('Productos')
    expect(text).toContain('Ana')
    expect(text).toContain('Cerrar sesión')
    wrapper.unmount()
  })

  it('cambiar de modo avisa y cierra el cajón', async () => {
    const { wrapper, events, open } = await host()

    dialog().querySelector<HTMLButtonElement>('[aria-label="Modo Venta"]')!.click()
    await nextTick()
    await nextTick()

    expect(events).toContain('mode:venta')
    expect(open.value).toBe(false)
    wrapper.unmount()
  })

  it('tocar un ítem navega y cierra el cajón', async () => {
    const { wrapper, open, router } = await host()

    dialog().querySelector<HTMLAnchorElement>('a[href="/app/productos"]')!.click()
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/app/productos')
    expect(open.value).toBe(false)
    wrapper.unmount()
  })

  it('"Cerrar sesión" avisa y cierra el cajón', async () => {
    const { wrapper, events, open } = await host()

    dialog().querySelector<HTMLButtonElement>('[data-action="logout"]')!.click()
    await nextTick()
    await nextTick()

    expect(events).toContain('logout')
    expect(open.value).toBe(false)
    wrapper.unmount()
  })

  it('cierra con Escape y con un clic fuera (el fondo)', async () => {
    const { wrapper, open } = await host()

    press('Escape')
    await nextTick()
    expect(open.value).toBe(false)

    document.getElementById('opener')!.click()
    await nextTick()
    document.body.querySelector<HTMLElement>('.app-drawer__backdrop')!.click()
    await nextTick()
    expect(open.value).toBe(false)
    wrapper.unmount()
  })

  it('atrapa el foco: Tab desde el último elemento vuelve al primero', async () => {
    const { wrapper } = await host()
    const focusables = [...dialog().querySelectorAll<HTMLElement>('button, a[href]')]
    focusables.at(-1)!.focus()

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    document.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(focusables[0])
    wrapper.unmount()
  })

  it('devuelve el foco al botón que lo abrió', async () => {
    const { wrapper } = await host()

    press('Escape')
    await nextTick()
    await nextTick()

    expect(document.activeElement).toBe(document.getElementById('opener'))
    wrapper.unmount()
  })

  it('lista los ítems del modo más Ajustes, cada uno con su zona táctil', async () => {
    const { wrapper } = await host()

    expect(dialog().querySelectorAll('.app-nav-drawer__link').length).toBe(items.length + 1)
    expect(dialog().querySelector('a[href="/app/ajustes"]')).not.toBeNull()
    wrapper.unmount()
  })
})

describe('AppNavDrawer — Instalar app (celular)', () => {
  function promptEvent() {
    const event = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string; platform: string }> }
    event.prompt = () => Promise.resolve()
    event.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' })
    return event
  }

  beforeEach(() => {
    resetPwaInstallState()
    initPwaInstall()
  })
  afterEach(() => resetPwaInstallState())

  it('el evento que llegó ANTES de abrir el cajón igual muestra "Instalar app"', async () => {
    window.dispatchEvent(promptEvent())
    const { wrapper } = await host()

    expect(dialog().querySelector('.install-btn')!.textContent).toContain('Instalar app')
    wrapper.unmount()
  })

  it('sin evento no hay botón en el cajón', async () => {
    const { wrapper } = await host()

    expect(dialog().querySelector('.install-btn')).toBeNull()
    wrapper.unmount()
  })

  it('si el evento llega con el cajón abierto, el botón aparece', async () => {
    const { wrapper } = await host()
    window.dispatchEvent(promptEvent())
    await nextTick()

    expect(dialog().querySelector('.install-btn')).not.toBeNull()
    wrapper.unmount()
  })

  it('al instalarse (appinstalled) el botón desaparece del cajón', async () => {
    window.dispatchEvent(promptEvent())
    const { wrapper } = await host()

    window.dispatchEvent(new Event('appinstalled'))
    await nextTick()

    expect(dialog().querySelector('.install-btn')).toBeNull()
    wrapper.unmount()
  })
})
