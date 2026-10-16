import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { makeProduct } from '@/test/factories'
import { mockDevice, type MockDevice } from '@/test/mockDevice'
import SaleCatalogPicker from '../SaleCatalogPicker.vue'
import source from '../SaleCatalogPicker.vue?raw'

// Catálogo de Venta en celular (bajo 900 px): lo que está en la venta muestra un
// contador "− N +" dentro de su tarjeta o fila (producto por cantidad) o una marca
// "En tu venta ✓" que se quita al tocar de nuevo (pieza única). Tocar la tarjeta o
// la fila sigue sumando 1. Desde 900 px nada de esto existe.

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
      categories: [],
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

const cafe = makeProduct({ name: 'Café de olla', unitPriceMinor: 1999, stock: 5 })
const pan = makeProduct({ name: 'Pan dulce', unitPriceMinor: 850, stock: 20 })
const radio = makeProduct({ name: 'Radio vintage', tipo: 'unica', stock: 1, initialStock: 1, unitPriceMinor: 45000 })

const stepper = (w: ReturnType<typeof mountPicker>, index = 0) => w.findAll('.sale-picker__counter')[index]!
const minus = (w: ReturnType<typeof mountPicker>, index = 0) => stepper(w, index).get('button[data-action="decrement"]')
const plus = (w: ReturnType<typeof mountPicker>, index = 0) => stepper(w, index).get('button[data-action="increment"]')

