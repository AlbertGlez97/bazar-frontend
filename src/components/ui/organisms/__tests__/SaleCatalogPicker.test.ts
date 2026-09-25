import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { makeProduct } from '@/test/factories'
import SaleCatalogPicker from '../SaleCatalogPicker.vue'
import type { Product } from '@/types/product.types'

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

const cafe = makeProduct({ name: 'Café de olla', unitPriceMinor: 1999 })
const pan = makeProduct({ name: 'Pan dulce', unitPriceMinor: 850 })
const agotado = makeProduct({ name: 'Jarrito', stock: 0 })
const unica = makeProduct({ name: 'Radio vintage', tipo: 'unica', stock: 1, initialStock: 1, unitPriceMinor: 45000 })

const items = (w: ReturnType<typeof mountPicker>) => w.findAll('button.sale-picker__item')

describe('SaleCatalogPicker — búsqueda y escaneo', () => {
  it('el buscador siempre está visible, con nombre accesible y sin debounce', async () => {
    const wrapper = mountPicker()
    const input = wrapper.get('input[type="search"]')
    expect(input.attributes('aria-label')).toBe('Buscar producto')
    expect(input.attributes('placeholder')).toBe('Buscar producto')

    await input.setValue('caf')
    expect(wrapper.emitted('update:search')).toEqual([['caf']])
  })

  it('refleja la búsqueda que llega por props', () => {
    const wrapper = mountPicker({ search: 'pan' })
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('pan')
  })

  it('"Escanear" es un botón con ícono y texto junto al buscador y emite scan', async () => {
    const wrapper = mountPicker()
    const scan = wrapper.get('button[data-action="scan"]')
    expect(scan.text()).toContain('Escanear')
    expect(scan.attributes('type')).toBe('button')
    await scan.trigger('click')
    expect(wrapper.emitted('scan')).toHaveLength(1)
  })
})

describe('SaleCatalogPicker — categorías', () => {
  it('con categorías muestra el filtro y emite la elegida', async () => {
    const wrapper = mountPicker({ categories: ['Bebidas', 'Pan'], products: [cafe] })
    const buttons = wrapper.get('.category-filter').findAll('button')
    expect(buttons.map((b) => b.text())).toEqual(['Todo', 'Bebidas', 'Pan'])
    await buttons[1].trigger('click')
    expect(wrapper.emitted('update:category')).toEqual([['Bebidas']])
  })

  it('sin categorías no dibuja el filtro', () => {
    expect(mountPicker({ categories: [], products: [cafe] }).find('.category-filter').exists()).toBe(false)
  })

  it('marca la categoría activa', () => {
    const wrapper = mountPicker({ categories: ['Bebidas', 'Pan'], category: 'Pan', products: [cafe] })
    expect(wrapper.get('.category-filter__btn--active').text()).toBe('Pan')
  })
})

