import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CartSummary from '../CartSummary.vue'
import source from '../CartSummary.vue?raw'

const mountSummary = (props: Record<string, unknown> = {}) =>
  mount(CartSummary, { props: { totalMinor: 110000, ...props } })

const total = (w: ReturnType<typeof mountSummary>) => w.get('.cart-summary__total')

describe('CartSummary (el total)', () => {
  it('muestra "Total" y el monto', () => {
    const wrapper = mountSummary()

    expect(wrapper.text()).toContain('Total')
    expect(total(wrapper).text()).toBe('$1,100.00')
  })

  it.each([
    [0, '$0.00'],
    [5, '$0.05'],
    [99999, '$999.99'],
    [110000, '$1,100.00'],
    [1234567, '$12,345.67'],
    [123456789, '$1,234,567.89'],
  ])('formatea %i centavos con separador de miles: %s', (totalMinor, text) => {
    expect(total(mountSummary({ totalMinor })).text()).toBe(text)
  })

  it('no muestra efectivo recibido, cambio ni estado: eso va aparte', () => {
    const wrapper = mountSummary()

    expect(wrapper.text()).not.toMatch(/Recibido|Cambio|Faltan|Justo/i)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('es una región con nombre y el monto se lee completo para lectores de pantalla', () => {
    const wrapper = mountSummary({ totalMinor: 1234567 })

    expect(wrapper.get('section').attributes('aria-label')).toBe('Total de la venta')
    expect(total(wrapper).attributes('aria-label')).toBe('Total $12,345.67')
  })
})

describe('el total nunca se sale de su tarjeta ni se corta (contrato de CSS)', () => {
  const style = source.slice(source.indexOf('<style'))
  const rule = (selector: string) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return style.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] ?? ''
  }
  const card = rule('.cart-summary')
  const amount = rule('.cart-summary__total')

  it('la tarjeta es un contenedor de tamaño en línea: la letra se mide contra SU ancho, no el de la pantalla', () => {
    expect(card).toMatch(/container-type:\s*inline-size/)
    expect(card).toMatch(/min-width:\s*0/)
    expect(card).toMatch(/max-width:\s*100%/)
  })

  it('la letra del total se ajusta con clamp() sobre el ancho de la tarjeta (cqi), con un mínimo legible', () => {
    expect(amount).toMatch(/font-size:\s*clamp\(\s*1\.5rem,\s*[\d.]+cqi,\s*3\.75rem\s*\)/)
  })

  it('trae una letra de respaldo para navegadores sin unidades de contenedor', () => {
    const declarations = amount.match(/font-size:[^;]+;/g) ?? []
    expect(declarations.length).toBeGreaterThanOrEqual(2)
    expect(declarations[0]).toMatch(/clamp\(\s*1\.5rem,\s*[\d.]+vw,/)
  })

  it('el monto no se parte en dos renglones ni se desborda', () => {
    expect(amount).toMatch(/white-space:\s*nowrap/)
    expect(amount).toMatch(/max-width:\s*100%/)
    expect(amount).toMatch(/min-width:\s*0/)
  })

  it('los dígitos tienen el mismo ancho, para que el cálculo del ajuste sea estable', () => {
    expect(amount).toMatch(/font-variant-numeric:\s*tabular-nums/)
  })

  /**
   * jsdom no mide. Aquí se estima el peor caso con la regla del propio CSS:
   * letra = clamp(1.5rem, K cqi, 3.75rem), ancho del texto ≈ caracteres × 0.62 em
   * (dígitos tabulares de una tipografía display). Debe caber en la tarjeta más
   * angosta (320 px de pantalla − márgenes de la vista − relleno de la tarjeta).
   */
  it.each([
    ['12,345.67', 320],
    ['12,345.67', 360],
    ['1,234,567.89', 320],
    ['21,474,836.47', 320],
  ])('estimación: MXN %s cabe en una tarjeta de pantalla de %i px', (digits, screen) => {
    const text = `$${digits}`
    const k = Number(/clamp\(\s*1\.5rem,\s*([\d.]+)cqi/.exec(amount)![1])
    const cardInner = screen - 2 * 16 /* margen de la vista */ - 2 * 16 /* relleno de la tarjeta */
    const fontPx = Math.min(60, Math.max(24, (k / 100) * cardInner))
    const textWidth = text.length * 0.62 * fontPx

    expect(textWidth, `${text} a ${fontPx.toFixed(1)}px mide ${textWidth.toFixed(0)}px de ${cardInner}px`).toBeLessThanOrEqual(cardInner)
  })
})
