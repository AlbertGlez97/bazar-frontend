import { describe, expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import HelpView from '../help/HelpView.vue'
describe('agreement help discovery', () => {
  it('renders all eight accessible articles and finds correction guidance by search', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/app/ayuda', name: 'Help', component: HelpView }] })
    await router.push('/app/ayuda'); await router.isReady()
    const w = mount(HelpView, { global: { plugins: [createPinia(), router] } }); await flushPromises()
    expect(w.findAll('article[id^="acuerdos-"]')).toHaveLength(8)
    expect(w.find('#acuerdos-efecto-legal').text()).toContain('ley aplicable')
    expect(w.find('#acuerdos-pdf').text()).toContain('ANULADO')
    await w.find('input[type="search"]').setValue('sustituto')
    expect(w.find('#acuerdos-corregir').exists()).toBe(true)
    w.unmount()
  })
})