describe('SaleCatalogPicker — productos', () => {
  it('cada producto es un botón con nombre, precio y disponibilidad', () => {
    const wrapper = mountPicker({ products: [cafe, pan] })
    expect(items(wrapper)).toHaveLength(2)
    expect(items(wrapper)[0].text()).toContain('Café de olla')
    expect(items(wrapper)[0].text()).toContain('$19.99')
    expect(items(wrapper)[0].attributes('type')).toBe('button')
    expect(items(wrapper)[0].attributes('aria-label')).toBe('Agregar Café de olla, $19.99')
  })

  it('tocar un producto disponible emite select con el producto', async () => {
    const wrapper = mountPicker({ products: [cafe, pan] })
    await items(wrapper)[1].trigger('click')
    expect(wrapper.emitted('select')).toEqual([[pan]])
  })

  it('un producto agotado dice "Agotado", está aria-disabled y no se puede elegir', async () => {
    const wrapper = mountPicker({ products: [agotado] })
    const item = items(wrapper)[0]
    expect(item.text()).toContain('Agotado')
    expect(item.attributes('aria-disabled')).toBe('true')
    expect(item.attributes('aria-label')).toBe('Jarrito, agotado')
    expect(item.classes()).toContain('sale-picker__item--sold-out')

    await item.trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('un producto disponible NO está aria-disabled', () => {
    expect(items(mountPicker({ products: [cafe] }))[0].attributes('aria-disabled')).toBeUndefined()
  })

  it('los que ya están en la venta llevan una marca "En tu venta" (con texto, no solo color)', () => {
    const wrapper = mountPicker({ products: [cafe, unica], inCartIds: [unica.id] })
    expect(items(wrapper)[0].find('.sale-picker__mark').exists()).toBe(false)
    expect(items(wrapper)[1].get('.sale-picker__mark').text()).toBe('En tu venta')
    expect(items(wrapper)[1].attributes('aria-label')).toContain('ya está en tu venta')
  })

  it('una pieza única en la venta sigue emitiendo select (el contenedor explica por qué no se repite)', async () => {
    const wrapper = mountPicker({ products: [unica], inCartIds: [unica.id] })
    await items(wrapper)[0].trigger('click')
    expect(wrapper.emitted('select')).toEqual([[unica]])
  })

  it('las tarjetas usan el tamaño grande de Modo Venta (ProductCard large)', () => {
    const wrapper = mountPicker({ products: [cafe] })
    expect(wrapper.find('.product-card--large').exists()).toBe(true)
  })

  it('no aparecen acciones de gestión (editar, desactivar) en las tarjetas', () => {
    const wrapper = mountPicker({ products: [cafe] })
    expect(wrapper.text()).not.toMatch(/Editar|Desactivar|Reactivar/)
  })
})

describe('SaleCatalogPicker — estados', () => {
  it('cargando sin productos: aviso amable en región viva', () => {
    const wrapper = mountPicker({ loading: true })
    const status = wrapper.get('.sale-picker__status')
    expect(status.text()).toBe('Cargando tu catálogo…')
    expect(status.attributes('role')).toBe('status')
  })

  it('recargando con productos a la vista: se siguen viendo', () => {
    const wrapper = mountPicker({ loading: true, products: [cafe] })
    expect(items(wrapper)).toHaveLength(1)
    expect(wrapper.text()).not.toContain('Cargando tu catálogo…')
  })

  it('búsqueda sin resultados: "No encontramos ese producto."', () => {
    const wrapper = mountPicker({ search: 'zzz', products: [] })
    expect(wrapper.get('.sale-picker__status').text()).toBe('No encontramos ese producto.')
  })

  it('categoría sin resultados también usa ese mensaje', () => {
    const wrapper = mountPicker({ category: 'Ropa', categories: ['Ropa'], products: [] })
    expect(wrapper.get('.sale-picker__status').text()).toBe('No encontramos ese producto.')
  })

  it('catálogo vacío sin filtros: mensaje distinto, sin culpar', () => {
    const wrapper = mountPicker({ products: [] })
    expect(wrapper.get('.sale-picker__status').text()).toBe('Todavía no hay productos para vender.')
  })

  it('error sin catálogo: mensaje amable y botón para intentar de nuevo', async () => {
    const wrapper = mountPicker({ errorMessage: 'No pudimos conectarnos. Revisa tu internet e intenta de nuevo.' })
    expect(wrapper.get('[role="alert"]').text()).toContain('No pudimos conectarnos')
    await wrapper.get('button[data-action="retry"]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('con catálogo guardado avisa suave, en región viva educada (no alerta)', () => {
    const wrapper = mountPicker({
      products: [cafe],
      fromSnapshot: true,
      snapshotSavedAt: new Date(2026, 8, 25, 10, 5).toISOString(),
    })
    const notice = wrapper.get('.sale-picker__notice')
    expect(notice.text()).toMatch(/Estás viendo el catálogo guardado/)
    expect(notice.attributes('role')).toBe('status')
  })

  it('con datos frescos no hay aviso', () => {
    expect(mountPicker({ products: [cafe], fromSnapshot: false }).find('.sale-picker__notice').exists()).toBe(false)
  })

  it('el aviso de catálogo guardado aparece aunque la búsqueda no encuentre nada', () => {
    const wrapper = mountPicker({ products: [] as Product[], search: 'x', fromSnapshot: true, snapshotSavedAt: null })
    expect(wrapper.find('.sale-picker__notice').exists()).toBe(true)
  })
})
