import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { makeProduct } from '@/test/factories'
import SaleCatalogPicker from '../SaleCatalogPicker.vue'

// Vista de cuadrícula o lista. Presentacional: la vista llega por prop y el cambio
// sale como `update:view`; quien guarda la preferencia es el contenedor (store).
// La lista muestra lo mismo que la tarjeta, en filas compactas, con el mismo botón
// (mismas clases base, mismo nombre accesible, mismo "agotado no se elige").

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
type Wrapper = ReturnType<typeof mountPicker>

const cafe = makeProduct({ name: 'Café de olla', unitPriceMinor: 1999 })
const pan = makeProduct({ name: 'Pan dulce', unitPriceMinor: 850 })
const agotado = makeProduct({ name: 'Jarrito', stock: 0 })
const unica = makeProduct({ name: 'Radio vintage', tipo: 'unica', stock: 1, initialStock: 1, unitPriceMinor: 45000 })

const items = (w: Wrapper) => w.findAll('button.sale-picker__item')
const viewGroup = (w: Wrapper) => w.get('[role="group"][aria-label="Vista del catálogo"]')
const viewBtn = (w: Wrapper, view: 'grid' | 'list') => w.get(`button[data-view="${view}"]`)

describe('SaleCatalogPicker — selector de vista', () => {
  it('siempre hay un grupo con nombre y dos botones con texto visible', () => {
    const wrapper = mountPicker({ products: [cafe] })
    expect(viewGroup(wrapper).findAll('button')).toHaveLength(2)
    expect(viewBtn(wrapper, 'grid').text()).toContain('Cuadrícula')
    expect(viewBtn(wrapper, 'list').text()).toContain('Lista')
    for (const view of ['grid', 'list'] as const) {
      expect(viewBtn(wrapper, view).attributes('type')).toBe('button')
    }
  })

  it('sin la prop la vista es la cuadrícula: "Cuadrícula" presionado y "Lista" no', () => {
    const wrapper = mountPicker({ products: [cafe] })
    expect(viewBtn(wrapper, 'grid').attributes('aria-pressed')).toBe('true')
    expect(viewBtn(wrapper, 'list').attributes('aria-pressed')).toBe('false')
  })

  it('con view="list" el estado presionado se invierte', () => {
    const wrapper = mountPicker({ products: [cafe], view: 'list' })
    expect(viewBtn(wrapper, 'grid').attributes('aria-pressed')).toBe('false')
    expect(viewBtn(wrapper, 'list').attributes('aria-pressed')).toBe('true')
  })

  it('tocar la otra vista emite update:view con ella', async () => {
    const wrapper = mountPicker({ products: [cafe] })
    await viewBtn(wrapper, 'list').trigger('click')
    expect(wrapper.emitted('update:view')).toEqual([['list']])
  })

  it('tocar la vista que ya está activa no emite nada', async () => {
    const wrapper = mountPicker({ products: [cafe], view: 'list' })
    await viewBtn(wrapper, 'list').trigger('click')
    expect(wrapper.emitted('update:view')).toBeUndefined()
  })

  it('el selector está también sin productos (para poder cambiarlo antes de que cargue el catálogo)', () => {
    expect(mountPicker({ products: [] }).find('[role="group"][aria-label="Vista del catálogo"]').exists()).toBe(true)
  })
})

describe('SaleCatalogPicker — vista de cuadrícula (la de siempre)', () => {
  it('por defecto muestra la cuadrícula de tarjetas y no la lista', () => {
    const wrapper = mountPicker({ products: [cafe, pan] })
    expect(wrapper.find('ul.sale-picker__grid').exists()).toBe(true)
    expect(wrapper.find('ul.sale-picker__list').exists()).toBe(false)
    expect(wrapper.findAll('.product-card')).toHaveLength(2)
    expect(items(wrapper).every((b) => !b.classes().includes('sale-picker__item--row'))).toBe(true)
  })
})

