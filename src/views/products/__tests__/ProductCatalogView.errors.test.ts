const TEST_IDENTITY = 'a.' + btoa(JSON.stringify({ sub: 'account-a' })) + '.z'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import ProductCatalogView from '../ProductCatalogView.vue'
import ProductsService from '@/services/products.service'
import { useSessionStore } from '@/stores/session.store'
import { useToastStore } from '@/stores/toast.store'
import { useUiModeStore } from '@/stores/uiMode.store'
import { VOICE } from '@/config/voice'
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

/** What axios rejects with when the server answers with `status` and `data`. */
const httpError = (status: number, data?: unknown) => ({ isAxiosError: true, message: `Request failed with status code ${status}`, response: { status, data } })
const networkError = () => ({ isAxiosError: true, message: 'Network Error', request: {} })

const CONTEXT_LOST = { message: 'Selection is not authorized for this context', error: 'Forbidden', statusCode: 403 }
const NOT_SOCIO = { message: 'Only socios may access this resource', error: 'Forbidden', statusCode: 403 }

function setup(role: 'socio' | 'colaborador' = 'socio') {
  const session = useSessionStore()
  session.setMember({ id: 'm-1', name: 'Ana', role, active: true })
  session.setDevice({ deviceId: 'old-device-id', name: 'Tablet' })
  return session
}

async function mountCatalog() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/app/productos', name: 'ProductCatalog', component: { template: '<div />' } },
      { path: '/seleccionar', name: 'SelectContext', component: { template: '<div />' } },
    ],
  })
  router.push('/app/productos')
  await router.isReady()
  const wrapper = mount(ProductCatalogView, { global: { plugins: [router], stubs: { teleport: true } } })
  await vi.waitFor(() => expect(ProductsService.listProducts).toHaveBeenCalled())
  return { wrapper, router }
}

const toasts = () => useToastStore().toasts.map((t) => t.message)
const lastToast = () => toasts().at(-1) ?? ''

async function openCreateFormAndSubmit(wrapper: ReturnType<typeof mount>) {
  await vi.waitFor(() => expect(wrapper.text()).toContain('Nuevo producto'))
  await wrapper.findAll('button').find((b) => b.text().includes('Nuevo producto'))?.trigger('click')
  await wrapper.find('input[placeholder="Ej. Consola PS5 usada"]').setValue('Bonsai')
  const decimals = wrapper.findAll('input').filter((i) => i.attributes('inputmode') === 'decimal')
  await decimals[0]?.setValue('1,500.00') // precio
  await decimals[1]?.setValue('0') // costo de compra — obligatorio en creación (D3)
  await wrapper.find('form').trigger('submit')
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem('access_token', TEST_IDENTITY)
  localStorage.setItem('token_expires_at', String(Date.now() + 60000))
  localStorage.setItem('device_context_owner', JSON.stringify({ accountId: 'account-a', apiBase: '/api/v1' }))
  sessionStorage.setItem('member_context_owner', JSON.stringify({ accountId: 'account-a', apiBase: '/api/v1' }))
  setActivePinia(createPinia())
  // reset (no solo clear): un `mockResolvedValueOnce` que no se consumió no debe filtrarse al test siguiente.
  vi.resetAllMocks()
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock')
  globalThis.URL.revokeObjectURL = vi.fn()
  vi.mocked(ProductsService.listProducts).mockResolvedValue({ items: [product()], total: 1, page: 1, limit: 20 })
})

