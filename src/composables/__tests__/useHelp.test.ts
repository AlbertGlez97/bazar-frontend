import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import {
  closeHelpDrawer,
  drawerTarget,
  helpDrawerOpen,
  helpLocation,
  openHelpDrawer,
  parseHelpQuery,
  useHelp,
} from '../useHelp'

describe('parseHelpQuery', () => {
  it('reads an empty query as no target', () => {
    expect(parseHelpQuery({})).toEqual({ target: null, from: undefined, q: '' })
  })

  it('reads a topic, with or without its article', () => {
    expect(parseHelpQuery({ topic: 'finanzas.jornadas' }).target).toEqual({ categoryId: 'finanzas', topicId: 'finanzas.jornadas' })
    expect(parseHelpQuery({ topic: 'finanzas.jornadas', article: 'jornadas-preguntas' }).target)
      .toEqual({ categoryId: 'finanzas', topicId: 'finanzas.jornadas', articleId: 'jornadas-preguntas' })
  })

  it('reads a category on its own', () => {
    expect(parseHelpQuery({ topic: 'finanzas' }).target).toEqual({ categoryId: 'finanzas' })
  })

  it('derives the topic from a valid article alone', () => {
    expect(parseHelpQuery({ article: 'jornadas' }).target)
      .toEqual({ categoryId: 'finanzas', topicId: 'finanzas.jornadas', articleId: 'jornadas' })
  })

  it('drops an article that does not belong to the topic and degrades unknown ids', () => {
    expect(parseHelpQuery({ topic: 'finanzas.gastos', article: 'jornadas' }).target)
      .toEqual({ categoryId: 'finanzas', topicId: 'finanzas.gastos' })
    expect(parseHelpQuery({ topic: 'finanzas', article: 'efectivo' }).target).toEqual({ categoryId: 'finanzas' })
    expect(parseHelpQuery({ topic: 'no-existe' }).target).toBeNull()
    expect(parseHelpQuery({ topic: 'no-existe', article: 'jornadas' }).target?.articleId).toBe('jornadas')
    expect(parseHelpQuery({ article: 'no-existe' }).target).toBeNull()
    expect(parseHelpQuery({ topic: '__proto__', article: 'constructor' }).target).toBeNull()
  })

  it('accepts a category-level article and a three-part topic path', () => {
    expect(parseHelpQuery({ topic: 'finanzas', article: 'jornadas' }).target)
      .toEqual({ categoryId: 'finanzas', topicId: 'finanzas.jornadas', articleId: 'jornadas' })
    expect(parseHelpQuery({ topic: 'finanzas.jornadas.corregir' }).target?.articleId).toBe('jornadas')
    expect(parseHelpQuery({ topic: 'finanzas.jornadas.corregir', article: 'jornadas-preguntas' }).target?.articleId).toBe('jornadas-preguntas')
  })

  it('uses the first value of repeated params and ignores non-strings', () => {
    expect(parseHelpQuery({ topic: ['finanzas.gastos', 'ventas'] }).target?.topicId).toBe('finanzas.gastos')
    expect(parseHelpQuery({ topic: [null], article: null }).target).toBeNull()
  })

  it('sanitizes from and q', () => {
    expect(parseHelpQuery({ from: '/app/finanzas/jornadas' }).from).toBe('/app/finanzas/jornadas')
    for (const from of ['https://evil.example', '//evil.example', '/login', '/app\\x', 'javascript:1', ' /app/venta'])
      expect(parseHelpQuery({ from }).from, from).toBeUndefined()
    expect(parseHelpQuery({ from: ['/app/venta', 'x'] }).from).toBe('/app/venta')
    expect(parseHelpQuery({ q: '  billetes   ' }).q).toBe('billetes')
    expect(parseHelpQuery({ q: 'x'.repeat(500) }).q).toHaveLength(100)
  })
})

