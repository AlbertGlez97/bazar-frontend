import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { initPwaInstall, resetPwaInstallState } from '@/composables/usePwaInstall'
import InstallAppButton from '../InstallAppButton.vue'
import source from '../InstallAppButton.vue?raw'

// "Instalar app": visible solo si Chrome disparó el evento y la app NO está instalada.
// En iPhone/iPad (Safari no tiene beforeinstallprompt) abre una explicación corta.

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1'
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36'

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
function promptEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt') as Event & { prompt: ReturnType<typeof vi.fn>; userChoice: Promise<{ outcome: string; platform: string }> }
  event.prompt = vi.fn().mockResolvedValue(undefined)
  event.userChoice = Promise.resolve({ outcome, platform: 'web' })
  return event
}

beforeEach(() => {
  setUA(ANDROID)
  setStandalone(false)
  resetPwaInstallState()
})
afterEach(() => {
  document.body.innerHTML = ''
  resetPwaInstallState()
  if (originalUA) Object.defineProperty(navigator, 'userAgent', originalUA)
  if (originalTouch) Object.defineProperty(navigator, 'maxTouchPoints', originalTouch)
  if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia)
})

const mountButton = () => mount(InstallAppButton, { attachTo: document.body })
const button = () => document.body.querySelector<HTMLButtonElement>('.install-btn')
const modal = () => document.body.querySelector<HTMLElement>('.install-modal')

describe('InstallAppButton — Android y escritorio (beforeinstallprompt)', () => {
  it('sin evento no se ve', async () => {
    initPwaInstall()
    mountButton()
    await nextTick()

    expect(button()).toBeNull()
  })

  it('cuando Chrome dispara el evento aparece con el texto "Instalar app"', async () => {
    initPwaInstall()
    const wrapper = mountButton()
    window.dispatchEvent(promptEvent())
    await nextTick()

    expect(button()).not.toBeNull()
    expect(button()!.textContent).toContain('Instalar app')
    wrapper.unmount()
  })

  it('tocarlo lanza el aviso de instalación de Chrome', async () => {
    initPwaInstall()
    const event = promptEvent()
    window.dispatchEvent(event)
    const wrapper = mountButton()
    await nextTick()

    button()!.click()
    await nextTick()

    expect(event.prompt).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('un evento que llegó ANTES de montar el botón igual lo muestra', async () => {
    initPwaInstall()
    window.dispatchEvent(promptEvent())
    await nextTick()

    const wrapper = mountButton()
    await nextTick()

    expect(button()).not.toBeNull()
    wrapper.unmount()
  })

  it('en modo standalone (ya instalada) no se ve, aunque haya evento', async () => {
    setStandalone(true)
    initPwaInstall()
    window.dispatchEvent(promptEvent())
    const wrapper = mountButton()
    await nextTick()

    expect(button()).toBeNull()
    wrapper.unmount()
  })

  it('al instalarse (appinstalled) desaparece', async () => {
    initPwaInstall()
    window.dispatchEvent(promptEvent())
    const wrapper = mountButton()
    await nextTick()
    expect(button()).not.toBeNull()

    window.dispatchEvent(new Event('appinstalled'))
    await nextTick()

    expect(button()).toBeNull()
    wrapper.unmount()
  })

  it('tras aceptar la instalación deja de verse (el evento se consume)', async () => {
    initPwaInstall()
    window.dispatchEvent(promptEvent('accepted'))
    const wrapper = mountButton()
    await nextTick()

    button()!.click()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await nextTick()

    expect(button()).toBeNull()
    wrapper.unmount()
  })
})

describe('InstallAppButton — iPhone y iPad en Safari', () => {
  it('se ve sin evento y al tocarlo explica Compartir → Añadir a pantalla de inicio', async () => {
    setUA(IPHONE_SAFARI, 5)
    initPwaInstall()
    const wrapper = mountButton()
    await nextTick()
    expect(button()).not.toBeNull()

    button()!.click()
    await nextTick()

    expect(modal()).not.toBeNull()
    const text = modal()!.textContent!
    expect(text).toContain('Compartir')
    expect(text).toContain('Añadir a pantalla de inicio')
    expect(text).not.toContain('Safari y sigue')
    wrapper.unmount()
  })

  it('un iPad (iPadOS se identifica como Mac con pantalla táctil) también la explica', async () => {
    setUA(IPAD_AS_MAC, 5)
    initPwaInstall()
    const wrapper = mountButton()
    await nextTick()

    button()!.click()
    await nextTick()

    expect(modal()!.textContent).toContain('Añadir a pantalla de inicio')
    wrapper.unmount()
  })

  it('una Mac de escritorio sin evento NO muestra el botón', async () => {
    setUA(IPAD_AS_MAC, 0)
    initPwaInstall()
    const wrapper = mountButton()
    await nextTick()

    expect(button()).toBeNull()
    wrapper.unmount()
  })

  it('con Chrome en iPhone avisa que ahí no se puede instalar y que se abra en Safari', async () => {
    setUA(IPHONE_CHROME, 5)
    initPwaInstall()
    const wrapper = mountButton()
    await nextTick()

    button()!.click()
    await nextTick()

    const text = modal()!.textContent!
    expect(text).toContain('Chrome en iPhone no puede instalar la app')
    expect(text).toContain('Abre esta página en Safari')
    expect(text).not.toContain('Añadir a pantalla de inicio')
    wrapper.unmount()
  })

  it('en modo standalone (ya instalada) tampoco se ve en iPhone', async () => {
    setUA(IPHONE_SAFARI, 5)
    setStandalone(true)
    initPwaInstall()
    const wrapper = mountButton()
    await nextTick()

    expect(button()).toBeNull()
    wrapper.unmount()
  })

  it('el modal se cierra con la ✕ y no queda abierto', async () => {
    setUA(IPHONE_SAFARI, 5)
    initPwaInstall()
    const wrapper = mountButton()
    await nextTick()
    button()!.click()
    await nextTick()

    document.body.querySelector<HTMLButtonElement>('.install-modal__close')!.click()
    await nextTick()

    expect(modal()).toBeNull()
    wrapper.unmount()
  })

  it('frases cortas: ningún texto de las instrucciones pasa de 20 palabras', () => {
    const texts = [...source.matchAll(/>\s*([^<>{}]{12,})\s*</g)].map((m) => m[1]!.replace(/\s+/g, ' ').trim())
    for (const text of texts) {
      for (const sentence of text.split(/(?<=[.!?])\s+/)) {
        expect(sentence.split(' ').length, sentence).toBeLessThanOrEqual(20)
      }
    }
  })
})

describe('InstallAppButton — el modal va por encima del cajón', () => {
  it('se monta en <body> (Teleport) y con un z-index mayor al del cajón (1000)', () => {
    expect(source).toMatch(/<Teleport to="body">/)
    const z = Number(source.match(/\.install-modal\s*\{[^}]*z-index:\s*(\d+)/)?.[1])
    expect(z).toBeGreaterThan(1000)
  })
})