describe('crear producto: el motivo real llega a la pantalla', () => {
  it('403 "Only socios…" -> dice que solo los socios pueden, con el código', async () => {
    setup()
    vi.mocked(ProductsService.createProduct).mockRejectedValue(httpError(403, NOT_SOCIO))
    const { wrapper } = await mountCatalog()
    await openCreateFormAndSubmit(wrapper)

    await vi.waitFor(() => expect(lastToast()).toContain(VOICE.apiErrors.notSocio))
    expect(lastToast()).toContain(VOICE.apiErrors.catalog.save)
    expect(lastToast()).toContain('(código 403)')
  })

  it('403 "Selection is not authorized…" (dispositivo viejo) -> dice que el dispositivo ya no está reconocido', async () => {
    setup()
    vi.mocked(ProductsService.createProduct).mockRejectedValue(httpError(403, CONTEXT_LOST))
    const { wrapper } = await mountCatalog()
    await openCreateFormAndSubmit(wrapper)

    await vi.waitFor(() => expect(lastToast()).toContain(VOICE.apiErrors.contextLost))
    expect(lastToast()).toContain('(código 403)')
  })

  it('400 con categoría vacía -> mensaje amigable sobre la categoría', async () => {
    setup()
    vi.mocked(ProductsService.createProduct).mockRejectedValue(httpError(400, { message: ['category must be longer than or equal to 1 characters'], error: 'Bad Request', statusCode: 400 }))
    const { wrapper } = await mountCatalog()
    await openCreateFormAndSubmit(wrapper)

    await vi.waitFor(() => expect(lastToast()).toContain(VOICE.apiErrors.product.category))
    expect(lastToast()).toContain('(código 400)')
  })

  it('400 con un mensaje desconocido -> se muestra tal cual el primero', async () => {
    setup()
    vi.mocked(ProductsService.createProduct).mockRejectedValue(httpError(400, { message: ['property imageFile should not exist'] }))
    const { wrapper } = await mountCatalog()
    await openCreateFormAndSubmit(wrapper)

    await vi.waitFor(() => expect(lastToast()).toContain('property imageFile should not exist'))
  })

  it('sin conexión -> el texto de red, sin código', async () => {
    setup()
    vi.mocked(ProductsService.createProduct).mockRejectedValue(networkError())
    const { wrapper } = await mountCatalog()
    await openCreateFormAndSubmit(wrapper)

    await vi.waitFor(() => expect(lastToast()).toContain(VOICE.networkError))
    expect(lastToast()).not.toContain('código')
  })

  it('500 -> "el servidor tuvo un problema" con el código', async () => {
    setup()
    vi.mocked(ProductsService.createProduct).mockRejectedValue(httpError(500, { message: 'Internal server error' }))
    const { wrapper } = await mountCatalog()
    await openCreateFormAndSubmit(wrapper)

    await vi.waitFor(() => expect(lastToast()).toContain(VOICE.apiErrors.server))
    expect(lastToast()).toContain('(código 500)')
  })

  it('un error que no es de red ni HTTP conserva el texto de siempre (sin código)', async () => {
    setup()
    vi.mocked(ProductsService.createProduct).mockRejectedValue(new Error('boom'))
    const { wrapper } = await mountCatalog()
    await openCreateFormAndSubmit(wrapper)

    await vi.waitFor(() => expect(lastToast()).toBe('No pudimos guardar el producto. Intenta de nuevo.'))
  })

  it('el formulario sigue abierto y usable tras el error: se puede reintentar y guardar', async () => {
    // Teleport REAL (el stub de @vue/test-utils vuelve a montar el formulario en
    // cada re-render y borraría lo escrito): el modal vive en document.body.
    setup()
    vi.mocked(ProductsService.createProduct)
      .mockRejectedValueOnce(httpError(400, { message: ['unitPriceMinor must be an integer number'] }))
      .mockResolvedValueOnce(product({ id: 'p-new' }))
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/app/productos', name: 'ProductCatalog', component: { template: '<div />' } }],
    })
    router.push('/app/productos')
    await router.isReady()
    const wrapper = mount(ProductCatalogView, { attachTo: document.body, global: { plugins: [router] } })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Nuevo producto'))
    await wrapper.findAll('button').find((b) => b.text().includes('Nuevo producto'))?.trigger('click')

    const nameInput = () => document.body.querySelector('input[placeholder="Ej. Consola PS5 usada"]') as HTMLInputElement
    const decimalInputs = () => Array.from(document.body.querySelectorAll('input')).filter((i) => i.getAttribute('inputmode') === 'decimal') as HTMLInputElement[]
    const priceInput = () => decimalInputs()[0]
    const costInput = () => decimalInputs()[1]
    const form = () => document.body.querySelector('form') as HTMLFormElement
    nameInput().value = 'Bonsai'
    nameInput().dispatchEvent(new Event('input'))
    priceInput().value = '1,500.00'
    priceInput().dispatchEvent(new Event('input'))
    costInput().value = '0' // costo de compra — obligatorio en creación (D3)
    costInput().dispatchEvent(new Event('input'))
    form().dispatchEvent(new Event('submit', { cancelable: true }))

    await vi.waitFor(() => expect(lastToast()).toContain(VOICE.apiErrors.product.price))
    expect(form()).not.toBeNull()
    expect(nameInput().value).toBe('Bonsai')

    form().dispatchEvent(new Event('submit', { cancelable: true }))
    await vi.waitFor(() => expect(ProductsService.createProduct).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(toasts()).toContain('Listo, ya quedó en tu catálogo.'))
    await vi.waitFor(() => expect(document.body.querySelector('form')).toBeNull())
    wrapper.unmount()
  })
})

