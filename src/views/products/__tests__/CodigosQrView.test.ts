// Vista "Códigos QR" (D2): contenedor. Stores reales (sesión, modo); se simula
// la red (ProductsService) y la impresión (useLabelPrinting, que carga jsPDF).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ref } from 'vue'
import CodigosQrView from '../CodigosQrView.vue'
import ProductsService from '@/services/products.service'
import { useSessionStore } from '@/stores/session.store'
import { useUiModeStore } from '@/stores/uiMode.store'
import { useLabelCalibrationStore } from '@/stores/label-calibration.store'
import { VOICE } from '@/config/voice'
import type { Product } from '@/types/product.types'

vi.mock('@/services/products.service', () => ({
  default: { listProducts: vi.fn() },
}))

const printing = vi.hoisted(() => ({ preview: vi.fn(), download: vi.fn() }))
vi.mock('@/composables/useLabelPrinting', () => ({
  useLabelPrinting: () => ({ busy: ref(null), error: ref(''), preview: printing.preview, download: printing.download }),
}))

const product = (n: number, overrides: Partial<Product> = {}): Product => ({
  id: `p-${n}`, name: `Producto ${n}`, tipo: 'unica', unitPriceMinor: 1000 * n, initialStock: 1, stock: 1,
  category: null, purchaseCostMinor: null, supplier: null, notes: null, createdAt: '2026-01-01T00:00:00.000Z',
  active: true, image: null, ...overrides,
})

const SOCIO = { id: 'm-1', name: 'Ana', role: 'socio' as const, active: true }

async function mountView(options: { role?: 'socio' | 'colaborador'; mode?: 'gestion' | 'venta' } = {}) {
  const session = useSessionStore()
  session.setMember({ ...SOCIO, role: options.role ?? 'socio' })
  useUiModeStore().setMode(options.mode ?? 'gestion')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/app', name: 'AppHome', component: { template: '<div>home</div>' } },
      { path: '/app/codigos-qr', name: 'CodigosQr', component: CodigosQrView },
    ],
  })
  router.push('/app/codigos-qr')
  await router.isReady()
  const wrapper = mount(CodigosQrView, { global: { plugins: [router], stubs: { teleport: true } } })
  await flushPromises()
  return { wrapper, router }
}

type Wrapper = Awaited<ReturnType<typeof mountView>>['wrapper']
const button = (wrapper: Wrapper, label: string) => wrapper.findAll('button').find((b) => b.text().includes(label))!
const rows = (wrapper: Wrapper) => wrapper.findAll('.label-print-list__row')

async function search(wrapper: Wrapper, term: string) {
  await wrapper.get('input[type="search"]').setValue(term)
  vi.advanceTimersByTime(350)
  await flushPromises()
}

