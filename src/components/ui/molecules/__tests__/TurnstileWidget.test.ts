import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import TurnstileWidget from '../TurnstileWidget.vue'
import { resetTurnstileLoader } from '@/composables/useTurnstile'

interface RenderOptions {
  sitekey: string
  language: string
  callback: (token: string) => void
  'expired-callback': () => void
  'timeout-callback': () => void
  'error-callback': () => void
}

let options: RenderOptions
const api = {
  render: vi.fn((_el: HTMLElement, opts: RenderOptions) => {
    options = opts
    return 'widget-1'
  }),
  reset: vi.fn(),
  remove: vi.fn(),
}

beforeEach(() => {
  resetTurnstileLoader()
  vi.clearAllMocks()
  ;(window as unknown as { turnstile: unknown }).turnstile = api
})

afterEach(() => {
  delete (window as { turnstile?: unknown }).turnstile
  document.head.querySelectorAll('script[src*="challenges.cloudflare.com"]').forEach((s) => s.remove())
})

async function mountWidget(siteKey = 'site-key-123') {
  const wrapper = mount(TurnstileWidget, { props: { siteKey }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('TurnstileWidget', () => {
  it('dibuja el widget de Cloudflare con la clave pública y en español', async () => {
    const wrapper = await mountWidget()

    expect(api.render).toHaveBeenCalledOnce()
    expect(options.sitekey).toBe('site-key-123')
    expect(options.language).toBe('es')
    wrapper.unmount()
  })

  it('emite el token cuando la persona pasa la verificación', async () => {
    const wrapper = await mountWidget()

    options.callback('token-abc')

    expect(wrapper.emitted('verified')).toEqual([['token-abc']])
    wrapper.unmount()
  })

  it('emite "expired" si el token vence o se agota el tiempo (hay que pedir otro)', async () => {
    const wrapper = await mountWidget()

    options['expired-callback']()
    options['timeout-callback']()

    expect(wrapper.emitted('expired')).toHaveLength(2)
    wrapper.unmount()
  })

  it('si el widget falla avisa con un mensaje claro y ofrece reintentar, sin tocar el resto del formulario', async () => {
    const wrapper = await mountWidget()

    options['error-callback']()
    await flushPromises()

    expect(wrapper.emitted('failed')).toEqual([['error']])
    expect(wrapper.get('[role="alert"]').text()).toContain('No pudimos hacer la verificación de seguridad')
    expect(wrapper.get('button').text()).toBe('Reintentar')
    wrapper.unmount()
  })

  it('"Reintentar" vuelve a dibujar el widget y quita el aviso', async () => {
    const wrapper = await mountWidget()
    options['error-callback']()
    await flushPromises()

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(api.reset).toHaveBeenCalledWith('widget-1')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('reset() reinicia el widget (el token ya se gastó en un envío)', async () => {
    const wrapper = await mountWidget()

    ;(wrapper.vm as unknown as { reset: () => void }).reset()

    expect(api.reset).toHaveBeenCalledWith('widget-1')
    wrapper.unmount()
  })

  it('sin clave pública no intenta dibujar: dice que el registro no está disponible y no ofrece reintentar', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const wrapper = await mountWidget('')

    expect(api.render).not.toHaveBeenCalled()
    expect(wrapper.emitted('failed')).toEqual([['config']])
    expect(wrapper.get('[role="alert"]').text()).toBe('El registro no está disponible por ahora.')
    expect(wrapper.find('button').exists()).toBe(false) // reintentar no arregla una configuración
    warn.mockRestore()
    wrapper.unmount()
  })

  it('sin clave pública deja UN aviso en la consola que dice qué variable falta', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const wrapper = await mountWidget('')

    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('VITE_TURNSTILE_SITE_KEY')
    warn.mockRestore()
    wrapper.unmount()
  })

  it('con clave no escribe nada en la consola', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const wrapper = await mountWidget('site-key-123')

    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
    wrapper.unmount()
  })

  it('una falla transitoria (el script no carga) NO dice que el registro no está disponible', async () => {
    delete (window as { turnstile?: unknown }).turnstile
    const wrapper = mount(TurnstileWidget, { props: { siteKey: 'k' }, attachTo: document.body })
    await flushPromises()
    document.head.querySelector('script[src*="challenges.cloudflare.com"]')!.dispatchEvent(new Event('error'))
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).not.toContain('no está disponible')
    wrapper.unmount()
  })

  it('si el script de Cloudflare no carga (sin internet, bloqueado) lo dice y deja reintentar', async () => {
    delete (window as { turnstile?: unknown }).turnstile
    const wrapper = mount(TurnstileWidget, { props: { siteKey: 'k' }, attachTo: document.body })
    await flushPromises()
    document.head.querySelector('script[src*="challenges.cloudflare.com"]')!.dispatchEvent(new Event('error'))
    await flushPromises()

    expect(wrapper.emitted('failed')).toEqual([['load']])
    expect(wrapper.get('[role="alert"]').text()).toContain('No pudimos cargar la verificación de seguridad')
    expect(wrapper.get('button').text()).toBe('Reintentar')

    ;(window as unknown as { turnstile: unknown }).turnstile = api
    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(api.render).toHaveBeenCalledOnce()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('al desmontar quita el widget de Cloudflare', async () => {
    const wrapper = await mountWidget()

    wrapper.unmount()

    expect(api.remove).toHaveBeenCalledWith('widget-1')
  })

  it('el recuadro se anuncia como grupo con nombre para lectores de pantalla', async () => {
    const wrapper = await mountWidget()

    const group = wrapper.get('[role="group"]')
    expect(group.attributes('aria-label')).toBe('Verificación de seguridad')
    wrapper.unmount()
  })
})