describe('recuperarse de un dispositivo que ya no existe (403 "Selection is not authorized…")', () => {
  async function failWithStaleDevice() {
    const session = setup()
    vi.mocked(ProductsService.createProduct).mockRejectedValue(httpError(403, CONTEXT_LOST))
    const mounted = await mountCatalog()
    await openCreateFormAndSubmit(mounted.wrapper)
    await vi.waitFor(() => expect(lastToast()).toContain(VOICE.apiErrors.contextLost))
    return { session, ...mounted }
  }

  it('muestra un aviso fijo con el botón para volver a identificar el dispositivo', async () => {
    const { wrapper } = await failWithStaleDevice()
    const button = wrapper.findAll('button').find((b) => b.text() === VOICE.apiErrors.catalog.reidentify)
    expect(button).toBeTruthy()
    expect(wrapper.text()).toContain(VOICE.apiErrors.contextLost)
  })

  it('al pulsarlo se borran el dispositivo y la persona guardados y se va a identificar', async () => {
    const { wrapper, router, session } = await failWithStaleDevice()
    expect(session.isDeviceIdentified).toBe(true)

    await wrapper.findAll('button').find((b) => b.text() === VOICE.apiErrors.catalog.reidentify)?.trigger('click')

    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('SelectContext'))
    expect(session.isDeviceIdentified).toBe(false)
    expect(session.isMemberSelected).toBe(false)
    expect(localStorage.getItem('device_context')).toBeNull()
  })

  it('nada se borra por sí solo: sin pulsar el botón el dispositivo guardado sigue ahí', async () => {
    const { session, router } = await failWithStaleDevice()
    expect(session.isDeviceIdentified).toBe(true)
    expect(router.currentRoute.value.name).toBe('ProductCatalog')
  })

  it('otros errores (400, 500, red) NO muestran el botón de re-identificar', async () => {
    setup()
    vi.mocked(ProductsService.createProduct).mockRejectedValue(httpError(500, {}))
    const { wrapper } = await mountCatalog()
    await openCreateFormAndSubmit(wrapper)
    await vi.waitFor(() => expect(lastToast()).toContain(VOICE.apiErrors.server))
    expect(wrapper.findAll('button').some((b) => b.text() === VOICE.apiErrors.catalog.reidentify)).toBe(false)
  })

  it('el aviso desaparece cuando una acción posterior sale bien', async () => {
    const { wrapper } = await failWithStaleDevice()
    // Otra acción, ahora sin formulario (el stub de Teleport no conserva lo escrito): desactivar sale bien.
    vi.mocked(ProductsService.deactivateProduct).mockResolvedValue(product({ active: false }))
    await wrapper.findAll('button').find((b) => b.text() === 'Desactivar')?.trigger('click')
    await wrapper.findAll('button').find((b) => b.text() === 'Sí, desactivar')?.trigger('click')
    await vi.waitFor(() => expect(toasts().some((m) => m.startsWith('Producto desactivado'))).toBe(true))
    expect(wrapper.findAll('button').some((b) => b.text() === VOICE.apiErrors.catalog.reidentify)).toBe(false)
  })
})

