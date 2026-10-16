import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import {
  detectIosBrowser,
  detectPlatform,
  initPwaInstall,
  resetPwaInstallState,
  usePwaInstall,
} from '../usePwaInstall'
import source from '../usePwaInstall.ts?raw'
import mainSource from '../../main.ts?raw'

// `beforeinstallprompt` se dispara UNA sola vez, al cargar la página. El cajón y "Mi cuenta"
// están cerrados (sin montar) en ese momento, así que el listener no puede depender del
// montaje de ningún botón: se registra al arrancar la app y el evento queda guardado.

const originalUA = Object.getOwnPropertyDescriptor(navigator, 'userAgent')
const originalTouch = Object.getOwnPropertyDescriptor(navigator, 'maxTouchPoints')
const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia')

function setUA(userAgent: string, maxTouchPoints = 0) {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: userAgent })
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: maxTouchPoints })
}

function setStandalone(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: vi.fn().mockReturnValue({ matches }) })
}

function fakePromptEvent() {
  const event = new Event('beforeinstallprompt') as Event & { prompt: ReturnType<typeof vi.fn>; userChoice: Promise<{ outcome: string; platform: string }> }
  event.prompt = vi.fn().mockResolvedValue(undefined)
  event.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' })
  return event
}

function useInComponent() {
  let api!: ReturnType<typeof usePwaInstall>
  const wrapper = mount(defineComponent({ setup() { api = usePwaInstall(); return () => null } }))
  return { wrapper, api }
}

beforeEach(() => {
  setUA('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36')
  setStandalone(false)
  resetPwaInstallState()
})
afterEach(() => {
  resetPwaInstallState()
  if (originalUA) Object.defineProperty(navigator, 'userAgent', originalUA)
  if (originalTouch) Object.defineProperty(navigator, 'maxTouchPoints', originalTouch)
  if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia)
})

describe('usePwaInstall — el listener se registra al arrancar, no al montar un botón', () => {
  it('un evento que llega ANTES de que exista cualquier componente igual queda guardado', () => {
    initPwaInstall()

    window.dispatchEvent(fakePromptEvent())
    const { wrapper, api } = useInComponent() // el cajón se monta mucho después

    expect(api.canPrompt.value).toBe(true)
    wrapper.unmount()
  })

  it('lo guarda aunque el componente que lo usó ya se haya desmontado', () => {
    initPwaInstall()
    const first = useInComponent()
    first.wrapper.unmount()

    window.dispatchEvent(fakePromptEvent())
    const second = useInComponent()

    expect(second.api.canPrompt.value).toBe(true)
    second.wrapper.unmount()
  })

  it('registrar el arranque dos veces no duplica listeners (un solo evento guardado)', () => {
    const add = vi.spyOn(window, 'addEventListener')
    initPwaInstall()
    initPwaInstall()

    expect(add.mock.calls.filter(([type]) => type === 'beforeinstallprompt')).toHaveLength(1)
    expect(add.mock.calls.filter(([type]) => type === 'appinstalled')).toHaveLength(1)
    add.mockRestore()
  })

  it('el composable ya no registra listeners con onMounted (dependería de montar un botón)', () => {
    expect(source).not.toMatch(/onMounted/)
  })

  it('main.ts arranca el registro ANTES de montar la app', () => {
    const init = mainSource.indexOf('initPwaInstall()')
    const mount = mainSource.indexOf("app.mount('#app')")

    expect(init).toBeGreaterThan(-1)
    expect(mount).toBeGreaterThan(-1)
    expect(init).toBeLessThan(mount)
  })

  it('evita el banner del navegador (preventDefault) para controlar el botón', () => {
    initPwaInstall()
    const event = fakePromptEvent()
    const prevent = vi.spyOn(event, 'preventDefault')

    window.dispatchEvent(event)

    expect(prevent).toHaveBeenCalled()
  })
})

describe('usePwaInstall — instalada / no instalada', () => {
  it('sin evento no se puede instalar', () => {
    initPwaInstall()

    expect(useInComponent().api.canPrompt.value).toBe(false)
  })

  it('en modo standalone la app ya está instalada', () => {
    setStandalone(true)
    initPwaInstall()

    expect(useInComponent().api.isInstalled.value).toBe(true)
  })

  it('appinstalled limpia el evento y marca la app como instalada', () => {
    initPwaInstall()
    window.dispatchEvent(fakePromptEvent())
    const { api } = useInComponent()
    expect(api.canPrompt.value).toBe(true)

    window.dispatchEvent(new Event('appinstalled'))

    expect(api.canPrompt.value).toBe(false)
    expect(api.isInstalled.value).toBe(true)
  })

  it('promptInstall usa el evento guardado y lo consume', async () => {
    initPwaInstall()
    const event = fakePromptEvent()
    window.dispatchEvent(event)
    const { api } = useInComponent()

    expect(await api.promptInstall()).toBe('accepted')
    expect(event.prompt).toHaveBeenCalledTimes(1)
    expect(api.canPrompt.value).toBe(false)
  })
})

describe('usePwaInstall — iPhone y iPad (sin beforeinstallprompt)', () => {
  const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
  const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1'
  const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'

  it('un iPhone es "ios"', () => {
    setUA(IPHONE_SAFARI, 5)
    expect(detectPlatform()).toBe('ios')
  })

  it('un iPad con iPadOS se identifica como Mac con pantalla táctil: también es "ios"', () => {
    setUA(IPAD_AS_MAC, 5)
    expect(detectPlatform()).toBe('ios')
  })

  it('una Mac de verdad (sin pantalla táctil) NO es iOS', () => {
    setUA(IPAD_AS_MAC, 0)
    expect(detectPlatform()).toBe('desktop')
  })

  it('Android sigue siendo "android"', () => {
    expect(detectPlatform()).toBe('android')
  })

  it('Safari en iPhone puede instalar; Chrome (CriOS) en iPhone no', () => {
    setUA(IPHONE_SAFARI, 5)
    expect(detectIosBrowser()).toBe('safari')
    setUA(IPHONE_CHROME, 5)
    expect(detectIosBrowser()).toBe('other')
  })

  it('Firefox, Edge y Opera en iOS tampoco pueden instalar', () => {
    for (const token of ['FxiOS/124.0', 'EdgiOS/123.0', 'OPiOS/16.0']) {
      setUA(`Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 ${token} Mobile/15E148 Safari/604.1`, 5)
      expect(detectIosBrowser()).toBe('other')
    }
  })

  it('el composable expone plataforma y navegador de iOS', () => {
    setUA(IPHONE_CHROME, 5)
    initPwaInstall()
    const { api } = useInComponent()

    expect(api.platform).toBe('ios')
    expect(api.iosBrowser).toBe('other')
  })
})
