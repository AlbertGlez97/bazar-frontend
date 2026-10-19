// "Crear otro igual" en Gestión: desde la tarjeta y desde el modal de edición.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ProductCatalogView from '../ProductCatalogView.vue'
import ProductsService from '@/services/products.service'
import { useSessionStore } from '@/stores/session.store'
import { useToastStore } from '@/stores/toast.store'
import { useUiModeStore } from '@/stores/uiMode.store'
import { makeProduct } from '@/test/factories'

vi.mock('@/services/products.service', () => ({
  default: {
    listProducts: vi.fn(),
    getSuggestions: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    uploadProductImage: vi.fn(),
    fetchImageFile: vi.fn(),
    deactivateProduct: vi.fn(),
    reactivateProduct: vi.fn(),
  },
}))

const mountOptions = { global: { stubs: { teleport: true } } }

const source = makeProduct({
  id: '0190a5f0-7c3e-7000-8000-00000000000a', name: 'Playera lisa', tipo: 'cantidad', brand: 'Casa Vieja', presentation: 'Azul · 28',
  description: 'Algodón peinado', category: 'Ropa', unitPriceMinor: 15050, purchaseCostMinor: 9000, supplier: 'Textiles SA',
  notes: 'Pedir en caja', stock: 7, initialStock: 12, image: '/uploads/products/abc.png',
})
const created = makeProduct({ ...source, id: 'nuevo-1', presentation: 'Azul · 30', stock: 4, initialStock: 4, image: null })

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.clearAllMocks()
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock')
  globalThis.URL.revokeObjectURL = vi.fn()
  vi.mocked(ProductsService.listProducts).mockResolvedValue({ items: [source], total: 1, page: 1, limit: 20 })
  vi.mocked(ProductsService.getSuggestions).mockResolvedValue({ brands: [], presentations: [] })
  vi.mocked(ProductsService.createProduct).mockResolvedValue(created)
  vi.mocked(ProductsService.uploadProductImage).mockResolvedValue({ ...created, image: '/uploads/products/nuevo.png' })
  vi.mocked(ProductsService.fetchImageFile).mockResolvedValue(new File(['x'], 'copia.png', { type: 'image/png' }))
})

function setMember(role: 'socio' | 'colaborador') {
  useSessionStore().setMember({ id: 'm-1', name: 'Ana', role, active: true })
}
const toasts = () => useToastStore().toasts.map((t) => t.message)
const labelId = (wrapper: ReturnType<typeof mount>, text: string) =>
  wrapper.findAll('label').find((l) => l.text().startsWith(text))!.attributes('for')!
const input = (wrapper: ReturnType<typeof mount>, text: string) => wrapper.get(`[id="${labelId(wrapper, text)}"]`)
const button = (wrapper: ReturnType<typeof mount>, text: string) => wrapper.findAll('button').find((b) => b.text() === text)!

async function openDuplicate(role: 'socio' | 'colaborador' = 'socio') {
  setMember(role)
  const wrapper = mount(ProductCatalogView, mountOptions)
  await flushPromises()
  return wrapper
}

