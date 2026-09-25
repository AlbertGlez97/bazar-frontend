import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ProductCatalogView from '../ProductCatalogView.vue'
import ProductsService from '@/services/products.service'
import { useSessionStore } from '@/stores/session.store'
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

// AppModal usa <Teleport to="body">: se stubea para que el contenido del modal
// quede dentro del wrapper y sea consultable desde el test.
const mountOptions = { global: { stubs: { teleport: true } } }

function setMember(role: 'socio' | 'colaborador') {
  useSessionStore().setMember({ id: 'm-1', name: 'Ana', role, active: true })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock')
  globalThis.URL.revokeObjectURL = vi.fn()
  vi.mocked(ProductsService.listProducts).mockResolvedValue({ items: [product()], total: 1, page: 1, limit: 20 })
})

describe('ProductCatalogView', () => {
  it('carga el catálogo al montar', async () => {
    setMember('socio')
    mount(ProductCatalogView, mountOptions)
    await vi.waitFor(() => expect(ProductsService.listProducts).toHaveBeenCalled())
  })

  it('muestra el botón "Nuevo producto" para socios', async () => {
    setMember('socio')
    const wrapper = mount(ProductCatalogView, mountOptions)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Nuevo producto'))
  })

  it('oculta el botón "Nuevo producto" para colaboradores', async () => {
    setMember('colaborador')
    const wrapper = mount(ProductCatalogView, mountOptions)
    await vi.waitFor(() => expect(ProductsService.listProducts).toHaveBeenCalled())
    expect(wrapper.text()).not.toContain('Nuevo producto')
  })

  it('no muestra acciones de gestión en las tarjetas para colaboradores', async () => {
    setMember('colaborador')
    const wrapper = mount(ProductCatalogView, mountOptions)
    await vi.waitFor(() => expect(ProductsService.listProducts).toHaveBeenCalled())
    expect(wrapper.find('.product-card__footer').exists()).toBe(false)
  })

  it('crea un producto y sube la imagen en una segunda llamada', async () => {
    setMember('socio')
    vi.mocked(ProductsService.createProduct).mockResolvedValue(product({ id: 'p-new' }))
    vi.mocked(ProductsService.uploadProductImage).mockResolvedValue(product({ id: 'p-new', image: '/uploads/x.png' }))

    const wrapper = mount(ProductCatalogView, mountOptions)
    await vi.waitFor(() => expect(ProductsService.listProducts).toHaveBeenCalled())

    const newButton = wrapper.findAll('button').find((b) => b.text().includes('Nuevo producto'))
    await newButton?.trigger('click')

    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const fileInput = wrapper.find('input[type="file"]').element as HTMLInputElement
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
    await wrapper.find('input[type="file"]').trigger('change')

    // El primer <input> de la vista es el buscador del grid, no el nombre.
    await wrapper.find('input[placeholder="Ej. Consola PS5 usada"]').setValue('Producto nuevo')
    const priceInput = wrapper.findAll('input').find((i) => i.attributes('inputmode') === 'decimal')
    await priceInput?.setValue('10.00')

    await wrapper.find('form').trigger('submit')
    await vi.waitFor(() => expect(ProductsService.createProduct).toHaveBeenCalled())
    await vi.waitFor(() => expect(ProductsService.uploadProductImage).toHaveBeenCalledWith('p-new', file))
  })

  it('avisa con un toast si la imagen falla, sin revertir el producto creado', async () => {
    setMember('socio')
    vi.mocked(ProductsService.createProduct).mockResolvedValue(product({ id: 'p-new' }))
    vi.mocked(ProductsService.uploadProductImage).mockRejectedValue(new Error('boom'))

    const wrapper = mount(ProductCatalogView, mountOptions)
    await vi.waitFor(() => expect(ProductsService.listProducts).toHaveBeenCalled())

    const newButton = wrapper.findAll('button').find((b) => b.text().includes('Nuevo producto'))
    await newButton?.trigger('click')

    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const fileInput = wrapper.find('input[type="file"]').element as HTMLInputElement
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
    await wrapper.find('input[type="file"]').trigger('change')

    // El primer <input> de la vista es el buscador del grid, no el nombre.
    await wrapper.find('input[placeholder="Ej. Consola PS5 usada"]').setValue('Producto nuevo')
    const priceInput = wrapper.findAll('input').find((i) => i.attributes('inputmode') === 'decimal')
    await priceInput?.setValue('10.00')

    await wrapper.find('form').trigger('submit')
    await vi.waitFor(() => expect(ProductsService.uploadProductImage).toHaveBeenCalled())
    expect(ProductsService.createProduct).toHaveBeenCalledOnce()
  })

  it('pide confirmación antes de desactivar y llama al servicio al confirmar', async () => {
    setMember('socio')
    vi.mocked(ProductsService.deactivateProduct).mockResolvedValue(product({ active: false }))

    const wrapper = mount(ProductCatalogView, mountOptions)
    // No basta con que listProducts se haya llamado: hay que esperar a que la
    // respuesta se renderice como tarjeta (si no, el botón aún no existe).
    await vi.waitFor(() => expect(wrapper.text()).toContain('Desactivar'))

    const deactivateButton = wrapper.findAll('button').find((b) => b.text() === 'Desactivar')
    await deactivateButton?.trigger('click')
    expect(ProductsService.deactivateProduct).not.toHaveBeenCalled()

    const confirmButton = wrapper.findAll('button').find((b) => b.text() === 'Sí, desactivar')
    await confirmButton?.trigger('click')
    await vi.waitFor(() => expect(ProductsService.deactivateProduct).toHaveBeenCalledWith('p-1'))
  })

  describe('editar un producto', () => {
    async function openEditModal(wrapper: ReturnType<typeof mount>) {
      await vi.waitFor(() => expect(wrapper.text()).toContain('Editar'))
      await wrapper.findAll('button').find((b) => b.text() === 'Editar')?.trigger('click')
      await vi.waitFor(() => expect(wrapper.text()).toContain('Guardar cambios'))
    }
    const modalIsOpen = (wrapper: ReturnType<typeof mount>) => wrapper.text().includes('Guardar cambios')
    const toastMessages = async () => (await import('@/stores/toast.store')).useToastStore().toasts.map((t) => t.message)

    it('no envía ninguna petición si el formulario no tiene cambios y cierra el modal sin avisos', async () => {
      // El API responde 400 "At least one editable field is required" a un
      // PATCH {}; por eso un guardado sin cambios no llama al servicio, cierra
      // el modal en silencio y no muestra ni error ni un "actualizado" falso.
      setMember('socio')
      const wrapper = mount(ProductCatalogView, mountOptions)
      await openEditModal(wrapper)

      await wrapper.find('form').trigger('submit')

      await vi.waitFor(() => expect(modalIsOpen(wrapper)).toBe(false))
      expect(ProductsService.updateProduct).not.toHaveBeenCalled()
      expect(ProductsService.uploadProductImage).not.toHaveBeenCalled()
      expect(await toastMessages()).toEqual([])
    })

    it('un cambio de imagen sin otros cambios sube la imagen sin enviar PATCH', async () => {
      setMember('socio')
      vi.mocked(ProductsService.uploadProductImage).mockResolvedValue(product({ image: '/uploads/x.png' }))
      const wrapper = mount(ProductCatalogView, mountOptions)
      await openEditModal(wrapper)

      const file = new File(['x'], 'a.png', { type: 'image/png' })
      const fileInput = wrapper.find('input[type="file"]').element as HTMLInputElement
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
      await wrapper.find('input[type="file"]').trigger('change')
      await wrapper.find('form').trigger('submit')

      await vi.waitFor(() => expect(ProductsService.uploadProductImage).toHaveBeenCalledWith('p-1', file))
      expect(ProductsService.updateProduct).not.toHaveBeenCalled()
      await vi.waitFor(() => expect(modalIsOpen(wrapper)).toBe(false))
      expect(await toastMessages()).toContain('Producto actualizado')
    })

    it('con un campo cambiado sí envía solo ese campo', async () => {
      setMember('socio')
      vi.mocked(ProductsService.updateProduct).mockResolvedValue(product({ name: 'Nuevo' }))
      const wrapper = mount(ProductCatalogView, mountOptions)
      await openEditModal(wrapper)

      await wrapper.find('input[placeholder="Ej. Consola PS5 usada"]').setValue('Nuevo')
      await wrapper.find('form').trigger('submit')

      await vi.waitFor(() => expect(ProductsService.updateProduct).toHaveBeenCalledExactlyOnceWith('p-1', { name: 'Nuevo' }))
    })
  })

  it('el diálogo de desactivación dice dónde reactivar el producto', async () => {
    setMember('socio')
    const wrapper = mount(ProductCatalogView, mountOptions)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Desactivar'))

    await wrapper.findAll('button').find((b) => b.text() === 'Desactivar')?.trigger('click')
    expect(wrapper.text()).toContain('Mostrar inactivos')
  })

  describe('productos inactivos (solo socios)', () => {
    const inactive = () => product({ id: 'p-off', name: 'Apagado', active: false })

    it('muestra el interruptor "Mostrar inactivos" a socios', async () => {
      setMember('socio')
      const wrapper = mount(ProductCatalogView, mountOptions)
      await vi.waitFor(() => expect(ProductsService.listProducts).toHaveBeenCalled())
      expect(wrapper.text()).toContain('Mostrar inactivos')
    })

    it('oculta el interruptor "Mostrar inactivos" a colaboradores', async () => {
      setMember('colaborador')
      const wrapper = mount(ProductCatalogView, mountOptions)
      await vi.waitFor(() => expect(ProductsService.listProducts).toHaveBeenCalled())
      expect(wrapper.text()).not.toContain('Mostrar inactivos')
    })

    it('al activar el interruptor recarga con includeInactive y vuelve a la página 1', async () => {
      setMember('socio')
      vi.mocked(ProductsService.listProducts).mockResolvedValue({ items: [product()], total: 100, page: 3, limit: 20 })
      const wrapper = mount(ProductCatalogView, mountOptions)
      await vi.waitFor(() => expect(wrapper.text()).toContain('Mostrar inactivos'))
      await vi.waitFor(() => expect(wrapper.text()).toContain('Desactivar'))

      await wrapper.find('input[type="checkbox"]').setValue(true)

      await vi.waitFor(() => expect(ProductsService.listProducts).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, includeInactive: true }),
      ))
    })

    it('un colaborador nunca pide includeInactive, aunque el store lo traiga activado', async () => {
      setMember('colaborador')
      const { useProductsStore } = await import('@/stores/products.store')
      useProductsStore().includeInactive = true
      mount(ProductCatalogView, mountOptions)
      await vi.waitFor(() => expect(ProductsService.listProducts).toHaveBeenCalled())
      expect(vi.mocked(ProductsService.listProducts).mock.calls[0][0]?.includeInactive).toBeUndefined()
    })

    it('un producto inactivo se ve como inactivo y ofrece "Reactivar" al socio', async () => {
      setMember('socio')
      vi.mocked(ProductsService.listProducts).mockResolvedValue({ items: [inactive()], total: 1, page: 1, limit: 20 })
      const wrapper = mount(ProductCatalogView, mountOptions)
      await vi.waitFor(() => expect(wrapper.text()).toContain('Apagado'))

      expect(wrapper.text()).toContain('Inactivo')
      expect(wrapper.findAll('button').some((b) => b.text() === 'Reactivar')).toBe(true)
      expect(wrapper.findAll('button').some((b) => b.text() === 'Desactivar')).toBe(false)
    })

    it('no ofrece "Reactivar" en productos activos', async () => {
      setMember('socio')
      const wrapper = mount(ProductCatalogView, mountOptions)
      await vi.waitFor(() => expect(wrapper.text()).toContain('Desactivar'))
      expect(wrapper.findAll('button').some((b) => b.text() === 'Reactivar')).toBe(false)
    })

    it('un colaborador no ve "Reactivar" ni siquiera si le llega un producto inactivo', async () => {
      setMember('colaborador')
      vi.mocked(ProductsService.listProducts).mockResolvedValue({ items: [inactive()], total: 1, page: 1, limit: 20 })
      const wrapper = mount(ProductCatalogView, mountOptions)
      await vi.waitFor(() => expect(wrapper.text()).toContain('Apagado'))
      expect(wrapper.text()).not.toContain('Reactivar')
    })

    it('reactiva llamando al endpoint y refresca el listado con el producto activo', async () => {
      setMember('socio')
      vi.mocked(ProductsService.listProducts).mockResolvedValueOnce({ items: [inactive()], total: 1, page: 1, limit: 20 })
      vi.mocked(ProductsService.reactivateProduct).mockResolvedValue(product({ id: 'p-off', name: 'Apagado' }))
      const wrapper = mount(ProductCatalogView, mountOptions)
      await vi.waitFor(() => expect(wrapper.text()).toContain('Reactivar'))

      vi.mocked(ProductsService.listProducts).mockResolvedValue({
        items: [product({ id: 'p-off', name: 'Apagado' })], total: 1, page: 1, limit: 20,
      })
      await wrapper.findAll('button').find((b) => b.text() === 'Reactivar')?.trigger('click')

      await vi.waitFor(() => expect(ProductsService.reactivateProduct).toHaveBeenCalledWith('p-off'))
      await vi.waitFor(() => expect(wrapper.text()).not.toContain('Inactivo'))
      expect(ProductsService.listProducts).toHaveBeenCalledTimes(2)
    })

    it('si la reactivación falla avisa con un toast de error y no se rompe', async () => {
      setMember('socio')
      vi.mocked(ProductsService.listProducts).mockResolvedValue({ items: [inactive()], total: 1, page: 1, limit: 20 })
      vi.mocked(ProductsService.reactivateProduct).mockRejectedValue(new Error('boom'))
      const wrapper = mount(ProductCatalogView, mountOptions)
      await vi.waitFor(() => expect(wrapper.text()).toContain('Reactivar'))

      await wrapper.findAll('button').find((b) => b.text() === 'Reactivar')?.trigger('click')

      const { useToastStore } = await import('@/stores/toast.store')
      await vi.waitFor(() => expect(useToastStore().toasts.map((t) => t.message))
        .toContain('No se pudo reactivar el producto'))
    })
  })
})
