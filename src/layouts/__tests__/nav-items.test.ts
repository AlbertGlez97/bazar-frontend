import { describe, expect, it } from 'vitest'
import { NAV_ITEMS, getNavItems, type NavItemDef } from '../nav-items'

const tos = (items: { to: string }[]) => items.map((item) => item.to)

describe('getNavItems', () => {
  it('Modo Venta: solo "Vender"', () => {
    expect(tos(getNavItems('venta'))).toEqual(['/app/venta'])
  })

  it('Modo Venta: ni "Inicio" ni "Productos", para socios y colaboradores', () => {
    for (const isSocio of [true, false, undefined]) {
      const shown = tos(getNavItems('venta', { isSocio }))
      expect(shown).not.toContain('/app')
      expect(shown).not.toContain('/app/productos')
      expect(shown).toEqual(['/app/venta'])
    }
  })

  it('"Inicio" solo existe en Modo Gestión', () => {
    const home = NAV_ITEMS.find((item) => item.to === '/app')
    expect(home?.modes).toEqual(['gestion'])
  })

  it('Modo Gestión: Inicio y Productos, sin "Vender"', () => {
    expect(tos(getNavItems('gestion'))).toEqual(['/app', '/app/productos'])
  })

  it('"Vender" existe solo en Modo Venta, con su ícono y etiqueta', () => {
    expect(getNavItems('venta').find((item) => item.to === '/app/venta')).toMatchObject({ label: 'Vender', icon: '🛒', exact: false })
    expect(getNavItems('gestion').find((item) => item.to === '/app/venta')).toBeUndefined()
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

  it('un socio en Modo Gestión ve "Reportes" con su ícono, antes de Códigos QR', () => {
    expect(reports('gestion', true)).toMatchObject({ label: 'Reportes', icon: '📊', exact: false })
    const items = tos(getNavItems('gestion', { isSocio: true }))
    expect(items.indexOf('/app/reportes')).toBeLessThan(items.indexOf('/app/codigos-qr'))
  })

  it('un socio en Modo Venta no lo ve', () => {
    expect(reports('venta', true)).toBeUndefined()
  })

  it('un colaborador no lo ve en ningún modo', () => {
    expect(reports('gestion', false)).toBeUndefined()
    expect(reports('venta', false)).toBeUndefined()
    expect(reports('gestion')).toBeUndefined()
  })
})

describe('getNavItems — Códigos QR (solo socios, solo Modo Gestión, D2)', () => {
  const codigosQr = (mode: 'venta' | 'gestion', isSocio?: boolean) =>
    getNavItems(mode, { isSocio }).find((item) => item.to === '/app/codigos-qr')

  it('un socio en Modo Gestión ve "Códigos QR" con su ícono, antes de Incidencias (P2)', () => {
    expect(codigosQr('gestion', true)).toMatchObject({ label: 'Códigos QR', icon: '🏷️', exact: false })
    const items = tos(getNavItems('gestion', { isSocio: true }))
    expect(items.indexOf('/app/codigos-qr')).toBeLessThan(items.indexOf('/app/incidencias'))
  })

  it('un socio en Modo Venta no lo ve', () => {
    expect(codigosQr('venta', true)).toBeUndefined()
  })

  it('un colaborador no lo ve en ningún modo', () => {
    expect(codigosQr('gestion', false)).toBeUndefined()
    expect(codigosQr('venta', false)).toBeUndefined()
    expect(codigosQr('gestion')).toBeUndefined()
  })

  it('no altera el orden de los demás ítems', () => {
    expect(tos(getNavItems('gestion', { isSocio: true })))
      .toEqual(['/app', '/app/productos', '/app/reportes', '/app/codigos-qr', '/app/incidencias', '/app/deudas'])
    expect(tos(getNavItems('gestion', { isSocio: false }))).toEqual(['/app', '/app/productos'])
  })
})

describe('getNavItems — Incidencias (solo socios, solo Modo Gestión, P2)', () => {
  const incidencias = (mode: 'venta' | 'gestion', isSocio?: boolean) =>
    getNavItems(mode, { isSocio }).find((item) => item.to === '/app/incidencias')

  it('un socio en Modo Gestión ve "Incidencias" con su ícono', () => {
    expect(incidencias('gestion', true)).toMatchObject({ label: 'Incidencias', exact: false })
  })

  it('un socio en Modo Venta no lo ve', () => {
    expect(incidencias('venta', true)).toBeUndefined()
  })

  it('un colaborador no lo ve en ningún modo', () => {
    expect(incidencias('gestion', false)).toBeUndefined()
    expect(incidencias('venta', false)).toBeUndefined()
    expect(incidencias('gestion')).toBeUndefined()
  })

  it('va después de Códigos QR', () => {
    const items = tos(getNavItems('gestion', { isSocio: true }))
    expect(items.indexOf('/app/codigos-qr')).toBeLessThan(items.indexOf('/app/incidencias'))
  })
})

describe('getNavItems — Deudas (solo socios, solo Modo Gestión)', () => {
  const deudas = (mode: 'venta' | 'gestion', isSocio?: boolean) =>
    getNavItems(mode, { isSocio }).find((item) => item.to === '/app/deudas')

  it('un socio en Modo Gestión ve "Deudas" con su ícono, al final del menú', () => {
    expect(deudas('gestion', true)).toMatchObject({ label: 'Deudas', exact: false })
    expect(tos(getNavItems('gestion', { isSocio: true })).at(-1)).toBe('/app/deudas')
  })

  it('un socio en Modo Venta no lo ve', () => {
    expect(deudas('venta', true)).toBeUndefined()
  })

  it('un colaborador no lo ve en ningún modo', () => {
    expect(deudas('gestion', false)).toBeUndefined()
    expect(deudas('venta', false)).toBeUndefined()
    expect(deudas('gestion')).toBeUndefined()
  })

  it('va después de Incidencias', () => {
    const items = tos(getNavItems('gestion', { isSocio: true }))
    expect(items.indexOf('/app/incidencias')).toBeLessThan(items.indexOf('/app/deudas'))
  })
})
