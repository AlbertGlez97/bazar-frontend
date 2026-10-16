import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { makeProduct } from '@/test/factories'
import { mockDevice, type MockDevice } from '@/test/mockDevice'
import { SMALL_SCREEN_QUERY } from '@/composables/useDeviceCapabilities'
import SaleCatalogPicker from '../SaleCatalogPicker.vue'
import source from '../SaleCatalogPicker.vue?raw'
import productCardSource from '../ProductCard.vue?raw'

// Catálogo de Venta en celular y tablet vertical (bajo 900 px): cuadrícula de
// 2 columnas compactas, insignia "×N" sobre la foto, buscador corto. Desde
// 900 px el catálogo es exactamente el de siempre.

let device: MockDevice | null = null
afterEach(() => {
  device?.restore()
  device = null
})

type Props = InstanceType<typeof SaleCatalogPicker>['$props']

function mountPicker(props: Partial<Props> = {}) {
  return mount(SaleCatalogPicker, {
    props: {
      products: [],
      search: '',
      categories: ['Bebidas', 'Tecnología'],
      category: '',
      loading: false,
      errorMessage: null,
      fromSnapshot: false,
      snapshotSavedAt: null,
      inCartIds: [],
      ...props,
    },
  })
}

const cafe = makeProduct({ name: 'Café de olla', unitPriceMinor: 1999 })
const pan = makeProduct({ name: 'Pan dulce', unitPriceMinor: 850 })

describe('SaleCatalogPicker — pantalla pequeña (bajo 900 px)', () => {
  it('la cuadrícula es de 2 columnas compactas con tarjetas ProductCard size="compact"', () => {
    device = mockDevice({ small: true })
    const wrapper = mountPicker({ products: [cafe, pan] })

    expect(wrapper.get('ul').classes()).toContain('sale-picker__grid--compact')
    expect(wrapper.findAll('.product-card').every((card) => card.classes().includes('product-card--compact'))).toBe(true)
  })

  it('el buscador dice solo "Buscar" pero conserva su nombre accesible completo', () => {
    device = mockDevice({ small: true })
    const input = mountPicker().get('input[type="search"]')

    expect(input.attributes('placeholder')).toBe('Buscar')
    expect(input.attributes('aria-label')).toBe('Buscar producto')
  })

  it('las categorías siguen siendo botones, con "Todo" primero', async () => {
    device = mockDevice({ small: true })
    const wrapper = mountPicker()

    const buttons = wrapper.findAll('.category-filter__btn')
    expect(buttons.map((b) => b.text())).toEqual(['Todo', 'Bebidas', 'Tecnología'])
    await buttons[2]!.trigger('click')
    expect(wrapper.emitted('update:category')).toEqual([['Tecnología']])
  })

  it('un producto en la venta muestra su contador "− N +" (que reemplaza al "×N"), no la marca "En tu venta"', () => {
    device = mockDevice({ small: true })
    const wrapper = mountPicker({ products: [cafe, pan], inCartIds: [cafe.id], quantities: { [cafe.id]: 3 } })

    const cells = wrapper.findAll('li.sale-picker__cell')
    expect(cells[0]!.get('.sale-picker__counter output').text()).toBe('3')
    expect(cells[1]!.find('.sale-picker__counter').exists()).toBe(false)
    expect(wrapper.find('.product-card__qty').exists()).toBe(false)
    expect(wrapper.find('.sale-picker__mark').exists()).toBe(false)
  })

  it('en la vista Lista el contador también va dentro de la fila', () => {
    device = mockDevice({ small: true })
    const wrapper = mountPicker({ products: [cafe], inCartIds: [cafe.id], quantities: { [cafe.id]: 2 }, view: 'list' })

    expect(wrapper.get('li.sale-picker__cell .sale-picker__counter output').text()).toBe('2')
    expect(wrapper.find('.product-card__qty').exists()).toBe(false)
  })

  it('la cuadrícula compacta sigue una sola opción por producto: tocar agrega', async () => {
    device = mockDevice({ small: true })
    const wrapper = mountPicker({ products: [cafe] })

    await wrapper.get('button.sale-picker__item').trigger('click')

    expect(wrapper.emitted('select')).toEqual([[cafe]])
  })

  it('el nombre accesible del producto no cambia (precio y estado incluidos)', () => {
    device = mockDevice({ small: true })
    const wrapper = mountPicker({ products: [cafe], inCartIds: [cafe.id], quantities: { [cafe.id]: 1 } })

    expect(wrapper.get('button.sale-picker__item').attributes('aria-label')).toBe('Agregar Café de olla, $19.99, ya está en tu venta')
  })
})

