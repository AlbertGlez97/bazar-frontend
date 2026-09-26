// Pantalla de venta (contenedor): stores REALES (carrito, catálogo, cobro,
// cola) sobre fake-indexeddb y componentes reales; solo se simulan la red
// (SalesService, ProductsService) y la cámara (adaptador del lector de QR).
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import SaleView from '../SaleView.vue'
import SyncStatusIndicator from '@/components/ui/organisms/SyncStatusIndicator.vue'
import { useCartStore } from '@/stores/cart.store'
import { useSaleCatalogStore } from '@/stores/sale-catalog.store'
import { useSalesQueueStore } from '@/stores/sales-queue.store'
import { useSessionStore } from '@/stores/session.store'
import { useToastStore } from '@/stores/toast.store'
import { closeLocalDb } from '@/services/local-db'
import * as salesQueue from '@/services/sales-queue'
import SalesService from '@/services/sales.service'
import ProductsService from '@/services/products.service'
import { makeProduct } from '@/test/factories'
import { mockDevice, type MockDevice } from '@/test/mockDevice'
import type { CreateSalePayload, CreateSaleResult, Sale } from '@/types/sale.types'

vi.mock('@/services/sales.service', () => ({ default: { createSale: vi.fn() } }))
vi.mock('@/services/products.service', () => ({ default: { listProducts: vi.fn() } }))

const { startQrScanner, getScanSupport } = vi.hoisted(() => ({
  startQrScanner: vi.fn(),
  getScanSupport: vi.fn(() => 'ok'),
}))
vi.mock('@/services/qr-scanner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/qr-scanner')>()),
  startQrScanner,
  getScanSupport,
}))

const realIndexedDb = globalThis.indexedDB

const MEMBER = { id: '10000000-0000-4000-8000-000000000003', name: 'Carlos', role: 'socio' as const, active: true }
const DEVICE = { deviceId: '20000000-0000-4000-8000-000000000001', name: 'Tablet' }

const CAFE = makeProduct({ name: 'Café de olla', unitPriceMinor: 1999, stock: 5, category: 'Bebidas' })
const PAN = makeProduct({ name: 'Pan dulce', unitPriceMinor: 850, stock: 20, category: 'Panadería' })
const RADIO = makeProduct({ name: 'Radio vintage', tipo: 'unica', unitPriceMinor: 45000, stock: 1, initialStock: 1 })
const JARRITO = makeProduct({ name: 'Jarrito', unitPriceMinor: 1200, stock: 0 })

const createSale = vi.mocked(SalesService.createSale)
const listProducts = vi.mocked(ProductsService.listProducts)

function saleFor(payload: CreateSalePayload, status: Sale['status'] = 'completada', totalMinor = 1999): Sale {
  const rejected = status === 'rechazada_por_conflicto'
  return {
    id: payload.id, memberId: payload.memberId, deviceId: payload.deviceId, occurredAt: payload.occurredAt,
    receivedAt: '2026-09-25T12:00:01.000Z', currency: 'MXN', status,
    totalMinor: rejected ? null : totalMinor, cashReceivedMinor: payload.cashReceivedMinor,
    changeMinor: rejected ? null : payload.cashReceivedMinor - totalMinor,
    conflictReason: rejected ? 'stock insuficiente al sincronizar: producto x' : null,
    conflictDetectedAt: rejected ? '2026-09-25T12:00:01.000Z' : null, items: [],
  }
}
const completed = (p: CreateSalePayload, totalMinor?: number): CreateSaleResult => ({
  outcome: 'completed', httpStatus: 201, replayed: false, sale: saleFor(p, 'completada', totalMinor),
})
const conflict = (p: CreateSalePayload): CreateSaleResult => ({
  outcome: 'conflict', httpStatus: 201, replayed: false, sale: saleFor(p, 'rechazada_por_conflicto'),
})
const httpError = (status: number, message = 'x') => ({ isAxiosError: true, response: { status, data: { message } } })

function setOnline(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online)
}

async function mountSale(path = '/app/venta') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/app/venta', name: 'Sale', component: SaleView },
      { path: '/login', name: 'Login', component: { template: '<div />' } },
    ],
  })
  router.push(path)
  await router.isReady()
  const wrapper = mount(SaleView, { global: { plugins: [router], stubs: { teleport: true } } })
  await flushPromises()
  // IndexedDB (fake) no resuelve en microtareas: se espera a que el catálogo termine de cargar
  await vi.waitFor(() => expect(useSaleCatalogStore().loading).toBe(false))
  return { wrapper, router }
}

type Wrapper = Awaited<ReturnType<typeof mountSale>>['wrapper']

const card = (w: Wrapper, name: string) => w.findAll('button.sale-picker__item').find((b) => b.text().includes(name))!
const cards = (w: Wrapper) => w.findAll('button.sale-picker__item')
const lines = (w: Wrapper) => w.findAll('.cart-line')
const chargeBtn = (w: Wrapper) => w.get('button[data-action="charge"]')
const cashInput = (w: Wrapper) => w.get('.cash-input input')
const toasts = () => useToastStore().toasts.map((t) => t.message)

async function tap(w: Wrapper, name: string) {
  await card(w, name).trigger('click')
}

async function payWith(w: Wrapper, text: string) {
  await cashInput(w).setValue(text)
}

/** Toca "Cobrar" y espera a que aparezca la pantalla de resultado (la cola usa IndexedDB). */
async function submit(w: Wrapper) {
  await chargeBtn(w).trigger('click')
  await vi.waitFor(() => expect(w.find('.sale-result').exists()).toBe(true))
}

async function sellCafe(w: Wrapper, cash = '100') {
  await tap(w, 'Café de olla')
  await payWith(w, cash)
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  closeLocalDb()
  globalThis.indexedDB = new IDBFactory()
  setActivePinia(createPinia())
  createSale.mockReset()
  createSale.mockImplementation(async (payload) => completed(payload))
  listProducts.mockReset()
  listProducts.mockResolvedValue({ items: [CAFE, PAN, RADIO, JARRITO], total: 4, page: 1, limit: 100 })
  startQrScanner.mockReset()
  getScanSupport.mockReset()
  getScanSupport.mockReturnValue('ok')
  setOnline(true)
  const session = useSessionStore()
  session.setDevice(DEVICE)
  session.setMember(MEMBER)
})

afterEach(() => {
  vi.restoreAllMocks()
  closeLocalDb()
  globalThis.indexedDB = realIndexedDb
})

