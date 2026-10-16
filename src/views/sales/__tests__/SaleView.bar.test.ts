import { describe, expect, it } from 'vitest'
import source from '../SaleView.vue?raw'

// Contrato de CSS de la barra inferior del celular: 48 px de botón y el
// contenido nunca queda tapado (jsdom no calcula layout, así que se lee el CSS).
const css = source.slice(source.indexOf('<style')).replace(/<style[^>]*>/, '').replace(/\/\*[\s\S]*?\*\//g, '')
const rule = (selector: string) =>
  [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter(([, selectors]) => selectors!.split(',').map((part) => part.trim()).includes(selector))
    .map(([, , body]) => body)
    .join(';')
const rem = (body: string, property: string) => Number(body.match(new RegExp(`${property}:\\s*(?:calc\\()?([\\d.]+)rem`))?.[1] ?? 0)

describe('barra inferior del celular — contrato de CSS', () => {
  it('el botón "Cobrar →" mide 48 px (3rem) de alto', () => {
    expect(rem(rule('.sale-view .sale-view__bar-button'), 'min-height')).toBe(3)
  })

  it('la barra está fija abajo, a todo el ancho y desde el borde de la barra lateral (0 en celular)', () => {
    const bar = rule('.sale-view__bar')
    expect(bar).toMatch(/position:\s*fixed/)
    expect(bar).toMatch(/bottom:\s*0/)
    expect(bar).toMatch(/left:\s*var\(--app-sidebar-offset,\s*0px\)/)
  })

  it('el contenido reserva más espacio abajo que lo que mide la barra (48 + relleno + borde), con la zona segura', () => {
    const reserved = rule('.sale-view--narrow.sale-view--has-bar')
    const barHeightRem = 3 /* botón */ + 0.5 * 2 /* relleno vertical */ + 0.125 /* borde de 2 px */
    expect(rem(reserved, 'padding-bottom')).toBeGreaterThanOrEqual(barHeightRem)
    expect(reserved).toMatch(/env\(safe-area-inset-bottom/)
  })

  it('el total no empuja el botón: se recorta con puntos suspensivos en vez de salirse', () => {
    const total = rule('.sale-view__bar-total')
    expect(total).toMatch(/text-overflow:\s*ellipsis/)
    expect(total).toMatch(/min-width:\s*0/)
  })
})

describe('panel "Tu venta" en escritorio — contrato de CSS', () => {
  it('el panel es una columna con alto máximo; no se desplaza entero (solo la lista de productos)', () => {
    const panel = rule('.sale-view__cart')
    expect(panel).toMatch(/display:\s*flex/)
    expect(panel).toMatch(/flex-direction:\s*column/)
    expect(panel).toMatch(/max-height:\s*calc\(100dvh/)
    expect(panel).toMatch(/overflow:\s*hidden/)
    expect(panel).not.toMatch(/overflow-y:\s*auto/)
  })
})
