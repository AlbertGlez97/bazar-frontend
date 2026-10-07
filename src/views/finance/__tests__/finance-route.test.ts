import { describe, it, expect } from 'vitest'
import { createAppRouter } from '@/router'
import { createMemoryHistory } from 'vue-router'
import { getNavItems } from '@/layouts/nav-items'
import { FINANCE_TABS } from '../finance-tabs'
describe('finance route and navigation authority', () => {
  it('inherits auth/context and explicitly requires socio and gestion', () => {
    const route = createAppRouter(createMemoryHistory()).resolve(
      '/app/finanzas',
    )
    expect(route.name).toBe('Contributions')
    expect(route.meta).toMatchObject({
      requiresAuth: true,
      requiresContext: true,
      requiresSocio: true,
      requiresGestion: true,
    })
  })
  it('offers Finance only to socios in gestion', () => {
    expect(
      getNavItems('gestion', { isSocio: true }).some(
        (r) => r.to === '/app/finanzas',
      ),
    ).toBe(true)
    expect(
      getNavItems('gestion', { isSocio: false }).some(
        (r) => r.to === '/app/finanzas',
      ),
    ).toBe(false)
    expect(
      getNavItems('venta', { isSocio: true }).some(
        (r) => r.to === '/app/finanzas',
      ),
    ).toBe(false)
  })
  it('serves Gastos at /app/finanzas/gastos with the same socio and gestion guard', () => {
    const router = createAppRouter(createMemoryHistory())
    const route = router.resolve('/app/finanzas/gastos')
    expect(route.name).toBe('Expenses')
    expect(route.meta).toMatchObject({
      requiresAuth: true,
      requiresContext: true,
      requiresSocio: true,
      requiresGestion: true,
    })
    // Contributions keeps its own address.
    expect(router.resolve('/app/finanzas').name).toBe('Contributions')
  })
  it('loads the expenses view lazily', () => {
    const record = createAppRouter(createMemoryHistory())
      .resolve('/app/finanzas/gastos')
      .matched.at(-1)!
    expect(typeof record.components?.default).toBe('function')
  })
  it('serves Jornadas at /app/finanzas/jornadas with the same socio and gestion guard', () => {
    const router = createAppRouter(createMemoryHistory())
    const route = router.resolve('/app/finanzas/jornadas')
    expect(route.name).toBe('WorkShifts')
    expect(route.meta).toMatchObject({
      requiresAuth: true,
      requiresContext: true,
      requiresSocio: true,
      requiresGestion: true,
    })
    // The sibling tabs keep their own addresses.
    expect(router.resolve('/app/finanzas').name).toBe('Contributions')
    expect(router.resolve('/app/finanzas/gastos').name).toBe('Expenses')
  })
  it('loads the work shifts view lazily', () => {
    const record = createAppRouter(createMemoryHistory())
      .resolve('/app/finanzas/jornadas')
      .matched.at(-1)!
    expect(typeof record.components?.default).toBe('function')
  })
  it('serves Resumen at /app/finanzas/resumen with the same socio and gestion guard, lazily', () => {
    const router = createAppRouter(createMemoryHistory())
    const route = router.resolve('/app/finanzas/resumen')
    expect(route.name).toBe('FinanceOverview')
    expect(route.meta).toMatchObject({
      requiresAuth: true,
      requiresContext: true,
      requiresSocio: true,
      requiresGestion: true,
    })
    expect(typeof route.matched.at(-1)?.components?.default).toBe('function')
    // The existing addresses are unchanged: /app/finanzas is still Aportaciones.
    expect(router.resolve('/app/finanzas').name).toBe('Contributions')
    expect(router.resolve('/app/finanzas/gastos').name).toBe('Expenses')
    expect(router.resolve('/app/finanzas/jornadas').name).toBe('WorkShifts')
  })
  it('lists Resumen first, then Aportaciones, Gastos and Jornadas', () => {
    expect(FINANCE_TABS.map((t) => [t.to, t.label])).toEqual([
      ['/app/finanzas/resumen', 'Resumen'],
      ['/app/finanzas', 'Aportaciones'],
      ['/app/finanzas/gastos', 'Gastos'],
      ['/app/finanzas/jornadas', 'Jornadas'],
    ])
  })
  it('keeps the single Finanzas menu item active on every tab', () => {
    const items = getNavItems('gestion', { isSocio: true }).filter((r) =>
      r.to.startsWith('/app/finanzas'),
    )
    expect(items.map((r) => r.to)).toEqual(['/app/finanzas'])
    expect(items[0]?.exact).toBe(false)
  })
})