describe('helpLocation', () => {
  const query = (location: ReturnType<typeof helpLocation>) => (location as { query: Record<string, string> }).query

  it('targets the Help route', () => {
    expect(helpLocation(null, {})).toEqual({ name: 'Help', query: {} })
  })

  it('serializes topic, article, from and q', () => {
    expect(helpLocation({ categoryId: 'finanzas', topicId: 'finanzas.jornadas', articleId: 'jornadas' }, { from: '/app/finanzas/jornadas', q: 'corregir' }))
      .toEqual({ name: 'Help', query: { topic: 'finanzas.jornadas', article: 'jornadas', from: '/app/finanzas/jornadas', q: 'corregir' } })
    expect(query(helpLocation({ categoryId: 'finanzas' }, {}))).toEqual({ topic: 'finanzas' })
  })

  it('accepts an id or path and resolves it', () => {
    expect(query(helpLocation('finanzas.jornadas.corregir', {}))).toEqual({ topic: 'finanzas.jornadas', article: 'jornadas' })
    expect(query(helpLocation('jornadas', {}))).toEqual({ topic: 'finanzas.jornadas', article: 'jornadas' })
    expect(query(helpLocation('no-existe', {}))).toEqual({})
  })

  it('drops an unsafe from', () => {
    expect(query(helpLocation('ventas', { from: 'https://evil.example' }))).toEqual({ topic: 'ventas' })
    expect(query(helpLocation('ventas', { from: '/login' }))).toEqual({ topic: 'ventas' })
  })

  it('round-trips through parseHelpQuery', () => {
    for (const id of ['ventas', 'ventas.efectivo', 'jornadas', 'finanzas.gastos.corregir', 'deudas']) {
      const parsed = parseHelpQuery(query(helpLocation(id, { from: '/app/venta', q: 'x' })))
      expect(parsed.target, id).not.toBeNull()
      expect(parsed.from).toBe('/app/venta')
      expect(parsed.q).toBe('x')
      expect(parseHelpQuery(query(helpLocation(parsed.target, {}))).target).toEqual(parsed.target)
    }
  })
})