describe('las demás acciones del catálogo también dicen el motivo', () => {
  it('editar: 400 -> mensaje del campo', async () => {
    setup()
    vi.mocked(ProductsService.updateProduct).mockRejectedValue(httpError(400, { message: ['name should not be empty'] }))
    const { wrapper } = await mountCatalog()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Editar'))
    await wrapper.findAll('button').find((b) => b.text() === 'Editar')?.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Guardar cambios'))
    await wrapper.find('input[placeholder="Ej. Consola PS5 usada"]').setValue('Nuevo nombre')
    await wrapper.find('form').trigger('submit')

    await vi.waitFor(() => expect(lastToast()).toContain(VOICE.apiErrors.product.name))
    expect(wrapper.text()).toContain('Guardar cambios')
  })

  it('desactivar: 403 no socio -> dice que solo los socios', async () => {
    setup()
    vi.mocked(ProductsService.deactivateProduct).mockRejectedValue(httpError(403, NOT_SOCIO))
    const { wrapper } = await mountCatalog()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Desactivar'))
    await wrapper.findAll('button').find((b) => b.text() === 'Desactivar')?.trigger('click')
    await wrapper.findAll('button').find((b) => b.text() === 'Sí, desactivar')?.trigger('click')

    await vi.waitFor(() => expect(lastToast()).toContain(VOICE.apiErrors.catalog.deactivate))
    expect(lastToast()).toContain(VOICE.apiErrors.notSocio)
  })

  it('reactivar: 404 -> "eso ya no existe"', async () => {
    setup()
    vi.mocked(ProductsService.listProducts).mockResolvedValue({ items: [product({ active: false })], total: 1, page: 1, limit: 20 })
    vi.mocked(ProductsService.reactivateProduct).mockRejectedValue(httpError(404, { message: 'Product not found' }))
    const { wrapper } = await mountCatalog()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Reactivar'))
    await wrapper.findAll('button').find((b) => b.text() === 'Reactivar')?.trigger('click')

    await vi.waitFor(() => expect(lastToast()).toContain(VOICE.apiErrors.notFound))
    expect(lastToast()).toContain(VOICE.apiErrors.catalog.reactivate)
  })

  it('cargar el catálogo: red caída -> texto de red', async () => {
    setup()
    vi.mocked(ProductsService.listProducts).mockRejectedValue(networkError())
    await mountCatalog()
    await vi.waitFor(() => expect(lastToast()).toContain(VOICE.networkError))
    expect(lastToast()).toContain(VOICE.apiErrors.catalog.load)
  })

  it('cargar el catálogo: 403 de dispositivo viejo también ofrece re-identificar', async () => {
    setup()
    vi.mocked(ProductsService.listProducts).mockRejectedValue(httpError(403, CONTEXT_LOST))
    const { wrapper } = await mountCatalog()
    await vi.waitFor(() => expect(lastToast()).toContain(VOICE.apiErrors.contextLost))
    expect(wrapper.findAll('button').some((b) => b.text() === VOICE.apiErrors.catalog.reidentify)).toBe(true)
  })

  it('imagen que falla: el producto queda guardado y el aviso lo dice, con el motivo si se conoce', async () => {
    setup()
    vi.mocked(ProductsService.createProduct).mockResolvedValue(product({ id: 'p-new' }))
    vi.mocked(ProductsService.uploadProductImage).mockRejectedValue(httpError(413, {}))
    const { wrapper } = await mountCatalog()

    await wrapper.findAll('button').find((b) => b.text().includes('Nuevo producto'))?.trigger('click')
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const fileInput = wrapper.find('input[type="file"]').element as HTMLInputElement
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
    await wrapper.find('input[type="file"]').trigger('change')
    await wrapper.find('input[placeholder="Ej. Consola PS5 usada"]').setValue('Bonsai')
    const decimals = wrapper.findAll('input').filter((i) => i.attributes('inputmode') === 'decimal')
    await decimals[0]?.setValue('10.00') // precio
    await decimals[1]?.setValue('0') // costo de compra — obligatorio en creación (D3)
    await wrapper.find('form').trigger('submit')

    await vi.waitFor(() => expect(toasts().some((m) => m.startsWith(VOICE.apiErrors.catalog.image))).toBe(true))
    expect(ProductsService.createProduct).toHaveBeenCalledOnce()
  })
})

describe('catálogo de solo lectura para quien no es socio', () => {
  it('colaborador en Modo Gestión: sin acciones y con la nota de solo lectura', async () => {
    setup('colaborador')
    const { wrapper } = await mountCatalog()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Producto'))

    expect(wrapper.text()).toContain(VOICE.apiErrors.catalog.readOnly)
    expect(wrapper.text()).not.toContain('Nuevo producto')
    expect(wrapper.find('.product-card__footer').exists()).toBe(false)
  })

  it('socio: sin la nota y con todas las acciones', async () => {
    setup('socio')
    const { wrapper } = await mountCatalog()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Desactivar'))

    expect(wrapper.text()).not.toContain(VOICE.apiErrors.catalog.readOnly)
    expect(wrapper.text()).toContain('Nuevo producto')
  })

  it('colaborador en Modo Venta: el catálogo es para vender, no se muestra la nota de gestión', async () => {
    setup('colaborador')
    useUiModeStore().setMode('venta')
    const { wrapper } = await mountCatalog()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Producto'))

    expect(wrapper.text()).not.toContain(VOICE.apiErrors.catalog.readOnly)
  })
})