describe('SaleView — catálogo y carrito a la vez', () => {
  it('al montar carga TODO el catálogo activo (limit 100) y muestra los productos', async () => {
    const { wrapper } = await mountSale()
    expect(listProducts).toHaveBeenCalledWith({ page: 1, limit: 100 })
    expect(cards(wrapper)).toHaveLength(4)
    expect(wrapper.find('.sale-cart').exists()).toBe(true)
    expect(wrapper.find('.sale-picker').exists()).toBe(true)
  })

  it('tocar un producto lo agrega; tocarlo otra vez suma una pieza', async () => {
    const { wrapper } = await mountSale()

    await tap(wrapper, 'Café de olla')
    expect(lines(wrapper)).toHaveLength(1)
    expect(wrapper.get('.cart-line__subtotal').text()).toBe('$19.99')

    await tap(wrapper, 'Café de olla')
    expect(lines(wrapper)).toHaveLength(1)
    expect(wrapper.get('.quantity-stepper__value').text()).toBe('2')
    expect(wrapper.get('.cart-line__subtotal').text()).toBe('$39.98')
    expect(wrapper.get('.cart-summary__total').text()).toBe('$39.98')
  })

  it('lo agregado se marca "En tu venta" en el catálogo', async () => {
    const { wrapper } = await mountSale()
    await tap(wrapper, 'Pan dulce')
    expect(card(wrapper, 'Pan dulce').text()).toContain('En tu venta')
    expect(card(wrapper, 'Café de olla').text()).not.toContain('En tu venta')
  })

  it('una pieza única se agrega una vez; al repetirla avisa con un mensaje amable', async () => {
    const { wrapper } = await mountSale()
    await tap(wrapper, 'Radio vintage')
    await tap(wrapper, 'Radio vintage')

    expect(lines(wrapper)).toHaveLength(1)
    expect(wrapper.text()).toContain('Pieza única')
    expect(toasts()).toEqual(['Radio vintage es una pieza única y ya está en tu venta.'])
  })

  it('un producto agotado no se agrega', async () => {
    const { wrapper } = await mountSale()
    expect(card(wrapper, 'Jarrito').attributes('aria-disabled')).toBe('true')
    await tap(wrapper, 'Jarrito')
    expect(lines(wrapper)).toHaveLength(0)
  })

  it('"+" y "−" cambian la cantidad y el total al instante', async () => {
    const { wrapper } = await mountSale()
    await tap(wrapper, 'Pan dulce')
    await wrapper.get('button[data-action="increment"]').trigger('click')
    await wrapper.get('button[data-action="increment"]').trigger('click')
    expect(wrapper.get('.quantity-stepper__value').text()).toBe('3')
    expect(wrapper.get('.cart-summary__total').text()).toBe('$25.50')

    await wrapper.get('button[data-action="decrement"]').trigger('click')
    expect(wrapper.get('.quantity-stepper__value').text()).toBe('2')
    expect(wrapper.get('.cart-summary__total').text()).toBe('$17.00')
  })

  it('tocar "+" en el tope de existencia avisa "Ya no hay más piezas" sin cambiar nada', async () => {
    const { wrapper } = await mountSale()
    for (let i = 0; i < 5; i += 1) await tap(wrapper, 'Café de olla') // stock 5
    expect(wrapper.get('.quantity-stepper__value').text()).toBe('5')

    await wrapper.get('button[data-action="increment"]').trigger('click')

    expect(wrapper.get('.quantity-stepper__value').text()).toBe('5')
    expect(toasts()).toContain('Ya no hay más piezas de Café de olla.')
  })

  it('tocar el catálogo por encima del stock también avisa', async () => {
    const { wrapper } = await mountSale()
    for (let i = 0; i < 6; i += 1) await tap(wrapper, 'Café de olla')
    expect(wrapper.get('.quantity-stepper__value').text()).toBe('5')
    expect(toasts()).toEqual(['Ya no hay más piezas de Café de olla.'])
  })

  it('"−" en 1 no quita el producto: explica que se usa "Quitar"', async () => {
    const { wrapper } = await mountSale()
    await tap(wrapper, 'Pan dulce')
    await wrapper.get('button[data-action="decrement"]').trigger('click')
    expect(lines(wrapper)).toHaveLength(1)
    expect(toasts()).toEqual(['Para quitar el producto toca «Quitar».'])
  })

  it('"Quitar" saca la línea y el total baja', async () => {
    const { wrapper } = await mountSale()
    await tap(wrapper, 'Pan dulce')
    await tap(wrapper, 'Café de olla')
    expect(wrapper.get('.cart-summary__total').text()).toBe('$28.49')

    await lines(wrapper)[0].get('button[data-action="remove"]').trigger('click')

    expect(lines(wrapper)).toHaveLength(1)
    expect(wrapper.get('.cart-summary__total').text()).toBe('$19.99')
  })

  it('"Vaciar" pide confirmación y solo vacía con "Sí, vaciar"', async () => {
    const { wrapper } = await mountSale()
    await sellCafe(wrapper, '50')

    await wrapper.get('button[data-action="clear"]').trigger('click')
    expect(lines(wrapper)).toHaveLength(1)
    await wrapper.findAll('button').find((b) => b.text() === 'Mejor no')!.trigger('click')
    expect(lines(wrapper)).toHaveLength(1)

    await wrapper.get('button[data-action="clear"]').trigger('click')
    await wrapper.findAll('button').find((b) => b.text() === 'Sí, vaciar')!.trigger('click')
    expect(lines(wrapper)).toHaveLength(0)
    expect(wrapper.find('.cash-input').exists()).toBe(false)
    expect(useCartStore().cashReceivedMinor).toBe(0)
  })
})

describe('SaleView — búsqueda y categorías', () => {
  it('escribir en el buscador filtra al instante (sin esperar)', async () => {
    const { wrapper } = await mountSale()
    await wrapper.get('input[type="search"]').setValue('pan')
    expect(cards(wrapper)).toHaveLength(1)
    expect(cards(wrapper)[0].text()).toContain('Pan dulce')
  })

  it('la búsqueda ignora acentos y mayúsculas', async () => {
    const { wrapper } = await mountSale()
    await wrapper.get('input[type="search"]').setValue('CAFE')
    expect(cards(wrapper)).toHaveLength(1)
    expect(cards(wrapper)[0].text()).toContain('Café de olla')
  })

  it('sin coincidencias dice "No encontramos ese producto."', async () => {
    const { wrapper } = await mountSale()
    await wrapper.get('input[type="search"]').setValue('zzzz')
    expect(wrapper.text()).toContain('No encontramos ese producto.')
  })

  it('las categorías del catálogo aparecen como filtro y filtran de un toque', async () => {
    const { wrapper } = await mountSale()
    const buttons = wrapper.get('.category-filter').findAll('button')
    expect(buttons.map((b) => b.text())).toEqual(['Todo', 'Bebidas', 'Panadería'])

    await buttons[2].trigger('click')
    expect(cards(wrapper)).toHaveLength(1)
    expect(cards(wrapper)[0].text()).toContain('Pan dulce')

    await wrapper.get('.category-filter').findAll('button')[0].trigger('click')
    expect(cards(wrapper)).toHaveLength(4)
  })

  it('filtrar no vacía el carrito', async () => {
    const { wrapper } = await mountSale()
    await tap(wrapper, 'Café de olla')
    await wrapper.get('input[type="search"]').setValue('pan')
    expect(lines(wrapper)).toHaveLength(1)
  })
})

