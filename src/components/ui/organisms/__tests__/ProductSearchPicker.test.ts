import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductSearchPicker from '../ProductSearchPicker.vue'
import { VOICE } from '@/config/voice'
import type { Product } from '@/types/product.types'

const product = (n: number, overrides: Partial<Product> = {}): Product => ({
  id: `p-${n}`, name: `Producto ${n}`, tipo: 'unica', unitPriceMinor: 1000 * n, initialStock: 1, stock: 1,
  category: null, purchaseCostMinor: null, supplier: null, notes: null, createdAt: '2026-01-01T00:00:00.000Z',
  active: true, image: null, ...overrides,
})

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('ProductSearchPicker — buscador (D2)', () => {
  it('escribir emite "search" tras el debounce, no en cada tecla', async () => {
    const wrapper = mount(ProductSearchPicker, { props: { results: [], loading: false, errorMessage: '' } })
    await wrapper.get('input').setValue('rel')
    expect(wrapper.emitted('search')).toBeUndefined()
    vi.advanceTimersByTime(350)
    expect(wrapper.emitted('search')).toEqual([['rel']])
  })

  it('muestra los resultados con un botón "Agregar" cada uno (nunca casillas)', async () => {
    const wrapper = mount(ProductSearchPicker, {
      props: { results: [product(1), product(2)], loading: false, errorMessage: '' },
    })
    await wrapper.get('input').setValue('prod')
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
    const rows = wrapper.findAll('.product-search-picker__row')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('Producto 1')
    await rows[0].get('button').trigger('click')
    expect(wrapper.emitted('add')).toEqual([[product(1)]])
  })

  it('cargando: muestra el aviso de búsqueda', () => {
    const wrapper = mount(ProductSearchPicker, { props: { results: [], loading: true, errorMessage: '' } })
    expect(wrapper.text()).toContain(VOICE.codigosQr.searching)
  })

  it('sin resultados para una búsqueda no vacía: mensaje de "no encontrado"', async () => {
    const wrapper = mount(ProductSearchPicker, { props: { results: [], loading: false, errorMessage: '' } })
    await wrapper.get('input').setValue('nada')
    expect(wrapper.text()).toContain(VOICE.codigosQr.searchEmpty)
  })

  it('error de red: aviso + reintentar reemite la búsqueda actual sin esperar el debounce', async () => {
    const wrapper = mount(ProductSearchPicker, { props: { results: [], loading: false, errorMessage: VOICE.networkError } })
    await wrapper.get('input').setValue('rel')
    expect(wrapper.text()).toContain(VOICE.networkError)
    const retry = wrapper.findAll('button').find((b) => b.text() === VOICE.codigosQr.retry)!
    await retry.trigger('click')
    expect(wrapper.emitted('search')).toEqual([['rel']])
  })
})