describe('SaleCatalogPicker — pantalla ancha (900 px o más): sin cambios', () => {
  it('cuadrícula de siempre, tarjetas grandes, "Buscar producto" y marca "En tu venta"', () => {
    device = mockDevice({ small: false })
    const wrapper = mountPicker({ products: [cafe], inCartIds: [cafe.id], quantities: { [cafe.id]: 3 } })

    expect(wrapper.get('ul').classes()).not.toContain('sale-picker__grid--compact')
    expect(wrapper.get('.product-card').classes()).toContain('product-card--large')
    expect(wrapper.get('input[type="search"]').attributes('placeholder')).toBe('Buscar producto')
    expect(wrapper.get('.sale-picker__mark').text()).toBe('En tu venta')
    expect(wrapper.find('.product-card__qty').exists()).toBe(false)
  })
})

describe('SaleCatalogPicker — contrato de CSS móvil', () => {
  const css = (text: string) => text.slice(text.indexOf('<style')).replace(/<style[^>]*>/, '').replace(/\/\*[\s\S]*?\*\//g, '')
  const picker = css(source)
  const card = css(productCardSource)
  const rule = (css: string, selector: string) =>
    [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter(([, selectors]) => selectors!.split(',').map((part) => part.trim()).includes(selector))
      .map(([, , body]) => body)
      .join(';')

  it('la cuadrícula compacta usa exactamente 2 columnas iguales que no se desbordan', () => {
    expect(rule(picker, '.sale-picker__grid--compact')).toMatch(/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
  })

  it('la foto es cuadrada y recortada (cover), no deformada', () => {
    expect(rule(card, '.product-card--compact .product-card__media')).toMatch(/aspect-ratio:\s*1\s*\/\s*1/)
    expect(rule(card, '.product-card__img')).toMatch(/object-fit:\s*cover/)
  })

  it('el nombre se corta a 2 líneas con puntos suspensivos', () => {
    const name = rule(card, '.product-card:not(.product-card--list) .product-card__name')
    expect(name).toMatch(/-webkit-line-clamp:\s*2/)
    expect(name).toMatch(/text-overflow:\s*ellipsis/)
  })

  it('la insignia ×N va sobre la foto (posición absoluta) y es legible', () => {
    const qty = rule(card, '.product-card__qty')
    expect(qty).toMatch(/position:\s*absolute/)
    expect(qty).toMatch(/font-weight:\s*(700|800)/)
  })

  it('en la fila de Lista la insignia no flota: queda en el flujo', () => {
    expect(rule(card, '.product-card--list .product-card__qty')).toMatch(/position:\s*static/)
  })

  it('cada producto es una zona táctil de al menos 44 px', () => {
    expect(rule(picker, '.sale-picker__item')).toMatch(/min-height:\s*(2\.75|3|4|5)(\.\d+)?rem/)
  })

  it('el buscador, "Escanear", las categorías y la vista miden al menos 44 px', () => {
    // Con dedo los tokens valen 48 y 44 px; con mouse, 40 y 32 (control-heights.test.ts).
    expect(rule(picker, '.sale-picker .sale-picker__scan')).toMatch(/min-height:\s*var\(--control-height\)/)
    expect(rule(picker, '.sale-picker__view-btn')).toMatch(/min-height:\s*var\(--control-height-compact\)/)
  })

  it('usa el mismo umbral de pantalla pequeña que el resto de la app (899.98 px)', () => {
    expect(SMALL_SCREEN_QUERY).toBe('(max-width: 899.98px)')
    // Sin media queries propias con otro número: quien decide es useDeviceCapabilities.
    expect(source).not.toMatch(/@media[^{]*max-width:\s*(7\d\d|8[0-8]\d)px/)
  })
})
