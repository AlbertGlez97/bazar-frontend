import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { HELP_ROUTE_CONTEXT, helpTargetForRoute } from '../help-route-context'
import { resolveHelpTarget } from '../help-structure'

/** Named routes of the authenticated shell, read from the router source. */
function appRouteNames(): string[] {
  const source = readFileSync('src/router/index.ts', 'utf8')
  const start = source.indexOf("path: '/app'")
  const end = source.indexOf('pathMatch')
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  return [...source.slice(start, end).matchAll(/name: '(\w+)'/g)].map((match) => match[1]!)
}

describe('help route context', () => {
  it('maps every named /app route, so a new route without a mapping fails here', () => {
    const names = appRouteNames()
    expect(names.length).toBeGreaterThan(15)
    for (const name of names) expect(Object.keys(HELP_ROUTE_CONTEXT), name).toContain(name)
  })

  it('resolves every mapping to an existing target, except Help', () => {
    for (const [name, id] of Object.entries(HELP_ROUTE_CONTEXT)) {
      if (id === null) continue
      expect(resolveHelpTarget(id), `${name} -> ${id}`).not.toBeNull()
      expect(helpTargetForRoute(name), name).toEqual(resolveHelpTarget(id))
    }
  })

  it('has no mapping for routes that do not exist', () => {
    const names = appRouteNames()
    for (const name of Object.keys(HELP_ROUTE_CONTEXT)) expect(names, name).toContain(name)
  })

  it('maps the finance routes to their own topic', () => {
    expect(HELP_ROUTE_CONTEXT).toMatchObject({
      Contributions: 'finanzas.aportaciones',
      FinanceOverview: 'finanzas.resumen',
      Expenses: 'finanzas.gastos',
      WorkShifts: 'finanzas.jornadas',
      FinanceReserves: 'finanzas.reservas',
      FinanceSimulator: 'finanzas.simulador',
      FinanceAgreements: 'finanzas.acuerdos',
      FinanceAgreementDetail: 'finanzas.acuerdos',
    })
    expect(helpTargetForRoute('WorkShifts')).toEqual({ categoryId: 'finanzas', topicId: 'finanzas.jornadas' })
  })

  it('maps the operational and settings routes', () => {
    expect(HELP_ROUTE_CONTEXT).toMatchObject({
      AppHome: 'primeros-pasos',
      Sale: 'ventas.efectivo',
      ProductCatalog: 'productos',
      CodigosQr: 'productos.etiquetas-qr',
      Deudas: 'deudas',
      Reports: 'administracion.reportes',
      Incidencias: 'administracion.incidencias',
      ChangePassword: 'dispositivos-sesion.contrasena',
      Team: 'dispositivos-sesion.equipo',
      DevicesAdmin: 'dispositivos-sesion.dispositivos',
    })
    expect(helpTargetForRoute('Settings')?.categoryId).toBe('dispositivos-sesion')
  })

  it('has no contextual target for the help route itself', () => {
    expect(HELP_ROUTE_CONTEXT.Help).toBeNull()
    expect(helpTargetForRoute('Help')).toBeNull()
    expect(helpTargetForRoute(undefined, '/app/ayuda')).toBeNull()
    expect(helpTargetForRoute(undefined, '/app/ayuda?topic=ventas')).toBeNull()
  })

  it('falls back to Primeros pasos for an unknown or missing route', () => {
    const fallback = { categoryId: 'primeros-pasos' }
    expect(helpTargetForRoute('Mystery')).toEqual(fallback)
    expect(helpTargetForRoute(undefined)).toEqual(fallback)
    expect(helpTargetForRoute(undefined, '/app/otra')).toEqual(fallback)
    expect(helpTargetForRoute('__proto__')).toEqual(fallback)
    expect(helpTargetForRoute('constructor')).toEqual(fallback)
  })
})
