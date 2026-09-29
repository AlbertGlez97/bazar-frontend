// registerDebt: fiado/apartado desde el cobro (D3: solo con una línea en el
// carrito) y el abono inicial del efectivo ya ingresado (D4, segunda
// llamada). Usa los stores REALES (carrito, catálogo); solo se simula la red
// (DeudasService, ProductsService).
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCheckoutStore } from '../checkout.store'
import { useCartStore } from '../cart.store'
import { useSaleCatalogStore } from '../sale-catalog.store'
import { useSessionStore } from '../session.store'
import { closeLocalDb } from '@/services/local-db'
import DeudasService from '@/services/deudas.service'
import ProductsService from '@/services/products.service'
import { VOICE } from '@/config/voice'
import type { Product } from '@/types/product.types'
import type { Deuda } from '@/types/deuda.types'

vi.mock('@/services/deudas.service', () => ({ default: { createDeuda: vi.fn(), createAbono: vi.fn() } }))
vi.mock('@/services/products.service', () => ({ default: { listProducts: vi.fn() } }))

const realIndexedDb = globalThis.indexedDB

const MEMBER = { id: '10000000-0000-4000-8000-000000000003', name: 'Carlos', role: 'socio' as const, active: true }
const DEVICE = { deviceId: '20000000-0000-4000-8000-000000000001', name: 'Tablet' }

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: '30000000-0000-4000-8000-000000000001', name: 'Taza de barro', tipo: 'cantidad', unitPriceMinor: 1999,
    initialStock: 10, stock: 10, category: 'Cocina', purchaseCostMinor: null, supplier: null, notes: null,
    createdAt: '2026-09-01T00:00:00.000Z', active: true, image: null, ...overrides,
  }
}
const TAZA = product()
const SARAPE = product({ id: '30000000-0000-4000-8000-000000000002', name: 'Sarape', tipo: 'unica', stock: 1, unitPriceMinor: 85000 })

function deudaFor(overrides: Partial<Deuda> = {}): Deuda {
  return {
    id: '70000000-0000-4000-8000-000000000001',
    type: 'apartado',
    deudorId: '60000000-0000-4000-8000-000000000001',
    productId: TAZA.id,
    contextId: 'bazar-local',
    cantidad: 3,
    totalMinor: 5997,
    status: 'pendiente',
    createdByMemberId: MEMBER.id,
    createdAt: '2026-09-25T12:00:00.000Z',
    abonos: [],
    ...overrides,
  }
}

const httpError = (status: number, message: string | string[] = 'x') => ({
  isAxiosError: true, response: { status, data: { message } },
})

const createDeuda = vi.mocked(DeudasService.createDeuda)
const createAbono = vi.mocked(DeudasService.createAbono)

const DEUDOR_INPUT = { type: 'apartado' as const, deudor: { nombre: 'Lucía', telefono: '555-0001' } }

/** Sesión lista + catálogo cargado + carrito con 3 tazas. */
async function ready() {
  const session = useSessionStore()
  session.setDevice(DEVICE)
  session.setMember(MEMBER)

  vi.mocked(ProductsService.listProducts).mockResolvedValue({ items: [TAZA, SARAPE], total: 2, page: 1, limit: 100 })
  const catalog = useSaleCatalogStore()
  await catalog.load()

  const cart = useCartStore()
  cart.add(catalog.getById(TAZA.id)!)
  cart.setQuantity(TAZA.id, 3)

  return { session, catalog, cart, checkout: useCheckoutStore() }
}

beforeEach(() => {
  closeLocalDb()
  globalThis.indexedDB = new IDBFactory()
  setActivePinia(createPinia())
  createDeuda.mockReset()
  createDeuda.mockImplementation(async () => deudaFor())
  createAbono.mockReset()
})
afterEach(() => {
  vi.restoreAllMocks()
  closeLocalDb()
  globalThis.indexedDB = realIndexedDb
})

describe('checkout.store.registerDebt — solo con una línea (D3)', () => {
  it('con 2 líneas no llama al servidor y devuelve blocked debt-invalid-cart', async () => {
    const { catalog, cart, checkout } = await ready()
    cart.add(catalog.getById(SARAPE.id)!)

    const result = await checkout.registerDebt(DEUDOR_INPUT)

    expect(result).toEqual({ kind: 'blocked', reason: 'debt-invalid-cart' })
    expect(createDeuda).not.toHaveBeenCalled()
  })

  it('con el carrito vacío no llama al servidor y devuelve blocked debt-invalid-cart', async () => {
    const session = useSessionStore()
    session.setDevice(DEVICE)
    session.setMember(MEMBER)
    const checkout = useCheckoutStore()

    const result = await checkout.registerDebt(DEUDOR_INPUT)

    expect(result).toEqual({ kind: 'blocked', reason: 'debt-invalid-cart' })
    expect(createDeuda).not.toHaveBeenCalled()
  })
})

