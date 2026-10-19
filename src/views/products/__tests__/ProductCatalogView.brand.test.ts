// Filtro por marca en Gestión: URL, petición al servidor, chip y sugerencias.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import ProductCatalogView from '../ProductCatalogView.vue'
import ProductsService from '@/services/products.service'
import { useSessionStore } from '@/stores/session.store'
import { makeProduct } from '@/test/factories'

vi.mock('@/services/products.service', () => ({
  default: {
    listProducts: vi.fn(), getSuggestions: vi.fn(), createProduct: vi.fn(), updateProduct: vi.fn(),
    uploadProductImage: vi.fn(), deactivateProduct: vi.fn(), reactivateProduct: vi.fn(),
  },
}))

const lastListCall = () => vi.mocked(ProductsService.listProducts).mock.calls.at(-1)?.[0]
const makeRouter = () => createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/app/productos', name: 'ProductCatalog', component: ProductCatalogView }],
})

async function mountAt(url: string, role: 'socio' | 'colaborador' = 'socio') {
  useSessionStore().setMember({ id: 'm-1', name: 'Ana', role, active: true })
  const router = makeRouter()
  await router.push(url)
  await router.isReady()
  const wrapper = mount(ProductCatalogView, { global: { plugins: [router], stubs: { teleport: true } } })
  await flushPromises()
  return { wrapper, router }
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.clearAllMocks()
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock')
  globalThis.URL.revokeObjectURL = vi.fn()
  vi.mocked(ProductsService.listProducts).mockResolvedValue({ items: [makeProduct()], total: 1, page: 1, limit: 20 })
  vi.mocked(ProductsService.getSuggestions).mockResolvedValue({ brands: ['Adidas', 'Nike'], presentations: [] })
})

describe('ProductCatalogView — marca', () => {
  it('?marca=Nike de la URL llega al servidor como brand y se ve como chip', async () => {
    const { wrapper } = await mountAt('/app/productos?marca=Nike')

    expect(lastListCall()).toMatchObject({ brand: 'Nike' })
    expect(wrapper.text()).toContain('Marca: Nike')
  })

  it('sin marca en la URL no se manda brand (catálogo completo)', async () => {
    await mountAt('/app/productos')

    expect(lastListCall()?.brand).toBeUndefined()
  })

  it('escribir la marca en el panel y confirmar la pone en la URL y pide la lista', async () => {
    const { wrapper, router } = await mountAt('/app/productos')
    await wrapper.get('button[aria-haspopup="dialog"]').trigger('click')
    const label = wrapper.findAll('label').find((l) => l.text().startsWith('Marca') && l.attributes('for'))!
    const field = wrapper.get(`[id="${label.attributes('for')}"]`)

    await field.setValue('Nike')
    await flushPromises()

    expect(router.currentRoute.value.query.marca).toBe('Nike')
    expect(lastListCall()).toMatchObject({ brand: 'Nike' })
  })

  it('quitar el chip vuelve al catálogo completo', async () => {
    const { wrapper, router } = await mountAt('/app/productos?marca=Nike')

    await wrapper.get('[aria-label="Quitar filtro Marca: Nike"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query.marca).toBeUndefined()
    expect(lastListCall()?.brand).toBeUndefined()
  })

  it('un socio ve las marcas conocidas como sugerencias en el panel', async () => {
    const { wrapper } = await mountAt('/app/productos')
    await wrapper.get('button[aria-haspopup="dialog"]').trigger('click')
    const label = wrapper.findAll('label').find((l) => l.text().startsWith('Marca') && l.attributes('for'))!
    const list = wrapper.get(`[id="${label.attributes('for')}"]`).attributes('list')!

    expect(wrapper.findAll(`[id="${list}"] option`).map((o) => o.attributes('value'))).toEqual(['Adidas', 'Nike'])
  })

  it('un colaborador puede filtrar por marca, sin sugerencias (no puede pedirlas)', async () => {
    const { wrapper } = await mountAt('/app/productos?marca=Nike', 'colaborador')
    await wrapper.get('button[aria-haspopup="dialog"]').trigger('click')
    const label = wrapper.findAll('label').find((l) => l.text().startsWith('Marca') && l.attributes('for'))!

    expect(lastListCall()).toMatchObject({ brand: 'Nike' })
    expect(wrapper.get(`[id="${label.attributes('for')}"]`).attributes('list')).toBeUndefined()
    expect(ProductsService.getSuggestions).not.toHaveBeenCalled()
  })
})
