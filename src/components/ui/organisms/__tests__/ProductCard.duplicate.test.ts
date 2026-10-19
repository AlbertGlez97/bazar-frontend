// Acción "Crear otro igual" en la tarjeta (cuadrícula), la fila (lista) y el modal de edición.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductCard from '../ProductCard.vue'
import ProductCatalogGrid from '../ProductCatalogGrid.vue'
import ProductFormModal from '../ProductFormModal.vue'
import { makeProduct } from '@/test/factories'
import { duplicateDraft } from '@/utils/product-duplicate'

beforeEach(() => {
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock')
  globalThis.URL.revokeObjectURL = vi.fn()
})

const duplicateButton = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('button').find((b) => b.text() === 'Crear otro igual')

describe('ProductCard — acción "Crear otro igual"', () => {
  it('con acciones habilitadas (socio) la ofrece', () => {
    const wrapper = mount(ProductCard, { props: { product: makeProduct(), showActions: true } })

    expect(duplicateButton(wrapper)).toBeDefined()
  })

  it('sin acciones (colaborador, o Modo Venta) no existe', () => {
    const wrapper = mount(ProductCard, { props: { product: makeProduct(), showActions: false } })

    expect(duplicateButton(wrapper)).toBeUndefined()
  })

  it('su nombre accesible dice de qué producto es', () => {
    const wrapper = mount(ProductCard, { props: { product: makeProduct({ name: 'Playera' }), showActions: true } })

    expect(duplicateButton(wrapper)!.attributes('aria-label')).toBe('Crear otro igual que Playera')
  })

  it('al tocarla emite duplicate con el producto', async () => {
    const item = makeProduct()
    const wrapper = mount(ProductCard, { props: { product: item, showActions: true } })

    await duplicateButton(wrapper)!.trigger('click')

    expect(wrapper.emitted('duplicate')).toEqual([[item]])
  })

  it.each(['default', 'list'] as const)('en el tamaño %s', (size) => {
    const wrapper = mount(ProductCard, { props: { product: makeProduct(), showActions: true, size } })

    expect(duplicateButton(wrapper)).toBeDefined()
  })

  it('un producto desactivado también se puede copiar', () => {
    const wrapper = mount(ProductCard, { props: { product: makeProduct({ active: false }), showActions: true } })

    expect(duplicateButton(wrapper)).toBeDefined()
  })

  it('una pieza única también (otra talla del mismo modelo)', () => {
    const wrapper = mount(ProductCard, { props: { product: makeProduct({ tipo: 'unica', stock: 1 }), showActions: true } })

    expect(duplicateButton(wrapper)).toBeDefined()
  })
})

describe('ProductCatalogGrid — reenvía duplicate', () => {
  it('con el producto de la tarjeta tocada', async () => {
    const items = [makeProduct({ name: 'A' }), makeProduct({ name: 'B' })]
    const wrapper = mount(ProductCatalogGrid, { props: { products: items, page: 1, totalPages: 1, showActions: true } })

    await wrapper.findAll('.product-card')[1].findAll('button').find((b) => b.text() === 'Crear otro igual')!.trigger('click')

    expect(wrapper.emitted('duplicate')).toEqual([[items[1]]])
  })

  it('en Modo Venta no hay botón', () => {
    const wrapper = mount(ProductCatalogGrid, { props: { products: [makeProduct()], page: 1, totalPages: 1, showActions: true, mode: 'venta' } })

    expect(duplicateButton(wrapper)).toBeUndefined()
  })
})

describe('ProductFormModal con un borrador', () => {
  const mountOptions = { global: { stubs: { teleport: true } } }
  const draft = duplicateDraft(makeProduct({ name: 'Playera', purchaseCostMinor: 100 }))

  it('se titula "Crear otro igual", precarga el borrador y no ofrece QR (aún no hay producto)', () => {
    const wrapper = mount(ProductFormModal, { props: { modelValue: true, draft }, ...mountOptions })

    expect(wrapper.text()).toContain('Crear otro igual')
    expect((wrapper.get('input[type="text"]').element as HTMLInputElement).value).toBe('Playera')
    expect(wrapper.find('img[alt^="Código QR"]').exists()).toBe(false)
  })

  it('sin borrador sigue titulándose "Nuevo producto"', () => {
    const wrapper = mount(ProductFormModal, { props: { modelValue: true }, ...mountOptions })

    expect(wrapper.text()).toContain('Nuevo producto')
  })

  it('reenvía submit-and-duplicate y duplicate del formulario', async () => {
    const edit = mount(ProductFormModal, { props: { modelValue: true, product: makeProduct({ purchaseCostMinor: 100 }) }, ...mountOptions })
    await edit.findAll('button').find((b) => b.text() === 'Crear otro igual')!.trigger('click')
    expect(edit.emitted('duplicate')).toHaveLength(1)

    const create = mount(ProductFormModal, { props: { modelValue: true, draft }, ...mountOptions })
    const label = create.findAll('label').find((l) => l.text().startsWith('Existencia inicial'))!
    await create.get(`[id="${label.attributes('for')}"]`).setValue('2')
    await create.findAll('button').find((b) => b.text() === 'Guardar y crear otro igual')!.trigger('click')
    expect(create.emitted('submit-and-duplicate')).toHaveLength(1)
  })
})
