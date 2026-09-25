import { describe, expect, it } from 'vitest'
import { NAV_ITEMS, getNavItems, type NavItemDef } from '../nav-items'

const tos = (items: { to: string }[]) => items.map((item) => item.to)

describe('getNavItems', () => {
  it('Modo Venta: "Vender" va primero', () => {
    expect(tos(getNavItems('venta'))).toEqual(['/app/venta', '/app', '/app/productos'])
  })

  it('Modo Gestión: "Vender" va después de "Productos"', () => {
    expect(tos(getNavItems('gestion'))).toEqual(['/app', '/app/productos', '/app/venta'])
  })

  it('"Vender" está siempre, en los dos modos, con su ícono y etiqueta', () => {
    for (const mode of ['venta', 'gestion'] as const) {
      const sell = getNavItems(mode).find((item) => item.to === '/app/venta')
      expect(sell).toMatchObject({ label: 'Vender', icon: '🛒', exact: false })
    }
  })

  it('"Inicio" es exacto (solo activo en /app) y el resto no', () => {
    const items = getNavItems('gestion')
    expect(items.find((i) => i.to === '/app')?.exact).toBe(true)
    expect(items.filter((i) => i.to !== '/app').every((i) => !i.exact)).toBe(true)
  })

  it('la tabla no tiene rutas repetidas', () => {
    expect(new Set(tos(NAV_ITEMS)).size).toBe(NAV_ITEMS.length)
  })
})

describe('getNavItems — punto de extensión (un ítem nuevo es una fila más)', () => {
  const table: NavItemDef[] = [
    { to: '/a', label: 'A', icon: 'a', exact: false, order: { venta: 1, gestion: 1 } },
    { to: '/solo-gestion', label: 'G', icon: 'g', exact: false, modes: ['gestion'], order: { venta: 0, gestion: 2 } },
    { to: '/solo-socios', label: 'S', icon: 's', exact: false, socioOnly: true, order: { venta: 2, gestion: 3 } },
  ]

  it('un ítem con `modes` solo aparece en esos modos', () => {
    expect(tos(getNavItems('venta', { isSocio: true }, table))).not.toContain('/solo-gestion')
    expect(tos(getNavItems('gestion', { isSocio: true }, table))).toContain('/solo-gestion')
  })

  it('un ítem `socioOnly` solo lo ve un socio', () => {
    expect(tos(getNavItems('gestion', { isSocio: false }, table))).not.toContain('/solo-socios')
    expect(tos(getNavItems('gestion', {}, table))).not.toContain('/solo-socios')
    expect(tos(getNavItems('gestion', { isSocio: true }, table))).toContain('/solo-socios')
  })

  it('se ordena por el orden propio de cada modo', () => {
    expect(tos(getNavItems('gestion', { isSocio: true }, table))).toEqual(['/a', '/solo-gestion', '/solo-socios'])
    expect(tos(getNavItems('venta', { isSocio: true }, table))).toEqual(['/a', '/solo-socios'])
  })

})

describe('getNavItems — Reportes (solo socios, solo Modo Gestión)', () => {
  const reports = (mode: 'venta' | 'gestion', isSocio?: boolean) =>
    getNavItems(mode, { isSocio }).find((item) => item.to === '/app/reportes')

  it('un socio en Modo Gestión ve "Reportes" con su ícono, al final del menú', () => {
    expect(reports('gestion', true)).toMatchObject({ label: 'Reportes', icon: '📊', exact: false })
    expect(tos(getNavItems('gestion', { isSocio: true })).at(-1)).toBe('/app/reportes')
  })

  it('un socio en Modo Venta no lo ve', () => {
    expect(reports('venta', true)).toBeUndefined()
  })

  it('un colaborador no lo ve en ningún modo', () => {
    expect(reports('gestion', false)).toBeUndefined()
    expect(reports('venta', false)).toBeUndefined()
    expect(reports('gestion')).toBeUndefined()
  })

  it('no altera el orden de los demás ítems', () => {
    expect(tos(getNavItems('gestion', { isSocio: true }))).toEqual(['/app', '/app/productos', '/app/venta', '/app/reportes'])
    expect(tos(getNavItems('gestion', { isSocio: false }))).toEqual(['/app', '/app/productos', '/app/venta'])
  })
})