describe('SaleView — lector de QR', () => {
  async function openScanner(wrapper: Wrapper) {
    let onDecode: (text: string) => void = () => undefined
    startQrScanner.mockImplementation(async (_video: HTMLVideoElement, cb: (text: string) => void) => {
      onDecode = cb
      return { stop: vi.fn() }
    })
    await wrapper.get('button[data-action="scan"]').trigger('click')
    await flushPromises()
    return { read: async (text: string) => { onDecode(text); await flushPromises() } }
  }
  const feedback = (w: Wrapper) => w.get('.qr-scanner__feedback').text()

  it('"Escanear" abre la cámara', async () => {
    const { wrapper } = await mountSale()
    await openScanner(wrapper)
    expect(startQrScanner).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Escanear producto')
  })

  it('un QR con el id de un producto lo agrega y lo confirma con su nombre', async () => {
    const { wrapper } = await mountSale()
    const scanner = await openScanner(wrapper)

    await scanner.read(CAFE.id)

    expect(lines(wrapper)).toHaveLength(1)
    expect(wrapper.get('.cart-line__name').text()).toBe('Café de olla')
    expect(feedback(wrapper)).toBe('Café de olla: agregado a tu venta.')
  })

  it('un QR con una URL que trae el id también funciona', async () => {
    const { wrapper } = await mountSale()
    const scanner = await openScanner(wrapper)
    await scanner.read(`https://tienda.example/p/${PAN.id}`)
    expect(lines(wrapper)).toHaveLength(1)
  })

  it('un QR desconocido avisa con un mensaje amable y no toca la venta', async () => {
    const { wrapper } = await mountSale()
    const scanner = await openScanner(wrapper)

    await scanner.read('https://cualquier-cosa.example/qr')

    expect(lines(wrapper)).toHaveLength(0)
    expect(feedback(wrapper)).toBe('No reconocemos ese código. Prueba con otro producto o búscalo por su nombre.')
    expect(feedback(wrapper)).not.toMatch(/error|undefined|null/i)
  })

  it('escanear un producto agotado explica que está agotado', async () => {
    const { wrapper } = await mountSale()
    const scanner = await openScanner(wrapper)
    await scanner.read(JARRITO.id)
    expect(lines(wrapper)).toHaveLength(0)
    expect(feedback(wrapper)).toBe('Jarrito está agotado.')
  })

  it('escanear una pieza única que ya está en la venta lo explica', async () => {
    const { wrapper } = await mountSale()
    const scanner = await openScanner(wrapper)
    await scanner.read(RADIO.id)
    await scanner.read(`otro-${RADIO.id}`)
    expect(lines(wrapper)).toHaveLength(1)
    expect(feedback(wrapper)).toBe('Radio vintage es una pieza única y ya está en tu venta.')
  })

  it('cerrar con "Listo" apaga la cámara', async () => {
    const { wrapper } = await mountSale()
    const stop = vi.fn()
    startQrScanner.mockResolvedValue({ stop })
    await wrapper.get('button[data-action="scan"]').trigger('click')
    await flushPromises()

    await wrapper.findAll('button').find((b) => b.text() === 'Listo')!.trigger('click')
    await flushPromises()

    expect(stop).toHaveBeenCalled()
  })

  it('al reabrir el lector el aviso anterior ya no está', async () => {
    const { wrapper } = await mountSale()
    const scanner = await openScanner(wrapper)
    await scanner.read('desconocido')
    await wrapper.findAll('button').find((b) => b.text() === 'Listo')!.trigger('click')
    await openScanner(wrapper)
    expect(feedback(wrapper)).toBe('')
  })
})

