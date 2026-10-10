import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { HELP_RETURN_ROUTES, isHelpFromShape, safeHelpReturnTarget } from '../help-return'

const stub = { template: '<div />' }
const gated = { requiresSocio: true, requiresGestion: true }
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/app', name: 'AppHome', component: stub },
    { path: '/app/venta', name: 'Sale', component: stub },
    { path: '/app/productos', name: 'ProductCatalog', component: stub },
    { path: '/app/ayuda', name: 'Help', component: stub },
    { path: '/app/reportes', name: 'Reports', component: stub, meta: gated },
    { path: '/app/finanzas', name: 'Contributions', component: stub, meta: gated },
    { path: '/app/finanzas/resumen', name: 'FinanceOverview', component: stub, meta: gated },
    { path: '/app/finanzas/gastos', name: 'Expenses', component: stub, meta: gated },
    { path: '/app/finanzas/jornadas', name: 'WorkShifts', component: stub, meta: gated },
    { path: '/app/finanzas/reservas', name: 'FinanceReserves', component: stub, meta: gated },
    { path: '/app/finanzas/simulador', name: 'FinanceSimulator', component: stub, meta: gated },
    { path: '/app/finanzas/acuerdos', name: 'FinanceAgreements', component: stub, meta: gated },
    { path: '/app/finanzas/acuerdos/:id', name: 'FinanceAgreementDetail', component: stub, meta: gated },
  ],
})
const socioGestion = { router, isSocio: true, mode: 'gestion' as const }
const colabVenta = { router, isSocio: false, mode: 'venta' as const }

describe('safeHelpReturnTarget', () => {
  it('returns a known local route as its full path', () => {
    expect(safeHelpReturnTarget('/app/productos', colabVenta)).toBe('/app/productos')
    expect(safeHelpReturnTarget('/app/productos?q=1', colabVenta)).toBe('/app/productos?q=1')
  })

  it.each([
    'https://example.org', '//example.org', '/login', '/app/ayuda', '/app/ayuda?from=/app/ayuda',
    '/app/../login', '/app/missing', '/app/reportes', 'app/productos', '', '   ',
    '/app\\evil', '/app/productos\r\nLocation: x', '/appx', 'javascript:alert(1)', '/app/%2e%2e/login',
  ])('uses the mode fallback for hostile or unknown %j', (from) => {
    expect(safeHelpReturnTarget(from, colabVenta)).toEqual({ name: 'Sale' })
    expect(safeHelpReturnTarget(from, { router, isSocio: false, mode: 'gestion' })).toEqual({ name: 'AppHome' })
  })

  it.each([undefined, null, 42, {}, ['/app/productos'], true])('ignores non-string input %j', (from) => {
    expect(safeHelpReturnTarget(from, colabVenta)).toEqual({ name: 'Sale' })
  })

  it('rejects absurdly long hints', () => {
    expect(safeHelpReturnTarget(`/app/productos?${'a'.repeat(3000)}`, colabVenta)).toEqual({ name: 'Sale' })
  })

  it('enforces the socio and gestion requirements', () => {
    expect(safeHelpReturnTarget('/app/reportes', socioGestion)).toBe('/app/reportes')
    expect(safeHelpReturnTarget('/app/reportes', { router, isSocio: false, mode: 'gestion' })).toEqual({ name: 'AppHome' })
    expect(safeHelpReturnTarget('/app/reportes', { router, isSocio: true, mode: 'venta' })).toEqual({ name: 'Sale' })
  })

  it.each([
    '/app/finanzas', '/app/finanzas/resumen', '/app/finanzas/gastos', '/app/finanzas/jornadas',
    '/app/finanzas/reservas', '/app/finanzas/simulador', '/app/finanzas/acuerdos', '/app/finanzas/acuerdos/abc-123',
  ])('lets a socio in Gestión return to the finance route %s', (from) => {
    expect(safeHelpReturnTarget(from, socioGestion)).toBe(from)
    expect(safeHelpReturnTarget(from, { router, isSocio: false, mode: 'gestion' })).toEqual({ name: 'AppHome' })
    expect(safeHelpReturnTarget(from, { router, isSocio: true, mode: 'venta' })).toEqual({ name: 'Sale' })
  })

  it('whitelists the finance route names', () => {
    for (const name of ['Contributions', 'FinanceOverview', 'Expenses', 'WorkShifts', 'FinanceReserves', 'FinanceSimulator', 'FinanceAgreements', 'FinanceAgreementDetail'])
      expect(HELP_RETURN_ROUTES).toContain(name)
    expect(HELP_RETURN_ROUTES).not.toContain('Help')
  })
})

describe('isHelpFromShape', () => {
  it('accepts only short local /app paths', () => {
    expect(isHelpFromShape('/app')).toBe(true)
    expect(isHelpFromShape('/app/finanzas?x=1')).toBe(true)
    for (const value of ['//app', '/appx', 'https://a', '/app\\x', '/app/\u0000', 'x', '', 3, null]) expect(isHelpFromShape(value), String(value)).toBe(false)
  })
})
