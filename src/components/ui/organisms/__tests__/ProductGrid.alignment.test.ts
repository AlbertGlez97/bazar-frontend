import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { makeProduct } from '@/test/factories'
import ProductCard from '../ProductCard.vue'
import cardSource from '../ProductCard.vue?raw'
import catalogSource from '../ProductCatalogGrid.vue?raw'
import pickerSource from '../SaleCatalogPicker.vue?raw'

// jsdom cannot measure layout. These checks protect grid-only CSS contracts;
// real-browser short/long-name measurements are a separate verification step.
function declarations(source: string, selector: string) {
  const style = source.slice(source.indexOf('<style'))
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return style.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] ?? ''
}

describe('product grid alignment', () => {
  it.each(['default', 'large'] as const)('preserves full accessible names and prices in %s grid cards', (size) => {
    for (const name of ['ram ddr5', 'ASUS ROG STRIX motherboard with DDR5 memory support and multiple expansion slots']) {
      const wrapper = mount(ProductCard, { props: { product: makeProduct({ name }), size } })
      expect(wrapper.get('.product-card__name').text()).toBe(name)
      expect(wrapper.get('.product-card__price').text()).toBe('$10.00')
    }
  })

  it('stretches both outer grids and the sale cell/button/card wrapper chain', () => {
    expect(declarations(catalogSource, '.product-catalog-grid__grid')).toMatch(/align-items:\s*stretch/)
    expect(declarations(pickerSource, '.sale-picker__grid')).toMatch(/align-items:\s*stretch/)
    expect(declarations(pickerSource, '.sale-picker__grid .sale-picker__cell')).toMatch(/display:\s*flex/)
    expect(declarations(pickerSource, '.sale-picker__grid .sale-picker__item')).toMatch(/display:\s*flex/)
    expect(declarations(pickerSource, '.sale-picker__grid .sale-picker__item :deep(.product-card)')).toMatch(/flex:\s*1/)
  })

  it('grows the grid body and anchors price/availability without changing list CSS', () => {
    expect(declarations(cardSource, '.product-card:not(.product-card--list) .product-card__body')).toMatch(/flex:\s*1/)
    expect(declarations(cardSource, '.product-card:not(.product-card--list) .product-card__price')).toMatch(/margin-top:\s*auto/)
    const name = declarations(cardSource, '.product-card:not(.product-card--list) .product-card__name')
    expect(name).toMatch(/-webkit-line-clamp:\s*2/)
    expect(name).toMatch(/-webkit-box-orient:\s*vertical/)
    expect(name).toMatch(/overflow:\s*hidden/)
    expect(name).toMatch(/text-overflow:\s*ellipsis/)
    expect(declarations(cardSource, '.product-card--list')).toMatch(/flex-direction:\s*row/)
    expect(declarations(cardSource, '.product-card--list .product-card__name')).toMatch(/white-space:\s*nowrap/)
  })
})
