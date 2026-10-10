import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { openHelp, renderedArticleIds } from '@/components/help/__tests__/helpTestUtils'

afterEach(() => { document.body.innerHTML = '' })

describe('agreement help discovery', () => {
  it('reaches all eight accessible agreement articles and finds correction guidance by search', async () => {
    const { wrapper, router } = await openHelp({ query: { topic: 'finanzas.acuerdos' } })
    const ids = renderedArticleIds().filter((id) => id.startsWith('acuerdos-'))
    expect(ids).toHaveLength(8)
    expect(wrapper.find('#acuerdos-efecto-legal').text()).toContain('ley aplicable')
    expect(wrapper.find('#acuerdos-pdf').text()).toContain('ANULADO')

    await wrapper.get('input[type="search"]').setValue('sustituto')
    await flushPromises()
    const hit = wrapper.findAll('.help-results__link').find((link) => link.text().includes('Finanzas › Acuerdos'))
    expect(hit).toBeDefined()
    await hit!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.article).toMatch(/^acuerdos-/)
    expect(wrapper.get(`[data-item-id="${router.currentRoute.value.query.article as string}"]`).attributes('aria-expanded')).toBe('true')
    wrapper.unmount()
  })

  it('finds the correction article specifically', async () => {
    const { wrapper } = await openHelp()
    await wrapper.get('input[type="search"]').setValue('sustituto')
    await flushPromises()
    expect(wrapper.text()).toContain('Finanzas › Acuerdos')
    wrapper.unmount()
  })
})
