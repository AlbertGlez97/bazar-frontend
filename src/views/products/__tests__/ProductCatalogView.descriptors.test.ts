// Marca, presentación y descripción en Gestión: sugerencias y envío.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ProductCatalogView from '../ProductCatalogView.vue'
import ProductsService from '@/services/products.service'
import { useSessionStore } from '@/stores/session.store'
import { makeProduct } from '@/test/factories'

vi.mock('@/services/products.service', () => ({
  default: {
    listProducts: vi.fn(),
    getSuggestions: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    uploadProductImage: vi.fn(),
    deactivateProduct: vi.fn(),
    reactivateProduct: vi.fn(),
  },
}))

const mountOptions = { global: { stubs: { teleport: true } } }

function setMember(role: 'socio' | 'colaborador') {
  useSessionStore().setMember({ id: 'm-1', name: 'Ana', role, active: true })
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.clearAllMocks()
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock')
  globalThis.URL.revokeObjectURL = vi.fn()
  vi.mocked(ProductsService.listProducts).mockResolvedValue({ items: [makeProduct({ name: 'Playera' })], total: 1, page: 1, limit: 20 })
  vi.mocked(ProductsService.getSuggestions).mockResolvedValue({ brands: ['Adidas', 'Nike'], presentations: ['24 oz', 'XL'] })
})

const optionsOf = (wrapper: ReturnType<typeof mount>, label: string) => {
  const field = wrapper.findAll('label').find((l) => l.text().startsWith(label))!
  const input = wrapper.get(`[id="${field.attributes('for')}"]`)
  return wrapper.findAll(`[id="${input.attributes('list')}"] option`).map((o) => o.attributes('value'))
}

describe('ProductCatalogView — sugerencias de marca y presentación', () => {
  it('un socio las pide al entrar y llegan al formulario', async () => {
    setMember('socio')
    const wrapper = mount(ProductCatalogView, mountOptions)
    await flushPromises()
    await wrapper.findAll('button').find((b) => b.text().includes('Nuevo producto'))!.trigger('click')

    expect(ProductsService.getSuggestions).toHaveBeenCalledOnce()
    expect(optionsOf(wrapper, 'Marca')).toEqual(['Adidas', 'Nike'])
    expect(optionsOf(wrapper, 'Presentación')).toEqual(['24 oz', 'XL'])
  })

  it('un colaborador NO las pide (el servidor lo rechazaría con 403)', async () => {
    setMember('colaborador')
    mount(ProductCatalogView, mountOptions)
    await flushPromises()

    expect(ProductsService.getSuggestions).not.toHaveBeenCalled()
  })

  it('si no se pueden traer, el formulario sigue funcionando con texto libre', async () => {
    vi.mocked(ProductsService.getSuggestions).mockRejectedValue(new Error('sin red'))
    setMember('socio')
    const wrapper = mount(ProductCatalogView, mountOptions)
    await flushPromises()
    await wrapper.findAll('button').find((b) => b.text().includes('Nuevo producto'))!.trigger('click')

    expect(optionsOf(wrapper, 'Marca')).toEqual([])
  })

  it('al crear un producto con una marca nueva, las sugerencias se vuelven a pedir', async () => {
    setMember('socio')
    vi.mocked(ProductsService.createProduct).mockResolvedValue(makeProduct({ brand: 'Puma' }))
    const wrapper = mount(ProductCatalogView, mountOptions)
    await flushPromises()
    await wrapper.findAll('button').find((b) => b.text().includes('Nuevo producto'))!.trigger('click')
    const id = (text: string) => wrapper.findAll('label').find((l) => l.text().startsWith(text))!.attributes('for')!
    await wrapper.get(`[id="${id('Nombre')}"]`).setValue('Playera')
    const decimals = wrapper.findAll('input').filter((i) => i.attributes('inputmode') === 'decimal')
    await decimals[0].setValue('150')
    await decimals[1].setValue('90')
    await wrapper.get(`[id="${id('Marca')}"]`).setValue('Puma')

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(ProductsService.createProduct).toHaveBeenCalledWith(expect.objectContaining({ name: 'Playera', brand: 'Puma' }))
    expect(ProductsService.getSuggestions).toHaveBeenCalledTimes(2)
  })
})