describe('Crear otro igual desde la tarjeta', () => {
  it('abre el alta precargada, con la presentación y la existencia vacías', async () => {
    const wrapper = await openDuplicate()

    await wrapper.get('.product-card').findAll('button').find((b) => b.text() === 'Crear otro igual')!.trigger('click')

    expect(wrapper.text()).toContain('Crear otro igual')
    expect((input(wrapper, 'Nombre').element as HTMLInputElement).value).toBe('Playera lisa')
    expect((input(wrapper, 'Marca').element as HTMLInputElement).value).toBe('Casa Vieja')
    expect((input(wrapper, 'Presentación').element as HTMLInputElement).value).toBe('')
    expect((input(wrapper, 'Existencia inicial').element as HTMLInputElement).value).toBe('')
  })

  it('al guardar crea el producto NUEVO con lo copiado y lo escrito', async () => {
    const wrapper = await openDuplicate()
    await wrapper.get('.product-card').findAll('button').find((b) => b.text() === 'Crear otro igual')!.trigger('click')
    await input(wrapper, 'Presentación').setValue('Azul · 30')
    await input(wrapper, 'Existencia inicial').setValue('4')

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(ProductsService.createProduct).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      name: 'Playera lisa', tipo: 'cantidad', brand: 'Casa Vieja', presentation: 'Azul · 30', initialStock: 4,
      category: 'Ropa', unitPriceMinor: 15050, purchaseCostMinor: 9000, supplier: 'Textiles SA',
      notes: 'Pedir en caja', description: 'Algodón peinado',
    }))
    expect(ProductsService.updateProduct).not.toHaveBeenCalled()
    expect(toasts()).toContain('Listo, ya quedó en tu catálogo.')
  })

  it('la foto se copia: se baja y se sube como archivo nuevo al producto nuevo (no se comparte la ruta)', async () => {
    const file = new File(['x'], 'copia.png', { type: 'image/png' })
    vi.mocked(ProductsService.fetchImageFile).mockResolvedValue(file)
    const wrapper = await openDuplicate()
    await wrapper.get('.product-card').findAll('button').find((b) => b.text() === 'Crear otro igual')!.trigger('click')
    await input(wrapper, 'Existencia inicial').setValue('4')

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(ProductsService.fetchImageFile).toHaveBeenCalledExactlyOnceWith('/uploads/products/abc.png', 'Playera lisa')
    expect(ProductsService.uploadProductImage).toHaveBeenCalledExactlyOnceWith('nuevo-1', file)
    const sent = JSON.stringify(vi.mocked(ProductsService.createProduct).mock.calls[0][0])
    expect(sent).not.toContain('/uploads/')
    expect(sent).not.toContain('copyImageFrom')
  })

  it('si la foto no se puede copiar, el producto queda creado y se avisa "No pudimos copiar la foto"', async () => {
    vi.mocked(ProductsService.fetchImageFile).mockRejectedValue(new Error('404'))
    const wrapper = await openDuplicate()
    await wrapper.get('.product-card').findAll('button').find((b) => b.text() === 'Crear otro igual')!.trigger('click')
    await input(wrapper, 'Existencia inicial').setValue('4')

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(ProductsService.createProduct).toHaveBeenCalledOnce()
    expect(toasts()).toContain('No pudimos copiar la foto')
    expect(toasts()).toContain('Listo, ya quedó en tu catálogo.')
    expect(ProductsService.uploadProductImage).not.toHaveBeenCalled()
  })

  it('si la subida de la copia falla también se avisa lo mismo', async () => {
    vi.mocked(ProductsService.uploadProductImage).mockRejectedValue(new Error('500'))
    const wrapper = await openDuplicate()
    await wrapper.get('.product-card').findAll('button').find((b) => b.text() === 'Crear otro igual')!.trigger('click')
    await input(wrapper, 'Existencia inicial').setValue('4')

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(toasts()).toContain('No pudimos copiar la foto')
  })

  it('un producto sin foto no intenta copiar nada', async () => {
    vi.mocked(ProductsService.listProducts).mockResolvedValue({ items: [{ ...source, image: null }], total: 1, page: 1, limit: 20 })
    const wrapper = await openDuplicate()
    await wrapper.get('.product-card').findAll('button').find((b) => b.text() === 'Crear otro igual')!.trigger('click')
    await input(wrapper, 'Existencia inicial').setValue('4')

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(ProductsService.fetchImageFile).not.toHaveBeenCalled()
    expect(ProductsService.uploadProductImage).not.toHaveBeenCalled()
  })

  it('un colaborador no ve el botón', async () => {
    const wrapper = await openDuplicate('colaborador')

    expect(wrapper.findAll('button').some((b) => b.text() === 'Crear otro igual')).toBe(false)
  })

  it('en Modo Venta no hay botón', async () => {
    setMember('socio')
    useUiModeStore().setMode?.('venta')
    const wrapper = mount(ProductCatalogView, mountOptions)
    await flushPromises()

    expect(wrapper.findAll('button').some((b) => b.text() === 'Crear otro igual')).toBe(false)
  })
})

