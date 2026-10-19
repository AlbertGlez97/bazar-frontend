import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductRestockForm from '../ProductRestockForm.vue'
import { makeProduct } from '@/test/factories'

const mountForm = (overrides = {}) => mount(ProductRestockForm, { props: { product: makeProduct({ name: 'Playera', purchaseCostMinor: 100, ...overrides }) } })

describe('ProductRestockForm — marca y presentación', () => {
  it('dice de qué talla es la reposición', () => {
    expect(mountForm({ brand: 'Nike', presentation: 'XL' }).get('.product-restock-form__subtitle').text()).toBe('Nike · XL')
  })
  it('sin datos no hay línea', () => {
    expect(mountForm().find('.product-restock-form__subtitle').exists()).toBe(false)
  })
})
