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

  it('no incluye por sí mismo ningún ítem de Reportes (lo agrega otro cambio)', () => {
    expect(tos(NAV_ITEMS).some((to) => to.includes('reportes'))).toBe(false)
  })
})