describe('useHelp', () => {
  const stub = { template: '<div />' }

  async function setup(initial: string) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/app/finanzas/jornadas', name: 'WorkShifts', component: stub },
        { path: '/app/venta', name: 'Sale', component: stub },
        { path: '/app/mystery', name: 'Mystery', component: stub },
        { path: '/login', name: 'Login', component: stub },
        { path: '/app/ayuda', name: 'Help', component: stub },
      ],
    })
    await router.push(initial)
    await router.isReady()
    let api!: ReturnType<typeof useHelp>
    const Host = defineComponent({ setup() { api = useHelp(); return () => null } })
    mount(Host, { global: { plugins: [router] } })
    return { router, api }
  }

  beforeEach(() => { closeHelpDrawer(); drawerTarget.value = null })
  afterEach(() => { closeHelpDrawer(); drawerTarget.value = null })

  it('opens the Center on a topic and keeps a safe return hint', async () => {
    const { router, api } = await setup('/app/venta')
    await api.openHelp('finanzas.jornadas')
    expect(router.currentRoute.value.name).toBe('Help')
    expect(router.currentRoute.value.query).toEqual({ topic: 'finanzas.jornadas', from: '/app/venta' })
  })

  it('resolves a three-part path to its topic and preselects the article by slug', async () => {
    const { router, api } = await setup('/app/venta')
    await api.openHelp('finanzas.jornadas.corregir')
    expect(router.currentRoute.value.query.topic).toBe('finanzas.jornadas')
    expect(router.currentRoute.value.query.article).toBe('jornadas')
    await api.openHelp('finanzas.jornadas.no-existe')
    expect(router.currentRoute.value.query.topic).toBe('finanzas.jornadas')
    expect(router.currentRoute.value.query.article).toBeUndefined()
  })

  it('accepts a resolved target object', async () => {
    const { router, api } = await setup('/app/venta')
    await api.openHelp({ categoryId: 'finanzas', topicId: 'finanzas.gastos' })
    expect(router.currentRoute.value.query).toMatchObject({ topic: 'finanzas.gastos' })
  })

  it('without an argument opens the topic of the current route', async () => {
    const { router, api } = await setup('/app/finanzas/jornadas')
    await api.openHelp()
    expect(router.currentRoute.value.query).toMatchObject({ topic: 'finanzas.jornadas', from: '/app/finanzas/jornadas' })
  })

  it('degrades an unknown id to the Center home', async () => {
    const { router, api } = await setup('/app/venta')
    await api.openHelp('no-existe')
    expect(router.currentRoute.value.name).toBe('Help')
    expect(router.currentRoute.value.query.topic).toBeUndefined()
    expect(router.currentRoute.value.query.from).toBe('/app/venta')
  })

  it('does not forward a return hint outside /app and preserves the existing one on Help', async () => {
    const outside = await setup('/login')
    await outside.api.openHelp('ventas')
    expect(outside.router.currentRoute.value.query.from).toBeUndefined()
    const onHelp = await setup('/app/ayuda?topic=ventas&from=/app/venta')
    await onHelp.api.openHelp('finanzas.gastos')
    expect(onHelp.router.currentRoute.value.query).toMatchObject({ topic: 'finanzas.gastos', from: '/app/venta' })
  })

  it('opens and closes the drawer with the target of the current route', async () => {
    const { router, api } = await setup('/app/finanzas/jornadas')
    expect(helpDrawerOpen.value).toBe(false)
    expect(api.openHelpDrawer()).toBe(true)
    expect(helpDrawerOpen.value).toBe(true)
    expect(drawerTarget.value).toEqual({ categoryId: 'finanzas', topicId: 'finanzas.jornadas' })
    api.closeHelpDrawer()
    expect(helpDrawerOpen.value).toBe(false)
    await router.push('/app/venta')
    api.openHelpDrawer()
    expect(drawerTarget.value).toMatchObject({ categoryId: 'ventas' })
    expect(api.helpDrawerOpen).toBe(helpDrawerOpen)
    expect(api.drawerTarget).toBe(drawerTarget)
  })

  it('opens the drawer on an explicit target and on the default for an unknown route', async () => {
    const { router, api } = await setup('/app/venta')
    openHelpDrawer('finanzas.jornadas.corregir')
    expect(drawerTarget.value).toEqual({ categoryId: 'finanzas', topicId: 'finanzas.jornadas', articleId: 'jornadas' })
    openHelpDrawer('no-existe')
    expect(drawerTarget.value).toEqual({ categoryId: 'primeros-pasos' })
    await router.push('/app/mystery')
    closeHelpDrawer()
    api.openHelpDrawer()
    expect(drawerTarget.value).toEqual({ categoryId: 'primeros-pasos' })
  })

  it('does not open a drawer on the Help page itself', async () => {
    const { api } = await setup('/app/ayuda')
    expect(api.openHelpDrawer()).toBe(false)
    expect(helpDrawerOpen.value).toBe(false)
  })

  it('does not open a drawer on an explicit id while on the Help page either', async () => {
    await setup('/app/ayuda')
    expect(openHelpDrawer('finanzas.jornadas.corregir')).toBe(false)
    expect(helpDrawerOpen.value).toBe(false)
    expect(drawerTarget.value).toBeNull()
  })

  it('opens an unknown explicit id on Primeros pasos and reports success', async () => {
    await setup('/app/venta')
    expect(openHelpDrawer('no-existe')).toBe(true)
    expect(helpDrawerOpen.value).toBe(true)
    expect(drawerTarget.value).toEqual({ categoryId: 'primeros-pasos' })
  })

  it('works before any useHelp() call: explicit ids resolve and the default is Primeros pasos', async () => {
    vi.resetModules()
    const fresh = await import('../useHelp')
    expect(fresh.helpDrawerOpen.value).toBe(false)
    expect(fresh.openHelpDrawer('finanzas.jornadas.corregir')).toBe(true)
    expect(fresh.drawerTarget.value).toEqual({ categoryId: 'finanzas', topicId: 'finanzas.jornadas', articleId: 'jornadas' })
    fresh.closeHelpDrawer()
    // No route has been bound yet, so the argument-less call falls back to the default help.
    expect(fresh.openHelpDrawer()).toBe(true)
    expect(fresh.drawerTarget.value).toEqual({ categoryId: 'primeros-pasos' })
  })

  it('exposes the current route target', async () => {
    const { router, api } = await setup('/app/venta')
    expect(api.currentRouteTarget.value).toMatchObject({ categoryId: 'ventas' })
    await router.push('/app/finanzas/jornadas')
    await flushPromises()
    expect(api.currentRouteTarget.value?.topicId).toBe('finanzas.jornadas')
  })
})
