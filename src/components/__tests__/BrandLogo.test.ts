import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import BrandLogo from '@/components/ui/atoms/BrandLogo.vue'
import { APP_NAME } from '@/config/app'

describe('BrandLogo', () => {
  it('por defecto muestra el isotipo y el nombre de la app', () => {
    const wrapper = mount(BrandLogo)
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.get('.brand-logo__name').text()).toBe(APP_NAME)
  })

  it('el isotipo es decorativo y no entra al árbol de accesibilidad', () => {
    const svg = mount(BrandLogo).get('svg')
    expect(svg.attributes('aria-hidden')).toBe('true')
    expect(svg.attributes('focusable')).toBe('false')
  })

  it('variant="mark" deja solo el isotipo', () => {
    const wrapper = mount(BrandLogo, { props: { variant: 'mark' } })
    expect(wrapper.find('.brand-logo__name').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })

  it('tone="inverse" marca la versión para fondos oscuros', () => {
    expect(mount(BrandLogo, { props: { tone: 'inverse' } }).classes()).toContain('brand-logo--inverse')
    expect(mount(BrandLogo).classes()).toContain('brand-logo--default')
  })

  it('el tamaño se pasa por la variable --logo-size', () => {
    const wrapper = mount(BrandLogo, { props: { size: 48 } })
    expect(wrapper.attributes('style')).toContain('--logo-size: 48px')
  })

  it('el isotipo es un toldo de 4 franjas con festón', () => {
    const wrapper = mount(BrandLogo)
    expect(wrapper.findAll('.brand-logo__stripe-a, .brand-logo__stripe-b')).toHaveLength(8) // 4 franjas + 4 festones
    expect(wrapper.find('.brand-logo__m').exists()).toBe(true)
  })

  it('cada instancia tiene su propio clipPath (sin ids duplicados en la página)', () => {
    // Dos logos en la MISMA app (los ids salen de useId, único por app)
    const wrapper = mount({ render: () => h('div', [h(BrandLogo), h(BrandLogo)]) })
    const [a, b] = wrapper.findAll('clipPath').map((c) => c.attributes('id'))
    expect(a).toBeTruthy()
    expect(a).not.toBe(b)
  })

  it('no fija colores: usa tokens de main.css', () => {
    expect(mount(BrandLogo).html()).not.toMatch(/#[0-9a-f]{3,8}\b|rgb/i)
  })
})