async function addProduct(wrapper: Wrapper, term: string, n: number) {
  await search(wrapper, term)
  const row = wrapper.findAll('.product-search-picker__row').find((r) => r.text().includes(`Producto ${n}`))!
  await row.get('button').trigger('click')
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.mocked(ProductsService.listProducts).mockResolvedValue({ items: [product(1), product(2)], total: 2, page: 1, limit: 10 })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('CodigosQrView — buscar y agregar', () => {
  it('buscar pide al servicio con los parámetros correctos y muestra resultados', async () => {
    const { wrapper } = await mountView()
    await search(wrapper, 'prod')
    expect(ProductsService.listProducts).toHaveBeenCalledWith({ search: 'prod', limit: 10, page: 1, includeInactive: false })
    expect(wrapper.text()).toContain('Producto 1')
    expect(wrapper.text()).toContain('Producto 2')
  })

  it('"Agregar" suma el producto a la lista de impresión con copies: 1', async () => {
    const { wrapper } = await mountView()
    await addProduct(wrapper, 'prod', 1)
    expect(rows(wrapper)).toHaveLength(1)
    expect(rows(wrapper)[0].text()).toContain('Producto 1')
    expect(rows(wrapper)[0].get('.quantity-stepper__value').text()).toBe('1')
  })

  it('agregar el MISMO producto de nuevo incrementa copies en vez de duplicar la fila', async () => {
    const { wrapper } = await mountView()
    await addProduct(wrapper, 'prod', 1)
    await addProduct(wrapper, 'prod', 1)
    expect(rows(wrapper)).toHaveLength(1)
    expect(rows(wrapper)[0].get('.quantity-stepper__value').text()).toBe('2')
  })

  it('una búsqueda vacía no llama al servicio', async () => {
    const { wrapper } = await mountView()
    await search(wrapper, 'prod')
    vi.mocked(ProductsService.listProducts).mockClear()
    await search(wrapper, '')
    expect(ProductsService.listProducts).not.toHaveBeenCalled()
  })

  it('error de red al buscar: aviso + reintentar', async () => {
    vi.mocked(ProductsService.listProducts).mockRejectedValueOnce({ isAxiosError: true, request: {} })
    const { wrapper } = await mountView()
    await search(wrapper, 'prod')
    expect(wrapper.text()).toContain(VOICE.networkError)
    vi.mocked(ProductsService.listProducts).mockResolvedValueOnce({ items: [product(1)], total: 1, page: 1, limit: 10 })
    await button(wrapper, VOICE.codigosQr.retry).trigger('click')
    await flushPromises()
    expect(wrapper.text()).not.toContain(VOICE.networkError)
    expect(wrapper.text()).toContain('Producto 1')
  })
})

describe('CodigosQrView — lista de impresión', () => {
  it('el stepper +/− respeta el mínimo 1 y "Quitar" saca la fila', async () => {
    const { wrapper } = await mountView()
    await addProduct(wrapper, 'prod', 1)
    await rows(wrapper)[0].get('[data-action="increment"]').trigger('click')
    expect(rows(wrapper)[0].get('.quantity-stepper__value').text()).toBe('2')
    await rows(wrapper)[0].get('[data-action="decrement"]').trigger('click')
    expect(rows(wrapper)[0].get('.quantity-stepper__value').text()).toBe('1')
    await rows(wrapper)[0].get('[data-action="decrement"]').trigger('click')
    expect(rows(wrapper)).toHaveLength(0)
  })

  it('"Quitar" saca la fila sin importar el conteo', async () => {
    const { wrapper } = await mountView()
    await addProduct(wrapper, 'prod', 1)
    await rows(wrapper)[0].get('[data-action="increment"]').trigger('click')
    const quitar = rows(wrapper)[0].findAll('button').find((b) => b.text() === VOICE.codigosQr.remove)!
    await quitar.trigger('click')
    expect(rows(wrapper)).toHaveLength(0)
  })

  it('el resumen calcula hojas correctamente: 72 -> 1 hoja, 73 -> 2 hojas', async () => {
    const { wrapper } = await mountView()
    await addProduct(wrapper, 'prod', 1)
    for (let i = 0; i < 71; i += 1) {
      await rows(wrapper)[0].get('[data-action="increment"]').trigger('click')
    }
    expect(wrapper.get('.label-print-list__summary').text()).toBe(VOICE.labels.summary(72, 1))
    await rows(wrapper)[0].get('[data-action="increment"]').trigger('click')
    expect(wrapper.get('.label-print-list__summary').text()).toBe(VOICE.labels.summary(73, 2))
  })
})

describe('CodigosQrView — generar PDF', () => {
  it('repite el id y el nombre según las copias, en el orden en que se agregaron', async () => {
    const { wrapper } = await mountView()
    await addProduct(wrapper, 'prod', 1)
    await rows(wrapper)[0].get('[data-action="increment"]').trigger('click')
    await rows(wrapper)[0].get('[data-action="increment"]').trigger('click') // Producto 1: copies 3
    await addProduct(wrapper, 'prod', 2) // Producto 2: copies 1

    await button(wrapper, VOICE.labels.print).trigger('click')
    await button(wrapper, VOICE.labels.preview).trigger('click')
    await button(wrapper, VOICE.labels.download).trigger('click')

    const expected = [
      { id: 'p-1', name: 'Producto 1' },
      { id: 'p-1', name: 'Producto 1' },
      { id: 'p-1', name: 'Producto 1' },
      { id: 'p-2', name: 'Producto 2' },
    ]
    expect(printing.preview).toHaveBeenCalledWith(expected)
    expect(printing.download).toHaveBeenCalledWith(expected)
  })

  it('el botón de imprimir empieza deshabilitado sin nada en la lista', async () => {
    const { wrapper } = await mountView()
    expect(button(wrapper, VOICE.labels.print).attributes('disabled')).toBeDefined()
  })

  it('los ajustes del diálogo se guardan en la calibración', async () => {
    const { wrapper } = await mountView()
    await addProduct(wrapper, 'prod', 1)
    await button(wrapper, VOICE.labels.print).trigger('click')
    const input = wrapper.findAll('label').find((l) => l.text().includes(VOICE.labels.offsetTop))!.element.parentElement!.querySelector('input') as HTMLInputElement
    input.value = '1.5'
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(useLabelCalibrationStore().calibration.offsetTopMm).toBe(1.5)
  })
})

describe('CodigosQrView — permisos vivos', () => {
  it('leaves for the app home when the mode changes to Venta', async () => {
    const { wrapper, router } = await mountView()
    expect(router.currentRoute.value.name).toBe('CodigosQr')
    useUiModeStore().setMode('venta')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('AppHome')
    expect(wrapper).toBeTruthy()
  })

  it('leaves for the app home when the person is no longer a socio', async () => {
    const { router } = await mountView()
    useSessionStore().setMember({ ...SOCIO, role: 'colaborador' })
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('AppHome')
  })

  it('stays put while nothing changes', async () => {
    const { router } = await mountView()
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('CodigosQr')
  })
})