describe('checkout.store.registerDebt — POST /deudas', () => {
  it('manda type, productId y cantidad de la única línea, y el deudor tal cual', async () => {
    const { checkout } = await ready()

    await checkout.registerDebt(DEUDOR_INPUT)

    expect(createDeuda).toHaveBeenCalledExactlyOnceWith({
      type: 'apartado',
      productId: TAZA.id,
      cantidad: 3,
      deudor: { nombre: 'Lucía', telefono: '555-0001' },
    })
  })

  it('sin efectivo ingresado no llama a createAbono; el resultado trae el saldo completo pendiente', async () => {
    const { checkout } = await ready()

    const result = await checkout.registerDebt(DEUDOR_INPUT)

    expect(createAbono).not.toHaveBeenCalled()
    expect(result).toEqual({
      kind: 'debt-registered',
      deudaId: deudaFor().id,
      debtType: 'apartado',
      totalMinor: 5997,
      pendingMinor: 5997,
      initialAbonoMinor: 0,
      abonoFailed: false,
    })
    expect(checkout.lastResult).toEqual(result)
  })

  it('descuenta el stock local igual que una venta (la Deuda ya lo descontó en el servidor)', async () => {
    const { catalog, checkout } = await ready()

    await checkout.registerDebt(DEUDOR_INPUT)

    expect(catalog.getById(TAZA.id)?.stock).toBe(7)
  })

  it('el carrito NO se vacía aquí: la UI limpia con "Nueva venta" (mismo criterio que success)', async () => {
    const { cart, checkout } = await ready()

    await checkout.registerDebt(DEUDOR_INPUT)

    expect(cart.lines).toHaveLength(1)
  })

  it('400 (p.ej. stock insuficiente): rejected con mensaje amable, sin llamar a createAbono, carrito intacto', async () => {
    const { cart, checkout } = await ready()
    createDeuda.mockRejectedValue(httpError(400, `Insufficient stock for product ${TAZA.id}`))

    const result = await checkout.registerDebt(DEUDOR_INPUT)

    expect(result).toEqual({ kind: 'rejected', reasonMessage: VOICE.deuda.insufficientStock, canFix: true })
    expect(createAbono).not.toHaveBeenCalled()
    expect(cart.lines).toHaveLength(1)
  })

  it('un fallo de red también es rejected con mensaje amable', async () => {
    const { checkout } = await ready()
    createDeuda.mockRejectedValue({ isAxiosError: true, code: 'ERR_NETWORK' })

    const result = await checkout.registerDebt(DEUDOR_INPUT)

    expect(result).toEqual({ kind: 'rejected', reasonMessage: VOICE.networkError, canFix: true })
  })
})

describe('checkout.store.registerDebt — abono inicial del efectivo ya ingresado (D4)', () => {
  it('con efectivo ingresado, llama a createAbono con ese monto tras crear la deuda', async () => {
    const { cart, checkout } = await ready()
    cart.setCashFromDisplay('20')

    await checkout.registerDebt(DEUDOR_INPUT)

    expect(createAbono).toHaveBeenCalledExactlyOnceWith(deudaFor().id, { montoMinor: 2000 })
  })

  it('el abono exitoso descuenta del saldo pendiente y lo refleja en el resultado', async () => {
    const { cart, checkout } = await ready()
    cart.setCashFromDisplay('20')
    createAbono.mockImplementation(async (id, payload) => deudaFor({
      id,
      abonos: [{ id: 'a-1', deudaId: id, contextId: 'bazar-local', montoMinor: payload.montoMinor, receivedByMemberId: MEMBER.id, receivedAt: '2026-09-25T12:00:01.000Z', nota: null }],
    }))

    const result = await checkout.registerDebt(DEUDOR_INPUT)

    expect(result).toEqual({
      kind: 'debt-registered',
      deudaId: deudaFor().id,
      debtType: 'apartado',
      totalMinor: 5997,
      pendingMinor: 3997,
      initialAbonoMinor: 2000,
      abonoFailed: false,
    })
  })

  it('D4: si el abono falla, la Deuda YA existe (abonos: []) — el resultado lo muestra honesto, NUNCA como éxito completo', async () => {
    const { cart, checkout } = await ready()
    cart.setCashFromDisplay('20')
    createAbono.mockRejectedValue(httpError(400, 'Abono of 2000 exceeds the remaining balance of 0'))

    const result = await checkout.registerDebt(DEUDOR_INPUT)

    expect(result).toEqual({
      kind: 'debt-registered',
      deudaId: deudaFor().id,
      debtType: 'apartado',
      totalMinor: 5997,
      pendingMinor: 5997, // sigue con abonos: [] en el servidor
      initialAbonoMinor: 0,
      abonoFailed: true,
    })
  })

  it('D4: el fallo del abono NO es un fallo de la deuda (nunca kind rejected)', async () => {
    const { cart, checkout } = await ready()
    cart.setCashFromDisplay('20')
    createAbono.mockRejectedValue({ isAxiosError: true, code: 'ERR_NETWORK' })

    const result = await checkout.registerDebt(DEUDOR_INPUT)

    expect(result.kind).toBe('debt-registered')
  })
})

describe('checkout.store.registerDebt — doble toque', () => {
  it('dos registerDebt seguidos llaman createDeuda UNA sola vez y comparten resultado', async () => {
    const { checkout } = await ready()
    let release: () => void = () => undefined
    createDeuda.mockImplementation(() => new Promise((resolve) => { release = () => resolve(deudaFor()) }))

    const first = checkout.registerDebt(DEUDOR_INPUT)
    expect(checkout.registeringDebt).toBe(true)
    const second = checkout.registerDebt(DEUDOR_INPUT)
    await vi.waitFor(() => expect(createDeuda).toHaveBeenCalledTimes(1))
    release()
    const [a, b] = await Promise.all([first, second])

    expect(createDeuda).toHaveBeenCalledTimes(1)
    expect(a).toEqual(b)
    expect(checkout.registeringDebt).toBe(false)
  })

  it('registeringDebt vuelve a false aunque falle', async () => {
    const { checkout } = await ready()
    createDeuda.mockRejectedValue(httpError(400))

    await checkout.registerDebt(DEUDOR_INPUT)

    expect(checkout.registeringDebt).toBe(false)
  })

  it('un registerDebt no interfiere con el loading de charge() ni viceversa', async () => {
    const { checkout } = await ready()

    await checkout.registerDebt(DEUDOR_INPUT)

    expect(checkout.loading).toBe(false)
  })
})
