import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import ProductCatalogView from '../ProductCatalogView.vue'
import ProductsService from '@/services/products.service'
import { useProductsStore } from '@/stores/products.store'
import { useSessionStore } from '@/stores/session.store'
import { useUiModeStore } from '@/stores/uiMode.store'
import type { Product } from '@/types/product.types'

vi.mock('@/services/products.service', () => ({
  default: {
    listProducts: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    uploadProductImage: vi.fn(),
    deactivateProduct: vi.fn(),
    reactivateProduct: vi.fn(),
  },
}))

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p-1', name: 'Producto', tipo: 'unica', unitPriceMinor: 1000, initialStock: 1, stock: 1,
  category: null, purchaseCostMinor: null, supplier: null, notes: null,
  createdAt: '2026-01-01T00:00:00.000Z', active: true, image: null, ...overrides,
})

type ViewWrapper = ReturnType<typeof mount>

function setMember(role: 'socio' | 'colaborador') {
  useSessionStore().setMember({ id: 'm-1', name: 'Ana', role, active: true })
}

const lastListCall = () => vi.mocked(ProductsService.listProducts).mock.calls.at(-1)?.[0]
const filtersButton = (wrapper: ViewWrapper) => wrapper.find('button[aria-haspopup="dialog"]')

async function openFilters(wrapper: ViewWrapper) {
  if (!wrapper.find('[role="dialog"]').exists()) await filtersButton(wrapper).trigger('click')
}

function filterSwitch(wrapper: ViewWrapper, label: string) {
  const row = wrapper.findAll('.filter-switch-row').find((r) => r.text() === label)
  if (!row) throw new Error(`No hay fila de filtro "${label}"`)
  return row.get('input[type="checkbox"]')
}

const makeRouter = () => createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/app/productos', name: 'ProductCatalog', component: ProductCatalogView }],
})

async function mountAt(url: string, router = makeRouter()) {
  await router.push(url)
  await router.isReady()
  const wrapper = mount(ProductCatalogView, { global: { plugins: [router], stubs: { teleport: true } } })
  await vi.waitFor(() => expect(ProductsService.listProducts).toHaveBeenCalled())
  return { wrapper, router }
}

// Sin router instalado la vista guarda los filtros en memoria (misma interfaz).
const mountPlain = () => mount(ProductCatalogView, { global: { stubs: { teleport: true } } })

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.clearAllMocks()
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock')
  globalThis.URL.revokeObjectURL = vi.fn()
  vi.mocked(ProductsService.listProducts).mockResolvedValue({ items: [product()], total: 1, page: 1, limit: 20 })
})

