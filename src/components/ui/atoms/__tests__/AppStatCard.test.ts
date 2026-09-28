import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import AppStatCard from '../AppStatCard.vue'

async function mountCard(props: Partial<InstanceType<typeof AppStatCard>['$props']> = {}, slots = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/app/productos', name: 'ProductCatalog', component: { template: '<div />' } },
    ],
  })
  router.push('/')
  await router.isReady()
  return mount(AppStatCard, {
    props: { label: 'Ventas de hoy', value: '$1,300.50', ...props },
    slots,
    global: { plugins: [router] },
  })
}

describe('AppStatCard — contenido', () => {
  it('muestra el número grande y la etiqueta', async () => {
    const wrapper = await mountCard()
    expect(wrapper.get('.app-stat-card__label').text()).toBe('Ventas de hoy')
    expect(wrapper.get('.app-stat-card__value').text()).toBe('$1,300.50')
  })

  it('el sublabel es opcional', async () => {
    const withSub = await mountCard({ sublabel: '2 ventas · +30% vs. ayer' })
    expect(withSub.get('.app-stat-card__sublabel').text()).toBe('2 ventas · +30% vs. ayer')

    const withoutSub = await mountCard()
    expect(withoutSub.find('.app-stat-card__sublabel').exists()).toBe(false)
  })

  it('acepta contenido extra por slot (ej. una lista corta)', async () => {
    const wrapper = await mountCard({}, { default: '<p class="extra">detalle</p>' })
    expect(wrapper.find('.extra').exists()).toBe(true)
  })
})

describe('AppStatCard — link opcional', () => {
  it('sin "to" no es clickeable: nada de <a> ni <router-link>', async () => {
    const wrapper = await mountCard()
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.element.tagName).toBe('DIV')
  })

  it('con "to" se vuelve un enlace real a esa ruta', async () => {
    const wrapper = await mountCard({ to: '/app/productos' })
    const link = wrapper.get('a')
    expect(link.attributes('href')).toBe('/app/productos')
  })
})