describe('SaleCatalogPicker — contador en celular', () => {
  it('un producto por cantidad en la venta muestra "− N +" en su tarjeta, fuera del botón de la tarjeta', () => {
    device = mockDevice({ small: true })
    const wrapper = mountPicker({ products: [cafe, pan], inCartIds: [cafe.id], quantities: { [cafe.id]: 3 } })

    expect(wrapper.findAll('.sale-picker__counter')).toHaveLength(1)
    expect(stepper(wrapper).get('output').text()).toBe('3')
    // Un botón dentro de otro botón sería HTML inválido: el contador es hermano del botón.
    expect(wrapper.get('button.sale-picker__item').find('.sale-picker__counter').exists()).toBe(false)
    expect(wrapper.get('li.sale-picker__cell').find('.sale-picker__counter').exists()).toBe(true)
  })

  it('reemplaza al "×N": ya no hay insignia de cantidad en las tarjetas ni en las filas', () => {
    device = mockDevice({ small: true })
    const grid = mountPicker({ products: [cafe], inCartIds: [cafe.id], quantities: { [cafe.id]: 2 } })
    const list = mountPicker({ products: [cafe], inCartIds: [cafe.id], quantities: { [cafe.id]: 2 }, view: 'list' })

    expect(grid.find('.product-card__qty').exists()).toBe(false)
    expect(list.find('.product-card__qty').exists()).toBe(false)
    expect(list.findAll('.sale-picker__counter')).toHaveLength(1)
  })

  it('un producto que no está en la venta no tiene contador', () => {
    device = mockDevice({ small: true })
    const wrapper = mountPicker({ products: [cafe, pan], inCartIds: [cafe.id], quantities: { [cafe.id]: 1 } })

    expect(wrapper.findAll('.sale-picker__counter')).toHaveLength(1)
  })

  it('tocar la tarjeta o la fila sigue sumando 1 (emite select)', async () => {
    device = mockDevice({ small: true })
    const wrapper = mountPicker({ products: [cafe], inCartIds: [cafe.id], quantities: { [cafe.id]: 2 } })

    await wrapper.get('button.sale-picker__item').trigger('click')

    expect(wrapper.emitted('select')).toEqual([[cafe]])
  })

  it('"+" emite increment con el producto y "−" emite decrement', async () => {
    device = mockDevice({ small: true })
    const wrapper = mountPicker({ products: [cafe], inCartIds: [cafe.id], quantities: { [cafe.id]: 3 } })

    await plus(wrapper).trigger('click')
    await minus(wrapper).trigger('click')

    expect(wrapper.emitted('increment')).toEqual([[cafe]])
    expect(wrapper.emitted('decrement')).toEqual([[cafe]])
  })

  it('tocar "−" NO suma: el toque no llega a la tarjeta (no se emite select)', async () => {
    device = mockDevice({ small: true })
    const wrapper = mountPicker({ products: [cafe], inCartIds: [cafe.id], quantities: { [cafe.id]: 3 } })

    await minus(wrapper).trigger('click')
    await plus(wrapper).trigger('click')
    await stepper(wrapper).trigger('click')

    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('el toque del contador se detiene antes de llegar a quien lo contiene (stopPropagation)', async () => {
    device = mockDevice({ small: true })
    const wrapper = mountPicker({ products: [cafe], inCartIds: [cafe.id], quantities: { [cafe.id]: 3 } })
    let reachedAncestor = false
    wrapper.element.addEventListener('click', () => { reachedAncestor = true })

    await minus(wrapper).trigger('click')

    expect(reachedAncestor).toBe(false)
  })

  it('"−" con 1 pieza también emite decrement (el contenedor la saca de la venta al llegar a 0)', async () => {
    device = mockDevice({ small: true })
    const wrapper = mountPicker({ products: [cafe], inCartIds: [cafe.id], quantities: { [cafe.id]: 1 } })

    expect(minus(wrapper).attributes('aria-disabled')).toBeUndefined()
    await minus(wrapper).trigger('click')

    expect(wrapper.emitted('decrement')).toEqual([[cafe]])
    expect(wrapper.emitted('limit')).toBeUndefined()
  })

  it('"+" se apaga en el máximo de existencia: no suma y avisa el límite', async () => {
    device = mockDevice({ small: true })
    const wrapper = mountPicker({ products: [cafe], inCartIds: [cafe.id], quantities: { [cafe.id]: 5 } })

    expect(plus(wrapper).attributes('aria-disabled')).toBe('true')
    await plus(wrapper).trigger('click')

    expect(wrapper.emitted('increment')).toBeUndefined()
    expect(wrapper.emitted('limit')).toEqual([[cafe, 'max']])
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('el contador es táctil: botones de al menos 44 px (variante "touch")', () => {
    device = mockDevice({ small: true })
    const wrapper = mountPicker({ products: [cafe], inCartIds: [cafe.id], quantities: { [cafe.id]: 2 } })

    expect(stepper(wrapper).classes()).toContain('quantity-stepper--touch')
  })

  it('el contador conserva el nombre accesible del producto', () => {
    device = mockDevice({ small: true })
    const wrapper = mountPicker({ products: [cafe], inCartIds: [cafe.id], quantities: { [cafe.id]: 2 } })

    expect(minus(wrapper).attributes('aria-label')).toBe('Quitar una pieza de Café de olla')
    expect(plus(wrapper).attributes('aria-label')).toBe('Agregar una pieza de Café de olla')
  })
})

describe('SaleCatalogPicker — pieza única en celular', () => {
  it('sin contador: muestra "En tu venta ✓"', () => {
    device = mockDevice({ small: true })
    const wrapper = mountPicker({ products: [radio], inCartIds: [radio.id], quantities: { [radio.id]: 1 } })

    expect(wrapper.find('.sale-picker__counter').exists()).toBe(false)
    expect(wrapper.get('.sale-picker__mark').text()).toBe('En tu venta ✓')
  })

  it('tocarla de nuevo la QUITA de la venta (emite remove, no select)', async () => {
    device = mockDevice({ small: true })
    const wrapper = mountPicker({ products: [radio], inCartIds: [radio.id], quantities: { [radio.id]: 1 } })

    await wrapper.get('button.sale-picker__item').trigger('click')

    expect(wrapper.emitted('remove')).toEqual([[radio]])
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('el nombre accesible dice que tocarla la quita', () => {
    device = mockDevice({ small: true })
    const wrapper = mountPicker({ products: [radio], inCartIds: [radio.id], quantities: { [radio.id]: 1 } })

    expect(wrapper.get('button.sale-picker__item').attributes('aria-label')).toBe('Quitar Radio vintage de tu venta')
  })

  it('una pieza única que NO está en la venta se agrega al tocarla', async () => {
    device = mockDevice({ small: true })
    const wrapper = mountPicker({ products: [radio] })

    await wrapper.get('button.sale-picker__item').trigger('click')

    expect(wrapper.emitted('select')).toEqual([[radio]])
    expect(wrapper.emitted('remove')).toBeUndefined()
  })

  it('también en la vista Lista', async () => {
    device = mockDevice({ small: true })
    const wrapper = mountPicker({ products: [radio], inCartIds: [radio.id], quantities: { [radio.id]: 1 }, view: 'list' })

    expect(wrapper.get('.sale-picker__mark').text()).toBe('En tu venta ✓')
    await wrapper.get('button.sale-picker__item').trigger('click')
    expect(wrapper.emitted('remove')).toEqual([[radio]])
  })
})

describe('SaleCatalogPicker — pantalla ancha (900 px o más): sin contador', () => {
  it('no hay contador ni "quitar al tocar": la pieza única sigue emitiendo select', async () => {
    device = mockDevice({ small: false })
    const wrapper = mountPicker({ products: [cafe, radio], inCartIds: [cafe.id, radio.id], quantities: { [cafe.id]: 2, [radio.id]: 1 } })

    expect(wrapper.find('.sale-picker__counter').exists()).toBe(false)
    await wrapper.findAll('button.sale-picker__item')[1]!.trigger('click')
    expect(wrapper.emitted('select')).toEqual([[radio]])
    expect(wrapper.emitted('remove')).toBeUndefined()
  })

  it('en la lista, ×N compacto dentro de la fila', () => {
    device = mockDevice({ small: false })
    const wrapper = mountPicker({ products: [cafe], inCartIds: [cafe.id], quantities: { [cafe.id]: 2 }, view: 'list' })

    expect(wrapper.get('button.sale-picker__item .product-card__qty').text()).toBe('×2')
  })
})

describe('SaleCatalogPicker — pista de uso (solo celular)', () => {
  it('con showHint muestra "Toca un producto para agregarlo. Usa − para quitar uno." con su ✕', () => {
    device = mockDevice({ small: true })
    const wrapper = mountPicker({ showHint: true })

    expect(wrapper.get('.dismissible-hint').text()).toContain('Toca un producto para agregarlo. Usa − para quitar uno.')
    expect(wrapper.get('.dismissible-hint button').attributes('aria-label')).toBe('Cerrar aviso')
  })

  it('va ARRIBA del catálogo: antes del buscador', () => {
    device = mockDevice({ small: true })
    const wrapper = mountPicker({ showHint: true })
    const section = wrapper.get('section').element

    expect(section.firstElementChild!.classList.contains('dismissible-hint')).toBe(true)
  })

  it('en pantalla ancha NO se muestra aunque venga showHint', () => {
    device = mockDevice({ small: false })

    expect(mountPicker({ showHint: true }).find('.dismissible-hint').exists()).toBe(false)
  })

  it('sin showHint (ya la cerraron o ya hay productos) no se muestra', () => {
    device = mockDevice({ small: true })

    expect(mountPicker({ showHint: false }).find('.dismissible-hint').exists()).toBe(false)
    expect(mountPicker().find('.dismissible-hint').exists()).toBe(false)
  })

  it('tocar la ✕ emite dismiss-hint', async () => {
    device = mockDevice({ small: true })
    const wrapper = mountPicker({ showHint: true })

    await wrapper.get('.dismissible-hint button').trigger('click')

    expect(wrapper.emitted('dismiss-hint')).toHaveLength(1)
  })

  it('NO implementa gestos de jalar ni deslizar', () => {
    expect(source).not.toMatch(/touchstart|touchmove|touchend|pointermove|swipe|@drag|pull-to/i)
  })
})