describe('Guardar y crear otro igual', () => {
  it('guarda, y deja abierto el alta siguiente precargada con el producto recién creado', async () => {
    const wrapper = await openDuplicate()
    await wrapper.get('.product-card').findAll('button').find((b) => b.text() === 'Crear otro igual')!.trigger('click')
    await input(wrapper, 'Presentación').setValue('Azul · 30')
    await input(wrapper, 'Existencia inicial').setValue('4')

    await button(wrapper, 'Guardar y crear otro igual').trigger('click')
    await flushPromises()

    expect(ProductsService.createProduct).toHaveBeenCalledOnce()
    expect(toasts()).toContain('Listo, «Playera lisa» quedó en tu catálogo.')
    // El formulario sigue ahí, listo para la siguiente combinación: presentación y existencia vacías.
    expect((input(wrapper, 'Nombre').element as HTMLInputElement).value).toBe('Playera lisa')
    expect((input(wrapper, 'Presentación').element as HTMLInputElement).value).toBe('')
    expect((input(wrapper, 'Existencia inicial').element as HTMLInputElement).value).toBe('')
  })

  it('desde un alta nueva (sin copiar de nadie) también encadena', async () => {
    const wrapper = await openDuplicate()
    await button(wrapper, '+ Nuevo producto').trigger('click')
    await input(wrapper, 'Nombre').setValue('Gorra')
    const decimals = wrapper.findAll('input').filter((i) => i.attributes('inputmode') === 'decimal')
    await decimals[0].setValue('99')
    await decimals[1].setValue('50')
    vi.mocked(ProductsService.createProduct).mockResolvedValue(makeProduct({ id: 'g-1', name: 'Gorra', purchaseCostMinor: 5000, unitPriceMinor: 9900 }))

    await button(wrapper, 'Guardar y crear otro igual').trigger('click')
    await flushPromises()

    expect(ProductsService.createProduct).toHaveBeenCalledWith(expect.objectContaining({ name: 'Gorra' }))
    expect((input(wrapper, 'Nombre').element as HTMLInputElement).value).toBe('Gorra')
    expect((input(wrapper, 'Precio de venta').element as HTMLInputElement).value).toBe('99.00')
  })

  it('si guardar falla, no se abre otro: el formulario conserva lo escrito', async () => {
    vi.mocked(ProductsService.createProduct).mockRejectedValue(new Error('500'))
    setMember('socio')
    // Sin Teleport simulado (la simulación vuelve a crear el contenido en cada cambio): el modal real, en <body>.
    const wrapper = mount(ProductCatalogView, { attachTo: document.body })
    await flushPromises()
    const inBody = (text: string) => {
      const label = [...document.body.querySelectorAll('label')].find((l) => l.textContent?.startsWith(text))!
      return document.body.querySelector<HTMLInputElement>(`[id="${label.getAttribute('for')}"]`)!
    }
    const click = (text: string) => [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!.click()
    click('Crear otro igual')
    await flushPromises()
    inBody('Presentación').value = 'Azul · 30'
    inBody('Presentación').dispatchEvent(new Event('input'))
    inBody('Existencia inicial').value = '4'
    inBody('Existencia inicial').dispatchEvent(new Event('input'))
    await flushPromises()

    click('Guardar y crear otro igual')
    await flushPromises()

    expect(ProductsService.createProduct).toHaveBeenCalledOnce()
    expect(inBody('Presentación').value).toBe('Azul · 30')
    expect(inBody('Existencia inicial').value).toBe('4')
    expect(toasts()).not.toContain('Listo, «Playera lisa» quedó en tu catálogo.')
    wrapper.unmount()
    document.body.replaceChildren()
  })

  it('la foto copiada en el primero se vuelve a copiar para el siguiente', async () => {
    vi.mocked(ProductsService.uploadProductImage).mockResolvedValue({ ...created, image: '/uploads/products/nuevo.png' })
    const wrapper = await openDuplicate()
    await wrapper.get('.product-card').findAll('button').find((b) => b.text() === 'Crear otro igual')!.trigger('click')
    await input(wrapper, 'Existencia inicial').setValue('4')
    await button(wrapper, 'Guardar y crear otro igual').trigger('click')
    await flushPromises()

    await input(wrapper, 'Existencia inicial').setValue('2')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(ProductsService.fetchImageFile).toHaveBeenLastCalledWith('/uploads/products/nuevo.png', 'Playera lisa')
  })
})

describe('Crear otro igual desde el modal de edición', () => {
  it('cierra la edición y abre el alta con lo guardado del producto', async () => {
    const wrapper = await openDuplicate()
    await wrapper.get('.product-card').findAll('button').find((b) => b.text() === 'Editar')!.trigger('click')
    // Un cambio sin guardar en la edición no se arrastra: se copia el producto como está guardado.
    await input(wrapper, 'Nombre').setValue('Nombre sin guardar')

    await button(wrapper, 'Crear otro igual').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Crear otro igual')
    expect(wrapper.text()).not.toContain('Editar producto')
    expect((input(wrapper, 'Nombre').element as HTMLInputElement).value).toBe('Playera lisa')
    expect((input(wrapper, 'Presentación').element as HTMLInputElement).value).toBe('')
  })
})