describe('SaleView — efectivo y cambio', () => {
  it('sin efectivo "Cobrar" está apagado y dice por qué', async () => {
    const { wrapper } = await mountSale()
    await tap(wrapper, 'Café de olla')

    expect(chargeBtn(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Escribe el efectivo recibido para poder cobrar.')
  })

  it('escribir el efectivo actualiza el cambio en vivo', async () => {
    const { wrapper } = await mountSale()
    await tap(wrapper, 'Café de olla') // $19.99

    await payWith(wrapper, '10')
    expect(wrapper.get('.cart-summary').attributes('data-state')).toBe('missing')
    expect(wrapper.get('.cart-summary__status').text()).toContain('Faltan $9.99')

    await payWith(wrapper, '20')
    expect(wrapper.get('.cart-summary').attributes('data-state')).toBe('ok')
    expect(wrapper.get('.cart-summary__change').text()).toBe('$0.01')

    await payWith(wrapper, '100.50')
    expect(wrapper.get('.cart-summary__change').text()).toBe('$80.51')
  })

  it('la coma agrupa miles: "1,000" son mil pesos y "1,000.50" mil pesos con cincuenta centavos', async () => {
    const { wrapper } = await mountSale()
    await tap(wrapper, 'Café de olla') // $19.99

    await payWith(wrapper, '1,000')
    expect(useCartStore().cashReceivedMinor).toBe(100000)
    expect(wrapper.get('.cart-summary__change').text()).toBe('$980.01')
    expect(chargeBtn(wrapper).attributes('disabled')).toBeUndefined()

    await payWith(wrapper, '1,000.50')
    expect(useCartStore().cashReceivedMinor).toBe(100050)
    expect(wrapper.get('.cart-summary__change').text()).toBe('$980.51')
  })

  it('un monto ambiguo ("100,50") no se adivina: avisa, conserva lo escrito y bloquea "Cobrar"', async () => {
    const { wrapper } = await mountSale()
    await tap(wrapper, 'Café de olla')
    await payWith(wrapper, '100')
    expect(chargeBtn(wrapper).attributes('disabled')).toBeUndefined()

    await payWith(wrapper, '100,50')
    expect(useCartStore().cashInvalid).toBe(true)
    expect(wrapper.get('.cash-input__error').text()).toContain('1,000.50')
    expect((cashInput(wrapper).element as HTMLInputElement).value).toBe('100,50')
    expect(chargeBtn(wrapper).attributes('disabled')).toBeDefined()

    await payWith(wrapper, '100.50')
    expect(wrapper.find('.cash-input__error').exists()).toBe(false)
    expect(chargeBtn(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('"Cobrar" se enciende justo cuando el efectivo alcanza (>= total)', async () => {
    const { wrapper } = await mountSale()
    await tap(wrapper, 'Café de olla')

    await payWith(wrapper, '19.98')
    expect(chargeBtn(wrapper).attributes('disabled')).toBeDefined()
    await payWith(wrapper, '19.99')
    expect(chargeBtn(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('el atajo "Justo" y los billetes llenan el campo y el cambio', async () => {
    const { wrapper } = await mountSale()
    await tap(wrapper, 'Café de olla')

    await wrapper.findAll('.cash-input__chip').find((c) => c.text() === 'Justo')!.trigger('click')
    expect((cashInput(wrapper).element as HTMLInputElement).value).toBe('19.99')
    expect(chargeBtn(wrapper).attributes('disabled')).toBeUndefined()

    await wrapper.findAll('.cash-input__chip').find((c) => c.text() === '$50')!.trigger('click')
    expect(wrapper.get('.cart-summary__change').text()).toBe('$30.01')
  })

  it('agregar más productos después de escribir el efectivo vuelve a apagar "Cobrar" si ya no alcanza', async () => {
    const { wrapper } = await mountSale()
    await sellCafe(wrapper, '20')
    expect(chargeBtn(wrapper).attributes('disabled')).toBeUndefined()

    await tap(wrapper, 'Café de olla')

    expect(chargeBtn(wrapper).attributes('disabled')).toBeDefined()
  })

  it('el efectivo sobrevive a volver a montar la pantalla con la venta en curso', async () => {
    const first = await mountSale()
    await sellCafe(first.wrapper, '50')
    first.wrapper.unmount()

    const second = await mountSale()
    expect((cashInput(second.wrapper).element as HTMLInputElement).value).toBe('50')
    expect(lines(second.wrapper)).toHaveLength(1)
  })
})

describe('SaleView — cobro exitoso', () => {
  it('muestra "Venta registrada" con el total y el cambio del SERVIDOR (no los locales)', async () => {
    const { wrapper } = await mountSale()
    createSale.mockImplementation(async (payload) => completed(payload, 2500)) // el servidor cobró distinto
    await sellCafe(wrapper, '100')

    await submit(wrapper)

    expect(wrapper.get('h2').text()).toBe('Venta registrada')
    expect(wrapper.get('.sale-result__total').text()).toContain('$25.00')
    expect(wrapper.get('.sale-result__change').text()).toContain('$75.00')
    expect(wrapper.text()).not.toContain('$19.99')
    expect(wrapper.text()).toContain('Quedó a nombre de Carlos.')
    expect(wrapper.find('.sale-picker').exists()).toBe(false)
  })

  it('envía a la API exactamente lo del carrito (ids, cantidades, efectivo en centavos)', async () => {
    const { wrapper } = await mountSale()
    await tap(wrapper, 'Café de olla')
    await tap(wrapper, 'Café de olla')
    await payWith(wrapper, '100')

    await submit(wrapper)

    expect(createSale).toHaveBeenCalledTimes(1)
    const payload = createSale.mock.calls[0][0]
    expect(payload.items).toEqual([{ productId: CAFE.id, quantity: 2, unitPriceMinor: 1999 }])
    expect(payload.cashReceivedMinor).toBe(10000)
    expect(payload.memberId).toBe(MEMBER.id)
    expect(payload.deviceId).toBe(DEVICE.deviceId)
  })

  it('el botón "Nueva venta" limpia carrito y efectivo y regresa a vender', async () => {
    const { wrapper } = await mountSale()
    await sellCafe(wrapper)
    await submit(wrapper)

    await wrapper.get('button.sale-result__primary').trigger('click')

    expect(wrapper.find('.sale-result').exists()).toBe(false)
    expect(lines(wrapper)).toHaveLength(0)
    expect(useCartStore().cashReceivedMinor).toBe(0)
    expect(wrapper.find('.cash-input').exists()).toBe(false)
    expect(cards(wrapper)).toHaveLength(4)
  })

  it('tras la venta el stock local baja y la siguiente venta lo respeta', async () => {
    const { wrapper } = await mountSale()
    await tap(wrapper, 'Radio vintage')
    await payWith(wrapper, '500')
    await submit(wrapper)
    await wrapper.get('button.sale-result__primary').trigger('click')

    expect(card(wrapper, 'Radio vintage').attributes('aria-disabled')).toBe('true')
    expect(card(wrapper, 'Radio vintage').text()).toContain('Agotado')
  })

  it('el efectivo del campo está vacío en la venta nueva', async () => {
    const { wrapper } = await mountSale()
    await sellCafe(wrapper)
    await submit(wrapper)
    await wrapper.get('button.sale-result__primary').trigger('click')

    await tap(wrapper, 'Pan dulce')
    expect((cashInput(wrapper).element as HTMLInputElement).value).toBe('')
  })

  it('doble toque en "Cobrar" envía UNA sola venta', async () => {
    const { wrapper } = await mountSale()
    let release: () => void = () => undefined
    createSale.mockImplementation((payload) => new Promise((resolve) => { release = () => resolve(completed(payload)) }))
    await sellCafe(wrapper)

    const button = chargeBtn(wrapper)
    await button.trigger('click')
    await button.trigger('click')
    await button.trigger('click')
    expect(createSale).toHaveBeenCalledTimes(1)
    // Mientras cobra: botón bloqueado y con su texto
    expect(chargeBtn(wrapper).text()).toContain('Cobrando…')
    expect(chargeBtn(wrapper).attributes('disabled')).toBeDefined()

    release()
    await vi.waitFor(() => expect(wrapper.find('.sale-result').exists()).toBe(true))
    expect(createSale).toHaveBeenCalledTimes(1)
    expect(wrapper.get('h2').text()).toBe('Venta registrada')
  })
})

describe('SaleView — conflicto (NUNCA como éxito)', () => {
  it('muestra la pantalla de conflicto, distinta a la de éxito, con lo que hay que hacer', async () => {
    const { wrapper } = await mountSale()
    createSale.mockImplementation(async (payload) => conflict(payload))
    await sellCafe(wrapper)

    await submit(wrapper)

    expect(wrapper.get('h2').text()).toBe('Esta venta no se pudo cobrar')
    expect(wrapper.get('.sale-result').classes()).toContain('sale-result--conflict')
    expect(wrapper.get('.sale-result').classes()).not.toContain('sale-result--success')
    expect(wrapper.text()).not.toContain('Venta registrada')
    expect(wrapper.text()).not.toContain('Listo, ya quedó')
    expect(wrapper.text()).toContain('Otra venta se llevó la última pieza')
    expect(wrapper.text()).toContain('no entregues el producto')
    expect(wrapper.find('.sale-result__total').exists()).toBe(false)
  })

  it('el motivo del servidor es solo un detalle plegado; el stock local NO baja', async () => {
    const { wrapper } = await mountSale()
    createSale.mockImplementation(async (payload) => conflict(payload))
    await tap(wrapper, 'Radio vintage')
    await payWith(wrapper, '500')
    await submit(wrapper)

    expect(wrapper.get('details').text()).toContain('stock insuficiente al sincronizar')
    expect(wrapper.get('details').attributes('open')).toBeUndefined()
    expect(useSaleCatalogStore().getById(RADIO.id)?.stock).toBe(1)
  })

  it('"Entendido, nueva venta" limpia todo y vuelve a vender', async () => {
    const { wrapper } = await mountSale()
    createSale.mockImplementation(async (payload) => conflict(payload))
    await sellCafe(wrapper)
    await submit(wrapper)

    const button = wrapper.get('button.sale-result__primary')
    expect(button.text()).toBe('Entendido, nueva venta')
    await button.trigger('click')

    expect(lines(wrapper)).toHaveLength(0)
    expect(wrapper.find('.sale-result').exists()).toBe(false)
  })
})

describe('SaleView — sin señal', () => {
  it('sin internet la venta queda guardada y la pantalla se siente como éxito', async () => {
    const { wrapper } = await mountSale()
    setOnline(false)
    await sellCafe(wrapper)

    await submit(wrapper)

    expect(createSale).not.toHaveBeenCalled()
    expect(wrapper.get('h2').text()).toBe('Listo, ya quedó')
    expect(wrapper.text()).toContain('Sin señal, pero tu venta está guardada y se manda sola cuando haya internet.')
    expect(wrapper.get('.sale-result__total').text()).toContain('$19.99')
    expect(wrapper.get('.sale-result__change').text()).toContain('$80.01')
    expect(wrapper.text()).not.toMatch(/error|falló/i)
    expect((await salesQueue.list()).map((r) => r.state)).toEqual(['pending'])
  })

  it('el indicador de pendientes sube a 1 y el catálogo local descuenta lo vendido', async () => {
    const { wrapper } = await mountSale()
    const queue = useSalesQueueStore()
    await queue.refreshCounts()
    const indicator = mount(SyncStatusIndicator, {
      props: { pendingCount: queue.pendingCount, needsReviewCount: 0, isSyncing: false, records: [] },
    })
    expect(indicator.find('.sync-status').exists()).toBe(false)

    setOnline(false)
    await tap(wrapper, 'Radio vintage')
    await payWith(wrapper, '500')
    await submit(wrapper)
    await vi.waitFor(() => expect(queue.pendingCount).toBe(1))

    await indicator.setProps({ pendingCount: queue.pendingCount })
    expect(indicator.get('.sync-status').text()).toContain('1 venta pendiente de sincronizar')
    expect(useSaleCatalogStore().getById(RADIO.id)?.stock).toBe(0)
  })

  it('un error de red al cobrar también se guarda como pendiente (resultado desconocido)', async () => {
    const { wrapper } = await mountSale()
    createSale.mockRejectedValue({ isAxiosError: true, code: 'ERR_NETWORK', message: 'Network Error' })
    await sellCafe(wrapper)

    await submit(wrapper)

    expect(wrapper.get('h2').text()).toBe('Listo, ya quedó')
    expect(await salesQueue.count()).toBe(1)
  })
})

describe('SaleView — otros resultados', () => {
  it('rechazada en línea (400): motivo amable y "Regresar a la venta" conserva carrito y efectivo', async () => {
    const { wrapper } = await mountSale()
    createSale.mockRejectedValueOnce(httpError(400, 'Insufficient stock for product x'))
    await sellCafe(wrapper, '100')

    await submit(wrapper)

    expect(wrapper.get('h2').text()).toBe('No pudimos registrar la venta')
    expect(wrapper.text()).toContain('Ya no hay suficientes piezas de uno de los productos')
    expect(wrapper.text()).not.toContain('Insufficient')
    expect(await salesQueue.count()).toBe(0)

    const back = wrapper.get('button.sale-result__primary')
    expect(back.text()).toBe('Regresar a la venta')
    await back.trigger('click')

    expect(wrapper.find('.sale-result').exists()).toBe(false)
    expect(lines(wrapper)).toHaveLength(1)
    expect((cashInput(wrapper).element as HTMLInputElement).value).toBe('100')
    expect(chargeBtn(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('tras regresar se puede reintentar y cobra con el MISMO id de venta', async () => {
    const { wrapper } = await mountSale()
    createSale.mockRejectedValueOnce(httpError(400, 'Insufficient stock for product x'))
    await sellCafe(wrapper)
    await submit(wrapper)
    await wrapper.get('button.sale-result__primary').trigger('click')

    await submit(wrapper)

    expect(createSale).toHaveBeenCalledTimes(2)
    expect(createSale.mock.calls[1][0].id).toBe(createSale.mock.calls[0][0].id)
    expect(wrapper.get('h2').text()).toBe('Venta registrada')
  })

  it('sesión vencida (401): la venta queda guardada, se explica y "Iniciar sesión" lleva al login', async () => {
    localStorage.setItem('access_token', 'jwt')
    localStorage.setItem('token_expires_at', String(Date.now() + 60_000))
    const { wrapper, router } = await mountSale()
    createSale.mockRejectedValueOnce(httpError(401))
    await sellCafe(wrapper)

    await submit(wrapper)

    expect(wrapper.get('h2').text()).toBe('Tu venta está guardada')
    expect(wrapper.text()).toContain('sigue guardada en este dispositivo')
    expect(await salesQueue.count()).toBe(1)
    expect(createSale.mock.calls[0][1]).toEqual({ handleAuthLocally: true })

    await wrapper.get('button.sale-result__primary').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('Login'))

    expect(localStorage.getItem('access_token')).toBeNull()
    expect(lines(wrapper)).toHaveLength(0)
    expect(await salesQueue.count()).toBe(1) // la venta sigue en la cola
  })

  it('sesión vencida: "Nueva venta" deja seguir vendiendo sin iniciar sesión todavía', async () => {
    const { wrapper } = await mountSale()
    createSale.mockRejectedValueOnce(httpError(401))
    await sellCafe(wrapper)
    await submit(wrapper)

    await wrapper.get('button.sale-result__secondary').trigger('click')

    expect(wrapper.find('.sale-result').exists()).toBe(false)
    expect(lines(wrapper)).toHaveLength(0)
  })

  it('no se pudo guardar en el dispositivo: mensaje honesto, carrito intacto y "Intentar de nuevo"', async () => {
    const { wrapper } = await mountSale()
    setOnline(false)
    const enqueue = vi.spyOn(salesQueue, 'enqueue').mockResolvedValueOnce({ ok: false, reason: 'storage-unavailable' })
    await sellCafe(wrapper)

    await submit(wrapper)

    expect(wrapper.get('h2').text()).toBe('No se guardó la venta')
    expect(wrapper.text()).toContain('Anótala aparte')
    expect(lines(wrapper)).toHaveLength(0) // la pantalla de resultado ocupa el lugar…

    // …pero el carrito sigue en el store
    expect(useCartStore().lines).toHaveLength(1)

    enqueue.mockRestore()
    await wrapper.get('button.sale-result__primary').trigger('click')
    await vi.waitFor(() => expect(wrapper.get('h2').text()).toBe('Listo, ya quedó'))
  })

  it('"Regresar a la venta" desde un fallo de guardado conserva el carrito', async () => {
    const { wrapper } = await mountSale()
    setOnline(false)
    vi.spyOn(salesQueue, 'enqueue').mockResolvedValue({ ok: false, reason: 'storage-unavailable' })
    await sellCafe(wrapper)
    await submit(wrapper)

    await wrapper.get('button.sale-result__secondary').trigger('click')

    expect(lines(wrapper)).toHaveLength(1)
  })
})

describe('SaleView — catálogo guardado y errores de carga', () => {
  it('sin red carga la copia guardada y lo avisa con calma', async () => {
    const first = await mountSale() // guarda el snapshot
    first.wrapper.unmount()
    setActivePinia(createPinia())
    const session = useSessionStore()
    session.setDevice(DEVICE)
    session.setMember(MEMBER)
    listProducts.mockRejectedValue({ isAxiosError: true, code: 'ERR_NETWORK', message: 'Network Error' })

    const { wrapper } = await mountSale()

    await vi.waitFor(() => expect(cards(wrapper)).toHaveLength(4))
    expect(wrapper.get('.sale-picker__notice').text()).toMatch(/Estás viendo el catálogo guardado/)
  })

  it('sin red y sin copia guardada muestra un mensaje amable con "Intentar de nuevo"', async () => {
    listProducts.mockRejectedValue({ isAxiosError: true, code: 'ERR_NETWORK', message: 'Network Error' })
    const { wrapper } = await mountSale()

    expect(wrapper.get('[role="alert"]').text()).toContain('No pudimos conectarnos')
    expect(wrapper.text()).not.toMatch(/ERR_NETWORK|Network Error/)

    listProducts.mockResolvedValue({ items: [CAFE], total: 1, page: 1, limit: 100 })
    await wrapper.get('button[data-action="retry"]').trigger('click')
    await flushPromises()
    expect(cards(wrapper)).toHaveLength(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Flujo de DOS PASOS en pantalla angosta (celular). El layout lo decide JS
// (`useDeviceCapabilities().isSmallScreen`), no una media query suelta, así que
// aquí se simula el dispositivo con `mockDevice`. Sin ese mock (jsdom no trae
// `matchMedia`) la pantalla es ANCHA: catálogo y carrito lado a lado.
// Paso 1: catálogo + búsqueda + escanear, con el carrito como barra fija abajo.
// Paso 2: pantalla completa con la venta entera; se abre con `?paso=cobro` para
// que el botón Atrás del navegador/celular regrese al Paso 1.
// ─────────────────────────────────────────────────────────────────────────
describe('SaleView — flujo de dos pasos en pantalla angosta', () => {
  let device: MockDevice | null = null
  afterEach(() => {
    device?.restore()
    device = null
  })

  async function mountNarrow(path = '/app/venta') {
    device = mockDevice({ touch: true, small: true })
    return mountSale(path)
  }
  const root = (w: Wrapper) => w.get('.sale-view')
  const bar = (w: Wrapper) => w.find('.sale-view__bar')
  const openCheckout = (w: Wrapper) => w.get('button[data-action="open-checkout"]')
  const closeCheckout = (w: Wrapper) => w.get('button[data-action="close-checkout"]')
  const isCheckout = (w: Wrapper) => root(w).classes().includes('sale-view--checkout')

  describe('pantalla ancha (sin cambios)', () => {
    it('catálogo y carrito lado a lado: sin barra fija, sin botón de volver, sin marca de celular', async () => {
      const { wrapper } = await mountSale()
      expect(root(wrapper).classes()).not.toContain('sale-view--narrow')
      expect(isCheckout(wrapper)).toBe(false)
      expect(bar(wrapper).exists()).toBe(false)
      expect(wrapper.find('button[data-action="close-checkout"]').exists()).toBe(false)
      expect(wrapper.find('.sale-picker').exists()).toBe(true)
      expect(wrapper.find('.sale-cart').exists()).toBe(true)
      expect(wrapper.get('.sale-view__cart').classes()).not.toContain('sale-view__cart--checkout')
    })

    it('con productos en el carrito sigue sin barra ni Paso 2, y el carrito no es "prominente"', async () => {
      const { wrapper } = await mountSale()
      await tap(wrapper, 'Pan dulce')
      expect(bar(wrapper).exists()).toBe(false)
      expect(wrapper.get('.sale-cart').classes()).not.toContain('sale-cart--checkout')
    })

    it('un ?paso=cobro en la URL no cambia nada en pantalla ancha', async () => {
      const { wrapper } = await mountSale('/app/venta?paso=cobro')
      await tap(wrapper, 'Pan dulce')
      expect(isCheckout(wrapper)).toBe(false)
      expect(wrapper.find('.sale-picker').exists()).toBe(true)
      expect(wrapper.get('.sale-cart').classes()).not.toContain('sale-cart--checkout')
    })
  })

  describe('Paso 1 (catálogo + barra)', () => {
    it('con el carrito vacío no hay barra: el catálogo ocupa toda la pantalla', async () => {
      const { wrapper } = await mountNarrow()
      expect(root(wrapper).classes()).toContain('sale-view--narrow')
      expect(isCheckout(wrapper)).toBe(false)
      expect(bar(wrapper).exists()).toBe(false)
      expect(wrapper.find('.sale-picker').exists()).toBe(true)
      expect(wrapper.find('button[data-action="scan"]').exists()).toBe(true)
      expect(wrapper.find('input[type="search"]').exists()).toBe(true)
    })

    it('al agregar un producto aparece la barra con piezas y total en vivo (dinero exacto)', async () => {
      const { wrapper } = await mountNarrow()
      await tap(wrapper, 'Pan dulce')
      expect(bar(wrapper).exists()).toBe(true)
      expect(bar(wrapper).attributes('role')).toBe('region')
      expect(bar(wrapper).attributes('aria-label')).toBe('Resumen de tu venta')
      expect(bar(wrapper).text()).toContain('1 pieza')
      expect(bar(wrapper).text()).toContain('$8.50')

      await tap(wrapper, 'Pan dulce')
      await tap(wrapper, 'Café de olla')
      expect(bar(wrapper).text()).toContain('3 piezas')
      expect(bar(wrapper).text()).toContain('$36.99') // 850 × 2 + 1999 = 3699 centavos
    })

    it('el botón de la barra dice "Cobrar →" y está habilitado', async () => {
      const { wrapper } = await mountNarrow()
      await tap(wrapper, 'Pan dulce')
      expect(openCheckout(wrapper).text()).toBe('Cobrar →')
      expect(openCheckout(wrapper).attributes('disabled')).toBeUndefined()
    })

    it('la barra desaparece si se vacía el carrito', async () => {
      const { wrapper } = await mountNarrow()
      await tap(wrapper, 'Pan dulce')
      useCartStore().clear()
      await flushPromises()
      expect(bar(wrapper).exists()).toBe(false)
    })

    it('el carrito completo NO se ofrece en el Paso 1: el contenedor no está en modo pantalla completa', async () => {
      const { wrapper } = await mountNarrow()
      await tap(wrapper, 'Pan dulce')
      expect(wrapper.get('.sale-view__cart').classes()).not.toContain('sale-view__cart--checkout')
      expect(wrapper.find('button[data-action="close-checkout"]').exists()).toBe(false)
    })
  })

  describe('Paso 2 (cobrar en pantalla completa)', () => {
    it('"Cobrar →" abre el Paso 2: pantalla completa, sin barra, con volver y el carrito prominente', async () => {
      const { wrapper, router } = await mountNarrow()
      await tap(wrapper, 'Pan dulce')
      await openCheckout(wrapper).trigger('click')
      await flushPromises()

      expect(router.currentRoute.value.query.paso).toBe('cobro')
      expect(isCheckout(wrapper)).toBe(true)
      expect(bar(wrapper).exists()).toBe(false)
      expect(wrapper.get('.sale-view__cart').classes()).toContain('sale-view__cart--checkout')
      expect(wrapper.get('.sale-cart').classes()).toContain('sale-cart--checkout')
      expect(closeCheckout(wrapper).text()).toContain('Seguir agregando')
    })

    it('muestra la venta completa: líneas, total, campo de efectivo y el Cobrar real', async () => {
      const { wrapper } = await mountNarrow()
      await tap(wrapper, 'Pan dulce')
      await tap(wrapper, 'Pan dulce')
      await openCheckout(wrapper).trigger('click')
      await flushPromises()

      expect(lines(wrapper)).toHaveLength(1)
      expect(wrapper.get('.cart-summary__total').text()).toBe('$17.00')
      expect(wrapper.find('.cash-input input').exists()).toBe(true)
      expect(chargeBtn(wrapper).text()).toBe('Cobrar')
    })

    it('el catálogo queda montado pero inaccesible debajo (inert + aria-hidden), sin perder su estado', async () => {
      const { wrapper } = await mountNarrow()
      await tap(wrapper, 'Pan dulce')
      await openCheckout(wrapper).trigger('click')
      await flushPromises()
      // `inert` va en el catálogo, NO en el contenedor: el carrito (Paso 2) tiene que seguir activo.
      const picker = wrapper.get('.sale-picker')
      expect(picker.attributes('inert')).toBeDefined()
      expect(picker.attributes('aria-hidden')).toBe('true')
      expect(wrapper.get('.sale-view__cart').attributes('inert')).toBeUndefined()
      expect(wrapper.get('.sale-view__layout').attributes('inert')).toBeUndefined()
    })

    it('en el Paso 1 y en pantalla ancha el catálogo NO está inerte', async () => {
      const narrow = await mountNarrow()
      await tap(narrow.wrapper, 'Pan dulce')
      expect(narrow.wrapper.get('.sale-picker').attributes('inert')).toBeUndefined()
      expect(narrow.wrapper.get('.sale-picker').attributes('aria-hidden')).toBeUndefined()
      narrow.wrapper.unmount()
      device?.restore(); device = null

      const wide = await mountSale()
      await tap(wide.wrapper, 'Pan dulce')
      expect(wide.wrapper.get('.sale-picker').attributes('inert')).toBeUndefined()
    })

    it('"Seguir agregando" vuelve al Paso 1 SIN perder lo agregado ni el efectivo escrito', async () => {
      const { wrapper, router } = await mountNarrow()
      await tap(wrapper, 'Pan dulce')
      await tap(wrapper, 'Café de olla')
      await openCheckout(wrapper).trigger('click')
      await flushPromises()
      await payWith(wrapper, '50')

      await closeCheckout(wrapper).trigger('click')
      await flushPromises()

      expect(isCheckout(wrapper)).toBe(false)
      expect(router.currentRoute.value.query.paso).toBeUndefined()
      expect(lines(wrapper)).toHaveLength(2)
      expect(bar(wrapper).text()).toContain('2 piezas')
      expect(bar(wrapper).text()).toContain('$28.49')
      expect(useCartStore().cashReceivedMinor).toBe(5000)
    })

    it('el botón Atrás del navegador/celular regresa del Paso 2 al Paso 1 (no sale de la venta)', async () => {
      const { wrapper, router } = await mountNarrow()
      await tap(wrapper, 'Pan dulce')
      await openCheckout(wrapper).trigger('click')
      await flushPromises()
      expect(isCheckout(wrapper)).toBe(true)

      router.back()
      await flushPromises()

      expect(router.currentRoute.value.path).toBe('/app/venta')
      expect(router.currentRoute.value.query.paso).toBeUndefined()
      expect(isCheckout(wrapper)).toBe(false)
      expect(lines(wrapper)).toHaveLength(1)
      expect(bar(wrapper).exists()).toBe(true)
    })

    it('"Seguir agregando" usa el historial (una sola entrada extra): abrir, cerrar y abrir otra vez no acumula pantallas', async () => {
      const { wrapper, router } = await mountNarrow()
      await tap(wrapper, 'Pan dulce')
      await openCheckout(wrapper).trigger('click'); await flushPromises()
      await closeCheckout(wrapper).trigger('click'); await flushPromises()
      await openCheckout(wrapper).trigger('click'); await flushPromises()
      expect(isCheckout(wrapper)).toBe(true)

      router.back(); await flushPromises()
      expect(isCheckout(wrapper)).toBe(false)
      expect(router.currentRoute.value.path).toBe('/app/venta')
    })

    it('quitar la última línea en el Paso 2 regresa al Paso 1 (no se queda en un cobro vacío)', async () => {
      const { wrapper } = await mountNarrow()
      await tap(wrapper, 'Pan dulce')
      await openCheckout(wrapper).trigger('click')
      await flushPromises()

      await wrapper.get('button[data-action="remove"]').trigger('click')
      await flushPromises()

      expect(isCheckout(wrapper)).toBe(false)
      expect(bar(wrapper).exists()).toBe(false)
    })

    it('recargar la página en ?paso=cobro con el carrito vacío cae en el Paso 1 y limpia la URL', async () => {
      const { wrapper, router } = await mountNarrow('/app/venta?paso=cobro')
      await flushPromises()
      expect(isCheckout(wrapper)).toBe(false)
      expect(router.currentRoute.value.query.paso).toBeUndefined()
    })

    it('"Seguir agregando" tras una recarga (sin entrada previa) reemplaza la URL en vez de salir de la venta', async () => {
      const { wrapper, router } = await mountNarrow('/app/venta?paso=cobro')
      await flushPromises()
      await tap(wrapper, 'Pan dulce')
      await openCheckout(wrapper).trigger('click')
      await flushPromises()
      await closeCheckout(wrapper).trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.path).toBe('/app/venta')
      expect(isCheckout(wrapper)).toBe(false)
    })
  })

  describe('cobrar desde el Paso 2', () => {
    it('Cobrar manda la venta con dinero exacto y la pantalla de resultado toma toda la pantalla', async () => {
      const { wrapper } = await mountNarrow()
      await tap(wrapper, 'Pan dulce')
      await tap(wrapper, 'Pan dulce')
      await openCheckout(wrapper).trigger('click')
      await flushPromises()
      await payWith(wrapper, '20')
      expect(wrapper.get('.cart-summary__change').text()).toBe('$3.00')

      await submit(wrapper)

      expect(createSale).toHaveBeenCalledTimes(1)
      const payload = createSale.mock.calls[0][0]
      expect(payload.cashReceivedMinor).toBe(2000)
      expect(payload.items).toHaveLength(1)
      expect(wrapper.find('.sale-cart').exists()).toBe(false)
    })

    it('"Nueva venta" regresa al Paso 1 con el carrito vacío, sin barra y con la URL limpia', async () => {
      const { wrapper, router } = await mountNarrow()
      await tap(wrapper, 'Café de olla')
      await openCheckout(wrapper).trigger('click')
      await flushPromises()
      await payWith(wrapper, '100')
      await submit(wrapper)

      await wrapper.get('button.sale-result__primary').trigger('click')
      await flushPromises()

      expect(isCheckout(wrapper)).toBe(false)
      expect(router.currentRoute.value.query.paso).toBeUndefined()
      expect(bar(wrapper).exists()).toBe(false)
      expect(useCartStore().isEmpty).toBe(true)
      expect(wrapper.find('.sale-picker').exists()).toBe(true)
    })

    it('mientras se cobra, el botón muestra "Cobrando…" y no se puede volver a tocar', async () => {
      const { wrapper } = await mountNarrow()
      createSale.mockImplementation(() => new Promise(() => undefined))
      await tap(wrapper, 'Café de olla')
      await openCheckout(wrapper).trigger('click')
      await flushPromises()
      await payWith(wrapper, '100')
      await chargeBtn(wrapper).trigger('click')
      expect(chargeBtn(wrapper).text()).toContain('Cobrando')
      expect(chargeBtn(wrapper).attributes('disabled')).toBeDefined()
    })

    it('una venta guardada sin señal también deja al Paso 1 listo para la siguiente', async () => {
      const { wrapper } = await mountNarrow()
      createSale.mockRejectedValue({ isAxiosError: true, code: 'ERR_NETWORK', message: 'Network Error' })
      setOnline(false)
      await tap(wrapper, 'Café de olla')
      await openCheckout(wrapper).trigger('click')
      await flushPromises()
      await payWith(wrapper, '100')
      await submit(wrapper)
      await wrapper.get('button.sale-result__primary').trigger('click')
      await flushPromises()
      expect(isCheckout(wrapper)).toBe(false)
      expect(useCartStore().isEmpty).toBe(true)
    })
  })

  describe('girar o cambiar el tamaño de la pantalla', () => {
    it('del Paso 2 en vertical a horizontal ancho: se ve todo lado a lado y no se pierde nada', async () => {
      const { wrapper } = await mountNarrow()
      await tap(wrapper, 'Pan dulce')
      await openCheckout(wrapper).trigger('click')
      await flushPromises()
      expect(isCheckout(wrapper)).toBe(true)

      device!.set({ small: false })
      await flushPromises()

      expect(root(wrapper).classes()).not.toContain('sale-view--narrow')
      expect(isCheckout(wrapper)).toBe(false)
      expect(wrapper.find('button[data-action="close-checkout"]').exists()).toBe(false)
      expect(wrapper.find('.sale-picker').exists()).toBe(true)
      expect(lines(wrapper)).toHaveLength(1)
      expect(wrapper.get('.sale-cart').classes()).not.toContain('sale-cart--checkout')
    })

    it('al volver a vertical regresa a un paso sensato: el Paso 2 si hay venta, con todo intacto', async () => {
      const { wrapper } = await mountNarrow()
      await tap(wrapper, 'Pan dulce')
      await openCheckout(wrapper).trigger('click')
      await flushPromises()

      device!.set({ small: false }); await flushPromises()
      device!.set({ small: true }); await flushPromises()

      expect(isCheckout(wrapper)).toBe(true)
      expect(lines(wrapper)).toHaveLength(1)
      expect(wrapper.get('.cart-summary__total').text()).toBe('$8.50')
    })

    it('en el Paso 1: al pasar a ancho desaparece la barra y al volver a angosto reaparece', async () => {
      const { wrapper } = await mountNarrow()
      await tap(wrapper, 'Pan dulce')
      expect(bar(wrapper).exists()).toBe(true)

      device!.set({ small: false }); await flushPromises()
      expect(bar(wrapper).exists()).toBe(false)

      device!.set({ small: true }); await flushPromises()
      expect(bar(wrapper).exists()).toBe(true)
      expect(bar(wrapper).text()).toContain('$8.50')
    })

    it('girar con el carrito vacío nunca deja en el Paso 2', async () => {
      const { wrapper } = await mountNarrow('/app/venta?paso=cobro')
      device!.set({ small: false }); await flushPromises()
      device!.set({ small: true }); await flushPromises()
      expect(isCheckout(wrapper)).toBe(false)
    })
  })

  describe('accesibilidad', () => {
    it('la barra es una región con nombre y los dos botones de paso tienen texto visible', async () => {
      const { wrapper } = await mountNarrow()
      await tap(wrapper, 'Pan dulce')
      expect(bar(wrapper).attributes('aria-label')).toBeTruthy()
      expect(openCheckout(wrapper).text().length).toBeGreaterThan(0)
      await openCheckout(wrapper).trigger('click')
      await flushPromises()
      expect(closeCheckout(wrapper).text().length).toBeGreaterThan(0)
      expect(wrapper.get('section.sale-cart').attributes('aria-label')).toBe('Tu venta')
    })
  })
})
