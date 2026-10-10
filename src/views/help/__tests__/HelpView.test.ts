import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { openHelp } from '@/components/help/__tests__/helpTestUtils'
import { useUiModeStore } from '@/stores/uiMode.store'

afterEach(() => { document.body.innerHTML = '' })

describe('HelpView (route component)', () => {
  it('renders the page title and delegates the content to the Help Center', async () => {
    const { wrapper } = await openHelp()
    expect(wrapper.get('h1').text()).toContain('Ayuda')
    expect(wrapper.find('.help-center').exists()).toBe(true)
    expect(wrapper.find('nav[aria-label="Temas de ayuda"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('renders frequently asked questions as question/answer pairs', async () => {
    const { wrapper } = await openHelp({ query: { topic: 'primeros-pasos.preguntas' } })
    expect(wrapper.findAll('#preguntas dt').length).toBeGreaterThan(2)
    expect(wrapper.findAll('#preguntas dd')).toHaveLength(wrapper.findAll('#preguntas dt').length)
    wrapper.unmount()
  })

  it('renders readable semantic articles and role labels without internal evidence', async () => {
    const { wrapper } = await openHelp({ query: { topic: 'finanzas.gastos' } })
    expect(wrapper.findAll('article')).toHaveLength(2)
    expect(wrapper.findAll('h3 > button[aria-expanded]')).toHaveLength(2)
    expect(wrapper.text()).toContain('Solo socios')
    expect(wrapper.text()).not.toContain('src/')
    wrapper.unmount()
  })

  it('returns to a known app screen without mode changes or history loops', async () => {
    const { wrapper, router } = await openHelp({ query: { from: '/app/productos' } })
    await wrapper.get('[data-action="return"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('ProductCatalog')
    expect(useUiModeStore().currentMode).toBe('venta')
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

  it('keeps navigation on the same help route and preserves its return hint', async () => {
    const { wrapper, router } = await openHelp({ query: { from: '/app/productos' } })
    const link = wrapper.findAll('.help-sidebar__category').find((item) => item.text().includes('Ventas'))!
    await link.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('Help')
    expect(router.currentRoute.value.query).toMatchObject({ topic: 'ventas', from: '/app/productos' })
    wrapper.unmount()
  })
})

describe('help presentation under the global reset', () => {
  const article = readFileSync('src/components/help/HelpArticleContent.vue', 'utf8')
  it('ordered steps', () => {
    expect(article).toMatch(/\.help-article ol\s*\{[^}]*list-style:\s*decimal/)
  })
  it('readable article width', () => {
    expect(article).toMatch(/\.help-article\s*\{[^}]*max-width:\s*70ch/)
  })
  it('does not remove the global focus ring', () => {
    const css = readFileSync('src/assets/main.css', 'utf8')
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*3px solid/)
    expect(css).not.toMatch(/:focus(-visible)?\s*\{[^}]*outline:\s*(none|0)/)
  })

  it('removes the outline only from programmatic heading targets, never from interactive controls', () => {
    const headingFiles = ['HelpTopicPanel', 'HelpCategoryOverview', 'HelpHome', 'HelpSearchResults', 'HelpArticleContent']
    for (const file of headingFiles) {
      const source = readFileSync(`src/components/help/${file}.vue`, 'utf8')
      const style = source.slice(source.indexOf('<style'))
      // Every element carrying data-help-heading, whatever the attribute order or line breaks.
      const tags = [...source.matchAll(/data-help-heading/g)].map((match) => {
        const start = source.lastIndexOf('<', match.index)
        return source.slice(start, source.indexOf('>', match.index) + 1)
      })
      expect(tags.length, file).toBeGreaterThan(0)
      for (const tag of tags) {
        expect(tag, `${file} heading is a programmatic focus target`).toMatch(/\btabindex="-1"/)
        const className = /\bclass="([\w-]+)"/.exec(tag)?.[1]
        expect(className, `${file} heading has a class to hang the rule on`).toBeTruthy()
        const rule = new RegExp(`\\.${className}:focus,\\s*\\.${className}:focus-visible\\s*\\{[^}]*outline:\\s*none`)
        expect(style, `${file} .${className}`).toMatch(rule)
      }
    }

    const interactive = [
      'src/components/help/HelpCenter.vue', 'src/components/help/HelpSidebar.vue', 'src/components/help/HelpLinkList.vue',
      'src/components/help/HelpLink.vue', 'src/components/help/HelpBreadcrumb.vue', 'src/components/help/HelpSearch.vue',
      'src/components/help/HelpDrawer.vue', 'src/components/ui/molecules/AppAccordion.vue',
      'src/layouts/AppLayout.vue',
    ]
    // AppDrawer is left out on purpose: its only rule is on the tabindex=-1 dialog container, not a control.
    for (const file of interactive) {
      const style = readFileSync(file, 'utf8')
      expect(style, file).not.toMatch(/:focus(-visible)?\s*\{[^}]*outline:\s*(none|0)\b(?![^}]*3px)/)
    }
  })
})
