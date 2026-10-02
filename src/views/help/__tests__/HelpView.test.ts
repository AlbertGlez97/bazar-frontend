import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import HelpView from '../HelpView.vue'
import { HELP_ARTICLES } from '@/config/help-content'
import { useUiModeStore } from '@/stores/uiMode.store'

afterEach(() => { document.body.innerHTML = '' })

async function openHelp(query: Record<string, string> = {}, hash = '') {
  const pinia = createPinia()
  useUiModeStore(pinia).setMode('venta')
  const stub = { template: '<div />' }
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/app/ayuda', name: 'Help', component: HelpView },
    { path: '/app', name: 'AppHome', component: stub },
    { path: '/app/venta', name: 'Sale', component: stub },
    { path: '/app/productos', name: 'ProductCatalog', component: stub },
    { path: '/app/reportes', name: 'Reports', component: stub, meta: { requiresSocio: true, requiresGestion: true } },
  ] })
  await router.push({ name: 'Help', query, hash })
  await router.isReady()
  const wrapper = mount(HelpView, { attachTo: document.body, global: { plugins: [pinia, router] } })
  await flushPromises()
  return { wrapper, router }
}

describe('HelpView', () => {
  it('renders frequently asked questions as question/answer pairs', async () => {
    const { wrapper } = await openHelp()
    expect(wrapper.findAll('#preguntas dt').length).toBeGreaterThan(2)
    expect(wrapper.findAll('#preguntas dd')).toHaveLength(wrapper.findAll('#preguntas dt').length)
  })
  it('renders readable semantic articles, role labels and a named index without internal evidence', async () => {
    const { wrapper } = await openHelp()
    expect(wrapper.get('h1').text()).toContain('Ayuda')
    expect(wrapper.findAll('article')).toHaveLength(HELP_ARTICLES.length)
    expect(wrapper.findAll('article h2')).toHaveLength(HELP_ARTICLES.length)
    expect(wrapper.get('nav[aria-label="Índice de ayuda"]').attributes('aria-label')).toBe('Índice de ayuda')
    expect(wrapper.text()).toContain('Solo socios')
    expect(wrapper.text()).not.toContain('src/')
  })
  it('searches accents and body tokens locally, announces count and offers clearing empty results', async () => {
    const { wrapper } = await openHelp()
    await wrapper.get('input[type="search"]').setValue('BÍLLETES selección')
    expect(wrapper.find('article#efectivo').exists()).toBe(true)
    expect(wrapper.get('[role="status"]').text()).toContain('temas')
    await wrapper.get('input').setValue('no-existe-unicornio')
    expect(wrapper.findAll('article')).toHaveLength(0)
    expect(wrapper.text()).toContain('No encontramos')
    await wrapper.get('button[data-action="clear-search"]').trigger('click')
    expect(wrapper.findAll('article')).toHaveLength(HELP_ARTICLES.length)
  })
  it('supports direct hash focus and section navigation even after filtering', async () => {
    const { wrapper, router } = await openHelp({}, '#efectivo')
    expect(document.activeElement?.id).toBe('efectivo')
    await wrapper.get('input').setValue('no-existe-unicornio')
    await router.replace({ name: 'Help', hash: '#crear-deuda' })
    await flushPromises()
    expect(wrapper.find('article#crear-deuda').exists()).toBe(true)
    expect(document.activeElement?.id).toBe('crear-deuda')
  })
  it('returns to a known app screen without mode changes or history loops', async () => {
    const { wrapper, router } = await openHelp({ from: '/app/productos' })
    await wrapper.get('[data-action="return"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('ProductCatalog')
    expect(useUiModeStore().currentMode).toBe('venta')
  })
  it.each(['https://example.org', '//example.org', '/login', '/app/ayuda', '/app/ayuda?from=/app/ayuda', '/app/../login', '/app/missing', '/app/reportes'])('uses a safe mode fallback for %s', async (from) => {
    const { wrapper, router } = await openHelp({ from })
    await wrapper.get('[data-action="return"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('Sale')
  })
  it('keeps section navigation on the same help route and preserves its return hint', async () => {
    const { wrapper, router } = await openHelp({ from: '/app/productos' })
    await wrapper.get('nav a[href*="#efectivo"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.hash).toBe('#efectivo')
    expect(router.currentRoute.value.query.from).toBe('/app/productos')
    expect(document.activeElement?.id).toBe('efectivo')
  })
})
