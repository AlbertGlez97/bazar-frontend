import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ScanToast from '../ScanToast.vue'
import source from '../ScanToast.vue?raw'

afterEach(() => { document.body.innerHTML = '' })

const css = source.slice(source.indexOf('<style')).replace(/<style[^>]*>/, '').replace(/\/\*[\s\S]*?\*\//g, '')
const rule = (selector: string) =>
  [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter(([, selectors]) => selectors!.split(',').map((part) => part.trim()).includes(selector))
    .map(([, , body]) => body)
    .join(';')

describe('ScanToast', () => {
  it('se monta en <body> (teleport), no dentro del modal', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(ScanToast, { props: { notice: { kind: 'success', title: 'Agregado ✓', detail: 'Vaso azul' } }, attachTo: host })

    expect(host.querySelector('.scan-toast')).toBeNull()
    expect(document.body.querySelector('.scan-toast')?.textContent).toContain('Vaso azul')
    wrapper.unmount()
  })

  it('la región viva existe SIEMPRE (aunque no haya aviso) y es polite, para que se anuncie', async () => {
    const wrapper = mount(ScanToast, { props: { notice: null }, attachTo: document.body })
    const region = document.body.querySelector('.scan-toast-region')!

    expect(region.getAttribute('aria-live')).toBe('polite')
    expect(document.body.querySelector('.scan-toast')).toBeNull()

    await wrapper.setProps({ notice: { kind: 'success', title: 'Agregado ✓', detail: 'Vaso azul' } })
    expect(document.body.querySelector('.scan-toast-region')).toBe(region)
    wrapper.unmount()
  })

  it('verde para agregado y rojo para error, con ícono y texto (no solo color)', async () => {
    const wrapper = mount(ScanToast, { props: { notice: { kind: 'success', title: 'Agregado ✓', detail: 'Vaso azul' } }, attachTo: document.body })
    expect(document.body.querySelector('.scan-toast')!.classList.contains('scan-toast--success')).toBe(true)

    await wrapper.setProps({ notice: { kind: 'error', title: 'No encontré este producto' } })
    const toast = document.body.querySelector('.scan-toast')!
    expect(toast.classList.contains('scan-toast--error')).toBe(true)
    expect(toast.textContent).toContain('No encontré este producto')
    expect(toast.querySelector('[aria-hidden="true"]')).not.toBeNull()
    wrapper.unmount()
  })

  it('no tiene botones ni enlaces y no recibe toques', () => {
    const wrapper = mount(ScanToast, { props: { notice: { kind: 'success', title: 'Agregado ✓', detail: 'Vaso' } }, attachTo: document.body })

    expect(document.body.querySelector('.scan-toast-region button, .scan-toast-region a')).toBeNull()
    expect(rule('.scan-toast-region')).toMatch(/pointer-events:\s*none/)
    wrapper.unmount()
  })

  it('apilamiento: por ENCIMA del modal (1000) y del toast global (2000)', () => {
    const z = Number(rule('.scan-toast-region').match(/z-index:\s*(\d+)/)?.[1])
    expect(z).toBeGreaterThan(2000)
  })

  it('va arriba y centrado, no sobre el centro de la cámara', () => {
    const region = rule('.scan-toast-region')
    expect(region).toMatch(/top:\s*calc\(/)
    expect(region).toMatch(/env\(safe-area-inset-top/)
    expect(region).not.toMatch(/bottom:/)
    expect(region).not.toMatch(/top:\s*50%/)
  })

  it('con prefers-reduced-motion no hay movimiento (solo aparece)', () => {
    expect(source).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
    const reduced = source.slice(source.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reduced).toMatch(/transform:\s*none/)
  })
})
