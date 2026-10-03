import { describe, it, expect } from 'vitest'
import { createAppRouter } from '@/router'
import { createMemoryHistory } from 'vue-router'
import { getNavItems } from '@/layouts/nav-items'
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
})