describe('ProductCatalogView — panel de filtros', () => {
  it('el botón "Filtros" queda en la barra del buscador y el interruptor suelto del fondo desapareció', async () => {
    setMember('socio')
    const wrapper = mountPlain()
    await vi.waitFor(() => expect(ProductsService.listProducts).toHaveBeenCalled())

    const toolbar = wrapper.get('.product-catalog-grid__toolbar')
    expect(toolbar.find('input[placeholder="Buscar productos..."]').exists()).toBe(true)
    expect(toolbar.find('button[aria-haspopup="dialog"]').exists()).toBe(true)
    expect(toolbar.find('button[data-view="grid"]').exists()).toBe(true)
    expect(wrapper.find('.product-catalog-view__low-stock').exists()).toBe(false)
  })

  it.each([
    ['Poca existencia', { umbral: 2 }],
    ['Agotados', { agotados: true }],
    ['Mostrar inactivos', { includeInactive: true }],
    ['Única', { tipo: 'unica' }],
    ['Por cantidad', { tipo: 'cantidad' }],
    ['Sin costo de compra', { sinCosto: true }],
  ])('encender "%s" pide ese filtro al servidor, desde la página 1', async (label, expected) => {
    setMember('socio')
    vi.mocked(ProductsService.listProducts).mockResolvedValue({ items: [product()], total: 60, page: 3, limit: 20 })
    const wrapper = mountPlain()
    await vi.waitFor(() => expect(filtersButton(wrapper).exists()).toBe(true))
    await openFilters(wrapper)

    await filterSwitch(wrapper, label).setValue(true)

    await vi.waitFor(() => expect(lastListCall()).toEqual(expect.objectContaining({ page: 1, ...expected })))
  })

  it('los filtros se combinan en una sola petición', async () => {
    setMember('socio')
    const wrapper = mountPlain()
    await vi.waitFor(() => expect(filtersButton(wrapper).exists()).toBe(true))
    await openFilters(wrapper)

    await filterSwitch(wrapper, 'Agotados').setValue(true)
    await filterSwitch(wrapper, 'Sin costo de compra').setValue(true)
    await filterSwitch(wrapper, 'Por cantidad').setValue(true)

    await vi.waitFor(() => expect(lastListCall()).toEqual(expect.objectContaining({
      agotados: true, sinCosto: true, tipo: 'cantidad',
    })))
  })

  it('la insignia y los chips reflejan los filtros activos', async () => {
    setMember('socio')
    const wrapper = mountPlain()
    await vi.waitFor(() => expect(filtersButton(wrapper).exists()).toBe(true))
    expect(wrapper.find('[aria-label="Filtros activos"]').exists()).toBe(false)
    await openFilters(wrapper)

    await filterSwitch(wrapper, 'Agotados').setValue(true)
    await filterSwitch(wrapper, 'Única').setValue(true)

    expect(filtersButton(wrapper).attributes('aria-label')).toBe('Filtros, 2 filtros activos')
    expect(filtersButton(wrapper).get('.product-filters-panel__count').text()).toBe('2')
    const chips = wrapper.get('[aria-label="Filtros activos"]').findAll('li').map((li) => li.text())
    expect(chips).toEqual(['Agotados×', 'Única×'])
  })

  it('la X de un chip quita ese filtro y recarga', async () => {
    setMember('socio')
    const wrapper = mountPlain()
    await vi.waitFor(() => expect(filtersButton(wrapper).exists()).toBe(true))
    await openFilters(wrapper)
    await filterSwitch(wrapper, 'Agotados').setValue(true)
    await filterSwitch(wrapper, 'Sin costo de compra').setValue(true)
    await vi.waitFor(() => expect(lastListCall()?.agotados).toBe(true))

    await wrapper.get('[aria-label="Quitar filtro Agotados"]').trigger('click')

    await vi.waitFor(() => expect(lastListCall()?.agotados).toBeUndefined())
    expect(lastListCall()?.sinCosto).toBe(true)
    expect(wrapper.find('[aria-label="Quitar filtro Agotados"]').exists()).toBe(false)
    expect(filtersButton(wrapper).attributes('aria-label')).toBe('Filtros, 1 filtro activo')
  })

  it('"Limpiar filtros" restablece todo y recarga el catálogo completo', async () => {
    setMember('socio')
    const wrapper = mountPlain()
    await vi.waitFor(() => expect(filtersButton(wrapper).exists()).toBe(true))
    await openFilters(wrapper)
    await filterSwitch(wrapper, 'Poca existencia').setValue(true)
    await filterSwitch(wrapper, 'Mostrar inactivos').setValue(true)
    await filterSwitch(wrapper, 'Única').setValue(true)
    await vi.waitFor(() => expect(lastListCall()?.tipo).toBe('unica'))

    await wrapper.findAll('button').find((b) => b.text() === 'Limpiar filtros')!.trigger('click')

    await vi.waitFor(() => expect(lastListCall()?.tipo).toBeUndefined())
    expect(lastListCall()).toEqual(expect.objectContaining({ page: 1 }))
    expect(lastListCall()?.umbral).toBeUndefined()
    expect(lastListCall()?.includeInactive).toBeUndefined()
    expect(wrapper.find('[aria-label="Filtros activos"]').exists()).toBe(false)
    expect(filtersButton(wrapper).attributes('aria-label')).toBe('Filtros')
  })

  it('cambiar un filtro conserva la búsqueda en curso', async () => {
    setMember('socio')
    const wrapper = mountPlain()
    await vi.waitFor(() => expect(filtersButton(wrapper).exists()).toBe(true))
    await useProductsStore().fetchProducts({ search: 'lámpara' })

    await openFilters(wrapper)
    await filterSwitch(wrapper, 'Agotados').setValue(true)

    await vi.waitFor(() => expect(lastListCall()).toEqual(expect.objectContaining({ search: 'lámpara', agotados: true })))
  })

  describe('URL (query params)', () => {
    it('los filtros se escriben en la URL al cambiarlos', async () => {
      setMember('socio')
      const { wrapper, router } = await mountAt('/app/productos')
      await openFilters(wrapper)

      await filterSwitch(wrapper, 'Agotados').setValue(true)
      await filterSwitch(wrapper, 'Única').setValue(true)

      await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({ agotados: '1', tipo: 'unica' }))
    })

    it('al recargar (montar de nuevo con la misma URL) el estado se conserva', async () => {
      setMember('socio')
      const first = await mountAt('/app/productos')
      await openFilters(first.wrapper)
      await filterSwitch(first.wrapper, 'Sin costo de compra').setValue(true)
      await filterSwitch(first.wrapper, 'Por cantidad').setValue(true)
      await vi.waitFor(() => expect(first.router.currentRoute.value.query).toEqual({ sinCosto: '1', tipo: 'cantidad' }))
      const url = first.router.currentRoute.value.fullPath
      first.wrapper.unmount()
      setActivePinia(createPinia())
      setMember('socio')
      vi.mocked(ProductsService.listProducts).mockClear()

      const reloaded = await mountAt(url)

      expect(lastListCall()).toEqual(expect.objectContaining({ sinCosto: true, tipo: 'cantidad' }))
      expect(filtersButton(reloaded.wrapper).attributes('aria-label')).toBe('Filtros, 2 filtros activos')
      await openFilters(reloaded.wrapper)
      expect((filterSwitch(reloaded.wrapper, 'Sin costo de compra').element as HTMLInputElement).checked).toBe(true)
      expect((filterSwitch(reloaded.wrapper, 'Por cantidad').element as HTMLInputElement).checked).toBe(true)
    })

    it('la tarjeta "Poca existencia" de Inicio (?pocaExistencia=1) llega con el filtro puesto, en el botón y en los chips', async () => {
      setMember('colaborador')
      const { wrapper } = await mountAt('/app/productos?pocaExistencia=1')

      expect(lastListCall()?.umbral).toBe(2)
      expect(filtersButton(wrapper).attributes('aria-label')).toBe('Filtros, 1 filtro activo')
      expect(wrapper.get('[aria-label="Filtros activos"]').text()).toContain('Poca existencia')
    })

    it('?inactivos=1 lo respeta un socio y lo ignora un colaborador', async () => {
      setMember('socio')
      await mountAt('/app/productos?inactivos=1')
      expect(lastListCall()?.includeInactive).toBe(true)

      setActivePinia(createPinia())
      vi.mocked(ProductsService.listProducts).mockClear()
      setMember('colaborador')
      await mountAt('/app/productos?inactivos=1')
      expect(lastListCall()?.includeInactive).toBeUndefined()
    })

    it('en Modo Venta los filtros de la URL no se aplican ni se ofrecen', async () => {
      setMember('socio')
      useUiModeStore().setMode('venta')
      const { wrapper } = await mountAt('/app/productos?agotados=1&pocaExistencia=1')

      expect(lastListCall()?.agotados).toBeUndefined()
      expect(lastListCall()?.umbral).toBeUndefined()
      expect(filtersButton(wrapper).exists()).toBe(false)
    })
  })
})
