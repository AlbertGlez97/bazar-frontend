import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductCatalogGrid from '../ProductCatalogGrid.vue'
import type { Product } from '@/types/product.types'

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p-1',
  name: 'Producto',
  tipo: 'unica',
  unitPriceMinor: 1000,
  initialStock: 1,
  stock: 1,
  category: null,
  purchaseCostMinor: null,
  supplier: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  active: true,
  image: null,
  ...overrides,
})

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('ProductCatalogGrid', () => {
  it('renderiza una tarjeta por producto', () => {
    const wrapper = mount(ProductCatalogGrid, {
      props: { products: [product({ id: 'p-1' }), product({ id: 'p-2' })], page: 1, totalPages: 1 },
    })
    expect(wrapper.findAll('.product-card').length).toBe(2)
    expect(wrapper.text()).not.toContain('No encontramos productos')
  })

  it('muestra mensaje cuando no hay productos', () => {
    const wrapper = mount(ProductCatalogGrid, { props: { products: [], page: 1, totalPages: 1 } })
    expect(wrapper.text()).toContain('No encontramos productos')
  })

  it('muestra estado de carga', () => {
    const wrapper = mount(ProductCatalogGrid, {
      props: { products: [], page: 1, totalPages: 1, loading: true },
    })
    expect(wrapper.text()).toContain('Cargando tu catálogo')
  })

  it('emite "search" tras el debounce, no en cada tecla', async () => {
    const wrapper = mount(ProductCatalogGrid, { props: { products: [], page: 1, totalPages: 1 } })
    const input = wrapper.find('input')

    await input.setValue('ps')
    expect(wrapper.emitted('search')).toBeUndefined()

    vi.advanceTimersByTime(350)
    expect(wrapper.emitted('search')?.[0]).toEqual(['ps'])
  })

  it('reinicia el temporizador de debounce en cada tecla', async () => {
    const wrapper = mount(ProductCatalogGrid, { props: { products: [], page: 1, totalPages: 1 } })
    const input = wrapper.find('input')

    await input.setValue('p')
    vi.advanceTimersByTime(200)
    await input.setValue('ps')
    vi.advanceTimersByTime(200)
    expect(wrapper.emitted('search')).toBeUndefined()

    vi.advanceTimersByTime(150)
    expect(wrapper.emitted('search')?.[0]).toEqual(['ps'])
  })

  it('emite update:page desde la paginación', async () => {
    const wrapper = mount(ProductCatalogGrid, {
      props: { products: [product()], page: 1, totalPages: 3 },
    })
    const buttons = wrapper.findAll('button')
    const nextButton = buttons.find((b) => b.attributes('aria-label') === 'Página siguiente')
    await nextButton?.trigger('click')
    expect(wrapper.emitted('update:page')?.[0]).toEqual([2])
  })

  it('no muestra el interruptor "Mostrar inactivos" por defecto', () => {
    const wrapper = mount(ProductCatalogGrid, { props: { products: [], page: 1, totalPages: 1 } })
    expect(wrapper.text()).not.toContain('Mostrar inactivos')
  })

  it('muestra el interruptor "Mostrar inactivos" y emite update:includeInactive al activarlo', async () => {
    const wrapper = mount(ProductCatalogGrid, {
      props: { products: [], page: 1, totalPages: 1, showInactiveToggle: true },
    })
    expect(wrapper.text()).toContain('Mostrar inactivos')

    await wrapper.find('input[type="checkbox"]').setValue(true)
    expect(wrapper.emitted('update:includeInactive')?.[0]).toEqual([true])
  })

  describe('modo (mode)', () => {
    const inactive = product({ id: 'p-off', active: false })
    const fullProps = {
      products: [product({ id: 'p-1' }), inactive],
      page: 1,
      totalPages: 3,
      showActions: true,
      showInactiveToggle: true,
    }
    const buttonTexts = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('button').map((b) => b.text())

    it('por defecto es gestión: tarjetas normales, acciones y toggle de inactivos', () => {
      const wrapper = mount(ProductCatalogGrid, { props: fullProps })
      expect(wrapper.get('.product-catalog-grid').classes()).toContain('product-catalog-grid--gestion')
      expect(wrapper.findAll('.product-card--default')).toHaveLength(2)
      expect(wrapper.find('.product-card--large').exists()).toBe(false)
      expect(buttonTexts(wrapper)).toEqual(expect.arrayContaining(['Editar', 'Desactivar', 'Reactivar']))
      expect(wrapper.text()).toContain('Mostrar inactivos')
    })

    it('gestión explícita se comporta igual que el valor por defecto', () => {
      const wrapper = mount(ProductCatalogGrid, { props: { ...fullProps, mode: 'gestion' } })
      expect(wrapper.findAll('.product-card__footer')).toHaveLength(2)
      expect(wrapper.text()).toContain('Mostrar inactivos')
    })

    it('gestión mantiene la regla de colaborador: sin acciones si showActions es false', () => {
      const wrapper = mount(ProductCatalogGrid, {
        props: { ...fullProps, mode: 'gestion', showActions: false, showInactiveToggle: false },
      })
      expect(wrapper.find('.product-card__footer').exists()).toBe(false)
      expect(wrapper.text()).not.toContain('Mostrar inactivos')
    })

    it('venta usa tarjetas grandes', () => {
      const wrapper = mount(ProductCatalogGrid, { props: { ...fullProps, mode: 'venta' } })
      expect(wrapper.get('.product-catalog-grid').classes()).toContain('product-catalog-grid--venta')
      expect(wrapper.findAll('.product-card--large')).toHaveLength(2)
      expect(wrapper.find('.product-card--default').exists()).toBe(false)
    })

    it('venta oculta editar, desactivar y reactivar aunque el padre las habilite (socio)', () => {
      const wrapper = mount(ProductCatalogGrid, { props: { ...fullProps, mode: 'venta' } })
      expect(wrapper.find('.product-card__footer').exists()).toBe(false)
      const texts = buttonTexts(wrapper)
      expect(texts).not.toContain('Editar')
      expect(texts).not.toContain('Desactivar')
      expect(texts).not.toContain('Reactivar')
    })

    it('venta oculta "Mostrar inactivos" aunque el padre lo habilite', () => {
      const wrapper = mount(ProductCatalogGrid, { props: { ...fullProps, mode: 'venta' } })
      expect(wrapper.text()).not.toContain('Mostrar inactivos')
      expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
    })

    it('venta agranda el buscador (size lg) y lo mantiene visible y funcional', async () => {
      const wrapper = mount(ProductCatalogGrid, { props: { ...fullProps, mode: 'venta' } })
      const input = wrapper.get('input')
      expect(input.classes()).toContain('app-input--lg')

      await input.setValue('ps')
      vi.advanceTimersByTime(350)
      expect(wrapper.emitted('search')?.[0]).toEqual(['ps'])
    })

    it('gestión mantiene el buscador de tamaño normal', () => {
      const wrapper = mount(ProductCatalogGrid, { props: { ...fullProps, mode: 'gestion' } })
      expect(wrapper.get('input').classes()).toContain('app-input--md')
    })

    it('venta usa paginación táctil (lg) y gestión la normal', () => {
      const venta = mount(ProductCatalogGrid, { props: { ...fullProps, mode: 'venta' } })
      expect(venta.get('nav.app-pagination').classes()).toContain('app-pagination--lg')

      const gestion = mount(ProductCatalogGrid, { props: { ...fullProps, mode: 'gestion' } })
      expect(gestion.get('nav.app-pagination').classes()).toContain('app-pagination--md')
    })

    it('venta sigue emitiendo el cambio de página', async () => {
      const wrapper = mount(ProductCatalogGrid, { props: { ...fullProps, mode: 'venta' } })
      await wrapper.findAll('button').find((b) => b.attributes('aria-label') === 'Página siguiente')?.trigger('click')
      expect(wrapper.emitted('update:page')?.[0]).toEqual([2])
    })
  })

  it('reenvía edit/deactivate/reactivate desde ProductCard', async () => {
    const p = product({ id: 'p-9' })
    const wrapper = mount(ProductCatalogGrid, {
      props: { products: [p], page: 1, totalPages: 1, showActions: true },
    })
    const editButton = wrapper.findAll('button').find((b) => b.text() === 'Editar')
    await editButton?.trigger('click')
    expect(wrapper.emitted('edit')?.[0]).toEqual([p])
  })
})
