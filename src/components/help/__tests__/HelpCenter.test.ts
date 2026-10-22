import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { HELP_ARTICLES } from '@/config/help-content'
import { HELP_TOPICS } from '@/config/help-structure'
import { helpLocation } from '@/composables/useHelp'
import { openHelp, renderedArticleIds } from './helpTestUtils'

afterEach(() => { document.body.innerHTML = '' })

type Wrapper = VueWrapper<unknown>
const sidebar = (wrapper: Wrapper) => wrapper.find('nav[aria-label="Temas de ayuda"]')
async function click(wrapper: Wrapper, selector: string, text: string) {
  const link = wrapper.findAll(selector).find((item) => item.text().includes(text))
  if (!link) throw new Error(`No element "${selector}" with text "${text}"`)
  await link.trigger('click')
  await flushPromises()
}
const heading = () => document.querySelector<HTMLElement>('[data-help-heading]')
const idsOfTopic = (topicId: string) => HELP_TOPICS.find((topic) => topic.id === topicId)!.articleIds

describe('Help Center: navigation replaces the content', () => {
  it('starts on a home with a short welcome and every category, and renders no article', async () => {
    const { wrapper } = await openHelp()
    expect(wrapper.get('h1').text()).toContain('Ayuda')
    expect(wrapper.text()).toContain('¿En qué te ayudamos?')
    expect(renderedArticleIds()).toEqual([])
    const main = wrapper.get('.help-center__main')
    ;['Primeros pasos', 'Ventas', 'Productos', 'Deudas', 'Finanzas', 'Administración', 'Dispositivos y sesión', 'Sin conexión']
      .forEach((title) => expect(main.text()).toContain(title))
    wrapper.unmount()
  })

  it('selecting a category shows its topics and updates the URL', async () => {
    const { wrapper, router } = await openHelp()
    await click(wrapper, '.help-sidebar__category', 'Finanzas')
    expect(router.currentRoute.value.query.topic).toBe('finanzas')
    const main = wrapper.get('.help-center__main')
    expect(main.get('h2').text()).toBe('Finanzas')
    ;['Resumen', 'Aportaciones', 'Gastos', 'Jornadas', 'Reservas', 'Simulador', 'Acuerdos', 'Pagos']
      .forEach((title) => expect(main.text()).toContain(title))
    expect(renderedArticleIds()).toEqual([])
    wrapper.unmount()
  })

  it('selecting Jornadas then Gastos replaces the content: the other topic articles leave the DOM', async () => {
    const { wrapper, router } = await openHelp({ query: { topic: 'finanzas' } })
    await click(wrapper, '.help-sidebar__topic', 'Jornadas')
    expect(router.currentRoute.value.query.topic).toBe('finanzas.jornadas')
    expect(renderedArticleIds().sort()).toEqual([...idsOfTopic('finanzas.jornadas')].sort())

    await click(wrapper, '.help-sidebar__topic', 'Gastos')
    expect(router.currentRoute.value.query.topic).toBe('finanzas.gastos')
    expect(renderedArticleIds().sort()).toEqual([...idsOfTopic('finanzas.gastos')].sort())
    idsOfTopic('finanzas.jornadas').forEach((id) => expect(document.getElementById(id)).toBeNull())
    expect(wrapper.get('.help-center__main h2').text()).toBe('Gastos')
    wrapper.unmount()
  })

  it('does not depend on the hash or on anchors', async () => {
    const { wrapper, router } = await openHelp({ query: { topic: 'finanzas.jornadas' } })
    wrapper.findAll('a').forEach((link) => expect(link.attributes('href') ?? '').not.toContain('#'))
    await click(wrapper, '.help-sidebar__topic', 'Gastos')
    expect(router.currentRoute.value.hash).toBe('')
    wrapper.unmount()
  })

  it('restores a deep link with the requested article expanded and the others collapsed', async () => {
    const { wrapper } = await openHelp({ query: { topic: 'finanzas.jornadas', article: 'jornadas-preguntas' } })
    expect(wrapper.get('[data-item-id="jornadas-preguntas"]').attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('[data-item-id="jornadas"]').attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('expands the first article when no article is requested', async () => {
    const { wrapper } = await openHelp({ query: { topic: 'finanzas.jornadas' } })
    const [first, second] = idsOfTopic('finanzas.jornadas')
    expect(wrapper.get(`[data-item-id="${first}"]`).attributes('aria-expanded')).toBe('true')
    expect(wrapper.get(`[data-item-id="${second}"]`).attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('resolves the three-part path used by openHelp (finanzas.jornadas.corregir)', async () => {
    const { wrapper } = await openHelp({ query: { topic: 'finanzas.jornadas.corregir' } })
    expect(wrapper.get('[data-item-id="jornadas"]').attributes('aria-expanded')).toBe('true')
    wrapper.unmount()
  })

  it('renders a topic with a single article expanded, without an accordion shell', async () => {
    const { wrapper } = await openHelp({ query: { topic: 'ventas.efectivo' } })
    expect(wrapper.find('[aria-expanded]').exists()).toBe(false)
    expect(wrapper.get('article#efectivo h3').text()).toContain('Cobrar una venta')
    wrapper.unmount()
  })

  it('degrades an unknown topic to the home view instead of failing', async () => {
    const { wrapper } = await openHelp({ query: { topic: 'no-existe', article: 'tampoco' } })
    expect(wrapper.text()).toContain('¿En qué te ayudamos?')
    expect(renderedArticleIds()).toEqual([])
    wrapper.unmount()
  })

  it('keeps the selection after a reload (mounting again with the same URL)', async () => {
    const first = await openHelp({ query: { topic: 'finanzas.gastos', article: 'corregir-gasto' } })
    const { query } = first.router.currentRoute.value
    first.wrapper.unmount()
    const second = await openHelp({ query: query as Record<string, string> })
    expect(second.wrapper.get('.help-center__main h2').text()).toBe('Gastos')
    expect(second.wrapper.get('[data-item-id="corregir-gasto"]').attributes('aria-expanded')).toBe('true')
    second.wrapper.unmount()
  })

  it('supports browser back and forward between topics', async () => {
    const { wrapper, router } = await openHelp({ query: { topic: 'finanzas.jornadas' } })
    await click(wrapper, '.help-sidebar__topic', 'Gastos')
    router.back()
    await flushPromises()
    expect(wrapper.get('.help-center__main h2').text()).toBe('Jornadas')
    router.forward()
    await flushPromises()
    expect(wrapper.get('.help-center__main h2').text()).toBe('Gastos')
    wrapper.unmount()
  })

  it('moves focus to the new content heading after a navigation', async () => {
    const { wrapper } = await openHelp({ query: { topic: 'finanzas' } })
    await click(wrapper, '.help-sidebar__topic', 'Reservas')
    expect(document.activeElement).toBe(heading())
    expect(heading()?.textContent).toContain('Reservas')
    wrapper.unmount()
  })

  it('focuses the requested article when arriving by deep link', async () => {
    const { wrapper } = await openHelp({ query: { topic: 'finanzas.jornadas', article: 'jornadas-preguntas' } })
    expect(document.activeElement?.getAttribute('data-item-id')).toBe('jornadas-preguntas')
    wrapper.unmount()
  })
})

describe('Help Center: breadcrumb and sidebar semantics', () => {
  it('shows Ayuda › Finanzas › Jornadas with aria-current on the last item only', async () => {
    const { wrapper, router } = await openHelp({ query: { topic: 'finanzas.jornadas', from: '/app/productos' } })
    const nav = wrapper.get('nav[aria-label="Ruta de ayuda"]')
    const items = nav.findAll('ol > li')
    expect(items.map((item) => item.text())).toEqual(['Ayuda', 'Finanzas', 'Jornadas'])
    expect(nav.findAll('[aria-current]')).toHaveLength(1)
    expect(items[2]!.get('[aria-current="page"]').text()).toBe('Jornadas')
    await items[1]!.get('a').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toMatchObject({ topic: 'finanzas', from: '/app/productos' })
    wrapper.unmount()
  })

  it('collapses a topic that repeats its category into one crumb', async () => {
    const { wrapper } = await openHelp({ query: { topic: 'deudas' } })
    expect(wrapper.findAll('nav[aria-label="Ruta de ayuda"] li').map((item) => item.text())).toEqual(['Ayuda', 'Deudas'])
    wrapper.unmount()
  })

  it('names the sidebar landmark, expands only the selected category and marks the active topic', async () => {
    const { wrapper } = await openHelp({ query: { topic: 'finanzas.jornadas' } })
    const nav = sidebar(wrapper)
    expect(nav.exists()).toBe(true)
    const topics = nav.findAll('.help-sidebar__topic')
    expect(topics.map((topic) => topic.text())).toContain('Jornadas')
    expect(topics).toHaveLength(8)
    expect(nav.findAll('[aria-current="page"]').map((item) => item.text())).toEqual(['Jornadas'])
    expect(nav.text()).not.toContain('Catálogo')
    wrapper.unmount()
  })

  it('marks the category as current when only a category is selected', async () => {
    const { wrapper } = await openHelp({ query: { topic: 'ventas' } })
    expect(sidebar(wrapper).findAll('[aria-current="page"]').map((item) => item.text())).toEqual(['Ventas'])
    wrapper.unmount()
  })

  it('never marks ordinary links as the current page (the Center is a single route)', async () => {
    const { wrapper } = await openHelp()
    expect(wrapper.findAll('[aria-current]')).toHaveLength(0)
    await wrapper.get('input[type="search"]').setValue('abonos')
    await flushPromises()
    expect(wrapper.findAll('[aria-current]')).toHaveLength(0)
    wrapper.unmount()
  })

  it('uses real links and buttons only', async () => {
    const { wrapper } = await openHelp({ query: { topic: 'finanzas.jornadas' } })
    expect(wrapper.findAll('[role="button"]')).toHaveLength(0)
    wrapper.findAll('a').forEach((link) => expect(link.attributes('href')).toBeTruthy())
    wrapper.unmount()
  })
})

describe('Help Center: return to the previous screen', () => {
  it('returns to a known app screen without mode changes or history loops', async () => {
    const { wrapper, router, pinia } = await openHelp({ query: { from: '/app/productos' } })
    await wrapper.get('[data-action="return"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('ProductCatalog')
    const { useUiModeStore } = await import('@/stores/uiMode.store')
    expect(useUiModeStore(pinia).currentMode).toBe('venta')
    wrapper.unmount()
  })

  it.each(['https://example.org', '//example.org', '/login', '/app/ayuda', '/app/ayuda?from=/app/ayuda', '/app/../login', '/app/missing', '/app/reportes'])(
    'uses a safe mode fallback for %s',
    async (from) => {
      const { wrapper, router } = await openHelp({ query: { from } })
      await wrapper.get('[data-action="return"]').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.name).toBe('Sale')
      wrapper.unmount()
    },
  )

  it('carries the return hint through every navigation inside the Center', async () => {
    const { wrapper, router } = await openHelp({ query: { from: '/app/productos' } })
    await click(wrapper, '.help-sidebar__category', 'Finanzas')
    await click(wrapper, '.help-sidebar__topic', 'Jornadas')
    expect(router.currentRoute.value.query.from).toBe('/app/productos')
    await wrapper.get('[data-action="return"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('ProductCatalog')
    wrapper.unmount()
  })

  it('can return to a finance screen opened from the drawer', async () => {
    const { wrapper, router } = await openHelp({ query: { topic: 'finanzas.jornadas', from: '/app/finanzas/jornadas' } })
    await wrapper.get('[data-action="return"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('WorkShifts')
    wrapper.unmount()
  })
})

describe('Help Center: search', () => {
  async function search(wrapper: Wrapper, text: string) {
    await wrapper.get('input[type="search"]').setValue(text)
    await flushPromises()
  }

  it('labels the search field and keeps the query in the URL', async () => {
    const { wrapper, router } = await openHelp()
    const input = wrapper.get('input[type="search"]')
    expect(wrapper.get(`label[for="${input.attributes('id')}"]`).text()).toBe('Buscar en la ayuda')
    await search(wrapper, 'corregir jornada')
    expect(router.currentRoute.value.query.q).toBe('corregir jornada')
    wrapper.unmount()
  })

  it('finds "corregir jornada" under Finanzas › Jornadas, as links, and announces the count', async () => {
    const { wrapper } = await openHelp()
    await search(wrapper, 'corregir jornada')
    const links = wrapper.findAll('.help-results__link')
    expect(links.length).toBeGreaterThan(0)
    const hit = links.find((link) => link.text().includes('Finanzas › Jornadas'))
    expect(hit).toBeDefined()
    expect(wrapper.get('[role="status"]').text()).toBe(`${links.length} ${links.length === 1 ? 'resultado' : 'resultados'}`)
    expect(wrapper.find('[role="status"]').attributes('aria-live')).toBe('polite')
    wrapper.unmount()
  })

  it('opens the chosen result on its topic with the article expanded and clears the query', async () => {
    const { wrapper, router } = await openHelp()
    await search(wrapper, 'corregir jornada')
    const hit = wrapper.findAll('.help-results__link').find((link) => link.text().includes('Finanzas › Jornadas'))!
    await hit.trigger('click')
    await flushPromises()
    const { query } = router.currentRoute.value
    expect(query.topic).toBe('finanzas.jornadas')
    expect(query.q).toBeUndefined()
    const articleId = query.article as string
    expect(idsOfTopic('finanzas.jornadas')).toContain(articleId)
    expect(wrapper.get(`[data-item-id="${articleId}"]`).attributes('aria-expanded')).toBe('true')
    expect((wrapper.get('input[type="search"]').element as HTMLInputElement).value).toBe('')
    expect(document.activeElement?.getAttribute('data-item-id')).toBe(articleId)
    expect(wrapper.find('.help-results').exists()).toBe(false)
    wrapper.unmount()
  })

  it('the search example only names terms that find something today', async () => {
    const { wrapper } = await openHelp()
    const placeholder = wrapper.get('input[type="search"]').attributes('placeholder')!
    expect(placeholder).toBe('Ej. cobrar, cambio, fiado, abonos')
    expect(placeholder).not.toMatch(/billetes/i)
    for (const term of placeholder.replace('Ej. ', '').split(', ')) {
      await search(wrapper, term)
      expect(wrapper.findAll('.help-results__link').length, term).toBeGreaterThan(0)
    }
    wrapper.unmount()
  })

  it('matches without caring about accents or case', async () => {
    const { wrapper } = await openHelp()
    await search(wrapper, 'TRANSFERENCIA cobrár')
    expect(wrapper.findAll('.help-results__link').some((link) => link.text().includes('Ventas'))).toBe(true)
    wrapper.unmount()
  })

  it('restores a search from the URL into the input and the results', async () => {
    const { wrapper } = await openHelp({ query: { q: 'abonos' } })
    expect((wrapper.get('input[type="search"]').element as HTMLInputElement).value).toBe('abonos')
    expect(wrapper.findAll('.help-results__link').length).toBeGreaterThan(0)
    wrapper.unmount()
  })

  it('keeps focus in the input while typing', async () => {
    const { wrapper } = await openHelp()
    const input = wrapper.get('input[type="search"]')
    ;(input.element as HTMLInputElement).focus()
    await search(wrapper, 'abonos')
    expect(document.activeElement).toBe(input.element)
    await search(wrapper, '')
    expect(document.activeElement).toBe(input.element)
    wrapper.unmount()
  })

  it('shows an empty state with suggestions and a clear button that restores the previous view', async () => {
    const { wrapper, router } = await openHelp({ query: { topic: 'finanzas.gastos' } })
    await search(wrapper, 'no-existe-unicornio')
    expect(wrapper.text()).toContain('No encontramos resultados para «no-existe-unicornio»')
    expect(wrapper.get('[role="status"]').text()).toBe('0 resultados')
    const suggestions = wrapper.findAll('.help-results__empty .help-link-list__link')
    expect(suggestions.length).toBeGreaterThan(0)
    expect(renderedArticleIds()).toEqual([])
    await wrapper.get('[data-action="clear-search-empty"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.q).toBeUndefined()
    expect(wrapper.get('.help-center__main h2').text()).toBe('Gastos')
    expect(document.activeElement).toBe(wrapper.get('input[type="search"]').element)
    wrapper.unmount()
  })

  it('opens a suggested topic from the empty state', async () => {
    const { wrapper, router } = await openHelp()
    await search(wrapper, 'no-existe-unicornio')
    await wrapper.get('.help-results__empty .help-link-list__link').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.topic).toBeTruthy()
    expect(router.currentRoute.value.query.q).toBeUndefined()
    wrapper.unmount()
  })

  it('clears from the field button too', async () => {
    const { wrapper, router } = await openHelp({ query: { q: 'abonos' } })
    await wrapper.get('[data-action="clear-search"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.q).toBeUndefined()
    expect(wrapper.find('.help-results').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('Help Center: levels on a phone', () => {
  it('has no side-by-side layout: no sidebar, categories first', async () => {
    const { wrapper } = await openHelp({ width: 390 })
    expect(sidebar(wrapper).exists()).toBe(false)
    expect(wrapper.find('.help-center--wide').exists()).toBe(false)
    expect(wrapper.find('[data-action="level-back"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Finanzas')
    wrapper.unmount()
  })

  it('walks categories -> topics -> content and back, encoded in the URL', async () => {
    const { wrapper, router } = await openHelp({ width: 390 })
    await click(wrapper, '.help-link-list__link', 'Finanzas')
    expect(router.currentRoute.value.query.topic).toBe('finanzas')
    expect(wrapper.get('[data-action="level-back"]').attributes('aria-label')).toBe('Volver a Ayuda')
    expect(renderedArticleIds()).toEqual([])

    await click(wrapper, '.help-link-list__link', 'Jornadas')
    expect(router.currentRoute.value.query.topic).toBe('finanzas.jornadas')
    const back = wrapper.get('[data-action="level-back"]')
    expect(back.text()).toBe('Finanzas')
    expect(back.attributes('aria-label')).toBe('Volver a Finanzas')
    expect(renderedArticleIds().sort()).toEqual([...idsOfTopic('finanzas.jornadas')].sort())
    expect(wrapper.find('nav[aria-label="Ruta de ayuda"]').exists()).toBe(true)

    await back.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.topic).toBe('finanzas')
    expect(renderedArticleIds()).toEqual([])

    await wrapper.get('[data-action="level-back"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.topic).toBeUndefined()
    expect(wrapper.text()).toContain('¿En qué te ayudamos?')
    wrapper.unmount()
  })

  it('goes straight from a category-level topic back to the home', async () => {
    const { wrapper } = await openHelp({ width: 390, query: { topic: 'deudas' } })
    expect(wrapper.get('[data-action="level-back"]').attributes('aria-label')).toBe('Volver a Ayuda')
    wrapper.unmount()
  })

  it('switches between the sidebar and the levels when the viewport changes', async () => {
    const { wrapper, viewport } = await openHelp({ width: 1280, query: { topic: 'finanzas.jornadas' } })
    expect(sidebar(wrapper).exists()).toBe(true)
    expect(wrapper.find('[data-action="level-back"]').exists()).toBe(false)
    viewport.resize(600)
    await flushPromises()
    expect(sidebar(wrapper).exists()).toBe(false)
    expect(wrapper.find('[data-action="level-back"]').exists()).toBe(true)
    viewport.resize(900)
    await flushPromises()
    expect(sidebar(wrapper).exists()).toBe(true)
    wrapper.unmount()
  })

  it('opens at the 900 px breakpoint: 899 is a phone, 900 has two columns', async () => {
    const narrow = await openHelp({ width: 899 })
    expect(sidebar(narrow.wrapper).exists()).toBe(false)
    narrow.wrapper.unmount()
    const wide = await openHelp({ width: 900 })
    expect(sidebar(wide.wrapper).exists()).toBe(true)
    wide.wrapper.unmount()
  })

  it('searches on a phone and opens a result on its own level', async () => {
    const { wrapper, router } = await openHelp({ width: 320 })
    await wrapper.get('input[type="search"]').setValue('sustituto')
    await flushPromises()
    await wrapper.get('.help-results__link').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.topic).toBe('finanzas.acuerdos')
    expect(wrapper.get('[data-action="level-back"]').text()).toBe('Finanzas')
    wrapper.unmount()
  })
})

describe('Help Center: content and audience', () => {
  it('reaches all articles through the structure, one topic at a time', async () => {
    const { wrapper, router } = await openHelp()
    const seen = new Set<string>()
    for (const topic of HELP_TOPICS) {
      await router.push(helpLocation({ categoryId: topic.categoryId, topicId: topic.id }))
      await flushPromises()
      const ids = renderedArticleIds()
      expect(ids.sort()).toEqual([...topic.articleIds].sort())
      ids.forEach((id) => seen.add(id))
    }
    expect([...seen].sort()).toEqual(HELP_ARTICLES.map((article) => article.id).sort())
    expect(HELP_ARTICLES).toHaveLength(46)
    wrapper.unmount()
  })

  it('keeps ordered steps, Q&A pairs and tips on each article', async () => {
    const { wrapper } = await openHelp({ query: { topic: 'primeros-pasos.preguntas' } })
    expect(wrapper.findAll('article#preguntas dt').length).toBeGreaterThan(2)
    expect(wrapper.findAll('article#preguntas dd')).toHaveLength(wrapper.findAll('article#preguntas dt').length)
    expect(wrapper.find('article#preguntas aside h4').text()).toBe('Ten en cuenta')
    await wrapper.vm.$nextTick()
    const stepsPage = await openHelp({ query: { topic: 'ventas.primera-venta' } })
    expect(stepsPage.wrapper.findAll('article#primera-venta ol > li').length).toBeGreaterThan(1)
    expect(document.body.textContent).not.toContain('src/')
    stepsPage.wrapper.unmount()
    wrapper.unmount()
  })

  it.each(['socio', 'colaborador'] as const)('shows every article with its "Solo socios" badge for a %s, never filtering by role', async (role) => {
    const { wrapper, router } = await openHelp({ role })
    for (const topic of HELP_TOPICS) {
      await router.push(helpLocation({ categoryId: topic.categoryId, topicId: topic.id }))
      await flushPromises()
      const expected = HELP_ARTICLES.filter((article) => topic.articleIds.includes(article.id) && article.audience === 'socio').length
      const badges = wrapper.findAll('.help-view .app-badge').filter((badge) => badge.text() === 'Solo socios')
      expect(badges).toHaveLength(expected)
      expect(renderedArticleIds()).toHaveLength(topic.articleIds.length)
    }
    wrapper.unmount()
  })

  it('labels the accordion triggers of socio articles with the badge inside the button', async () => {
    const { wrapper } = await openHelp({ query: { topic: 'finanzas.gastos' } })
    expect(wrapper.get('[data-item-id="gastos"]').text()).toContain('Solo socios')
    wrapper.unmount()
  })

  it('wires accordion triggers to labelled regions', async () => {
    const { wrapper } = await openHelp({ query: { topic: 'finanzas.gastos' } })
    const trigger = wrapper.get('[data-item-id="corregir-gasto"]')
    const panel = wrapper.get(`#${trigger.attributes('aria-controls')}`)
    expect(panel.attributes('role')).toBe('region')
    expect(panel.attributes('aria-labelledby')).toBe(trigger.attributes('id'))
    wrapper.unmount()
  })

  it('lists related topics as links', async () => {
    const { wrapper, router } = await openHelp({ query: { topic: 'finanzas.simulador' } })
    const related = wrapper.get('.help-topic__related')
    expect(related.text()).toContain('Acuerdos')
    await related.get('a').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.topic).toBe('finanzas.acuerdos')
    wrapper.unmount()
  })
})

describe('Help Center: legacy hash links', () => {
  it('turns /app/ayuda#<article id> into topic and article, once, keeping from', async () => {
    const { wrapper, router, navigations } = await openHelp({ hash: '#jornadas', query: { from: '/app/productos' } })
    const { query, hash } = router.currentRoute.value
    expect(query).toEqual({ topic: 'finanzas.jornadas', article: 'jornadas', from: '/app/productos' })
    expect(hash).toBe('')
    expect(navigations).toHaveLength(1)
    expect(wrapper.get('[data-item-id="jornadas"]').attributes('aria-expanded')).toBe('true')
    expect(renderedArticleIds().sort()).toEqual([...idsOfTopic('finanzas.jornadas')].sort())
    wrapper.unmount()
  })

  it('resolves an agreement article hash such as #acuerdos-corregir', async () => {
    const { wrapper, router } = await openHelp({ hash: '#acuerdos-corregir' })
    expect(router.currentRoute.value.query).toEqual({ topic: 'finanzas.acuerdos', article: 'acuerdos-corregir' })
    expect(wrapper.get('[data-item-id="acuerdos-corregir"]').attributes('aria-expanded')).toBe('true')
    wrapper.unmount()
  })

  it('resolves a topic id or a category id hash', async () => {
    const topic = await openHelp({ hash: '#finanzas.gastos' })
    expect(topic.router.currentRoute.value.query).toEqual({ topic: 'finanzas.gastos' })
    topic.wrapper.unmount()
    const category = await openHelp({ hash: '#ventas' })
    expect(category.router.currentRoute.value.query).toEqual({ topic: 'ventas' })
    category.wrapper.unmount()
  })

  it('degrades an unknown or malformed hash to the home panel without redirecting', async () => {
    for (const hash of ['#no-existe', '#%E0%A4%A', '#__proto__']) {
      const { wrapper, router, navigations } = await openHelp({ hash })
      expect(router.currentRoute.value.query).toEqual({})
      expect(navigations).toHaveLength(0)
      expect(wrapper.text()).toContain('¿En qué te ayudamos?')
      wrapper.unmount()
    }
  })

  it('lets an existing topic win over the hash', async () => {
    const { wrapper, router, navigations } = await openHelp({ hash: '#jornadas', query: { topic: 'ventas' } })
    expect(router.currentRoute.value.query).toEqual({ topic: 'ventas' })
    expect(router.currentRoute.value.hash).toBe('#jornadas')
    expect(navigations).toHaveLength(0)
    expect(wrapper.get('.help-center__main h2').text()).toBe('Ventas')
    wrapper.unmount()
  })

  it('drops an unsafe from while still resolving the hash', async () => {
    const { wrapper, router } = await openHelp({ hash: '#jornadas', query: { from: 'https://evil.example' } })
    expect(router.currentRoute.value.query).toEqual({ topic: 'finanzas.jornadas', article: 'jornadas' })
    wrapper.unmount()
  })

  it('redirects when an old link is followed while the Center is open', async () => {
    const { wrapper, router } = await openHelp()
    await router.push({ name: 'Help', hash: '#efectivo' })
    await flushPromises()
    expect(router.currentRoute.value.query).toMatchObject({ topic: 'ventas.efectivo', article: 'efectivo' })
    expect(router.currentRoute.value.hash).toBe('')
    wrapper.unmount()
  })
})

describe('Help Center: focus robustness', () => {
  it('still moves focus to the new heading after clearing a blank search', async () => {
    const { wrapper } = await openHelp()
    await wrapper.get('input[type="search"]').setValue('   ')
    await flushPromises()
    await wrapper.get('[data-action="clear-search"]').trigger('click')
    await flushPromises()
    // A real click on a link moves focus out of the field; jsdom does not, so do it explicitly.
    ;(document.activeElement as HTMLElement).blur()
    // One single navigation: a stale suppress flag would swallow exactly this one.
    await click(wrapper, '.help-sidebar__category', 'Finanzas')
    expect(document.activeElement).toBe(heading())
    expect(heading()?.textContent).toContain('Finanzas')
    wrapper.unmount()
  })

  it('keeps focus in the search field when clearing a real query', async () => {
    const { wrapper } = await openHelp({ query: { q: 'abonos' } })
    await wrapper.get('[data-action="clear-search"]').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.get('input[type="search"]').element)
    ;(document.activeElement as HTMLElement).blur()
    await click(wrapper, '.help-sidebar__category', 'Finanzas')
    expect(document.activeElement).toBe(heading())
    wrapper.unmount()
  })

  it('degrades a hostile article id to the heading without throwing', async () => {
    for (const article of ['a"] , [x', 'x"]\\', "'; alert(1)", '[data-item-id]']) {
      const { wrapper } = await openHelp({ query: { topic: 'finanzas.jornadas', article } })
      expect(document.activeElement).toBe(heading())
      expect(wrapper.get('.help-center__main h2').text()).toBe('Jornadas')
      wrapper.unmount()
    }
  })
})