describe('SaleCatalogPicker — vista de lista', () => {
  const list = (props: Partial<Props> = {}) => mountPicker({ view: 'list', products: [cafe, pan, agotado, unica], ...props })

  it('muestra una lista de filas compactas y no la cuadrícula ni las tarjetas', () => {
    const wrapper = list()
    expect(wrapper.find('ul.sale-picker__list').exists()).toBe(true)
    expect(wrapper.find('ul.sale-picker__grid').exists()).toBe(false)
    expect(wrapper.findAll('.product-card')).toHaveLength(0)
    expect(items(wrapper)).toHaveLength(4)
    expect(items(wrapper).every((b) => b.classes().includes('sale-picker__item--row'))).toBe(true)
  })

  it('cada fila trae nombre, precio exacto y disponibilidad, igual que la tarjeta', () => {
    const [cafeRow, panRow, jarritoRow, radioRow] = items(list())
    expect(cafeRow.text()).toContain('Café de olla')
    expect(cafeRow.text()).toContain('$19.99')
    expect(cafeRow.text()).toContain('Disponible')
    expect(panRow.text()).toContain('$8.50')
    expect(jarritoRow.text()).toContain('Agotado')
    expect(radioRow.text()).toContain('$450.00')
    expect(radioRow.text()).toContain('Disponible')
  })

  it('la disponibilidad es la simplificada de la tarjeta grande (Disponible / Agotado), sin números de existencia', () => {
    expect(list().text()).not.toMatch(/en existencia/)
  })

  it('con imagen la muestra (decorativa) y sin ella pone el 📦', () => {
    const conFoto = makeProduct({ name: 'Con foto', image: '/uploads/products/x.png' })
    const [foto, sinFoto] = items(mountPicker({ view: 'list', products: [conFoto, pan] }))
    expect(foto.get('img').attributes('src')).toBe('/uploads/products/x.png')
    expect(foto.get('img').attributes('alt')).toBe('')
    expect(sinFoto.find('img').exists()).toBe(false)
    expect(sinFoto.text()).toContain('📦')
  })

  it('tocar una fila emite select con el producto (agregar al carrito)', async () => {
    const wrapper = list()
    await items(wrapper)[1].trigger('click')
    expect(wrapper.emitted('select')).toEqual([[pan]])
  })

  it('un agotado no se elige: fila apagada, aria-disabled y sin evento', async () => {
    const wrapper = list()
    const jarrito = items(wrapper)[2]
    expect(jarrito.attributes('aria-disabled')).toBe('true')
    expect(jarrito.classes()).toContain('sale-picker__item--sold-out')
    await jarrito.trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('lo agregado se marca "En tu venta" con texto, y se anuncia en el nombre accesible', () => {
    const wrapper = list({ inCartIds: [pan.id] })
    const panRow = items(wrapper)[1]
    expect(panRow.text()).toContain('En tu venta')
    expect(items(wrapper)[0].text()).not.toContain('En tu venta')
    expect(panRow.attributes('aria-label')).toBe('Agregar Pan dulce, $8.50, ya está en tu venta')
  })

  it('el nombre accesible es el mismo que el de la tarjeta', () => {
    const grid = mountPicker({ products: [cafe, agotado] })
    const rows = list({ products: [cafe, agotado] })
    expect(items(rows).map((b) => b.attributes('aria-label'))).toEqual(items(grid).map((b) => b.attributes('aria-label')))
    expect(items(rows)[0].attributes('aria-label')).toBe('Agregar Café de olla, $19.99')
    expect(items(rows)[1].attributes('aria-label')).toBe('Jarrito, agotado')
  })

  it('cambiar de vista con los mismos productos no pierde ninguno', async () => {
    const wrapper = mountPicker({ products: [cafe, pan, agotado, unica] })
    expect(items(wrapper)).toHaveLength(4)
    await wrapper.setProps({ view: 'list' })
    expect(items(wrapper)).toHaveLength(4)
    await wrapper.setProps({ view: 'grid' })
    expect(items(wrapper)).toHaveLength(4)
  })

  it('los estados vacío, cargando y error se ven igual en las dos vistas', () => {
    for (const view of ['grid', 'list'] as const) {
      expect(mountPicker({ view, products: [], loading: true }).text()).toContain('Cargando tu catálogo')
      expect(mountPicker({ view, products: [], search: 'zzz' }).text()).toContain('No encontramos ese producto.')
      expect(mountPicker({ view, products: [], errorMessage: 'No pudimos conectarnos' }).get('[role="alert"]').text()).toContain('No pudimos conectarnos')
    }
  })
})
