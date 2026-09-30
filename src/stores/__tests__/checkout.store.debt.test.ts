// registerDebt: fiado/apartado desde el cobro (D3: solo con una línea en el
// carrito). D1 (BE-15): el abono inicial es un campo EXPLÍCITO del input —
// va DENTRO de POST /deudas (transacción atómica del servidor), nunca una
// llamada aparte a createAbono ni algo inferido de cart.cashReceivedMinor.
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
    unitCostMinor: null,
    saldadaAt: null,
    createdByMemberId: MEMBER.id,
    createdAt: '2026-09-25T12:00:00.000Z',
    abonos: [],
    cuotasPlaneadas: [],
    ...overrides,
  }
}

const httpError = (status: number, message: string | string[] = 'x') => ({
  isAxiosError: true, response: { status, data: { message } },
})

const createDeuda = vi.mocked(DeudasService.createDeuda)
const createAbono = vi.mocked(DeudasService.createAbono)

const DEUDOR_INPUT = { type: 'apartado' as const, deudor: { nombre: 'Lucía', telefono: '555-0001' }, abonoInicialMinor: 0, cuotasPlaneadas: [] }

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

describe('checkout.store.registerDebt — POST /deudas (D1: abonoInicialMinor explícito, nunca del carrito)', () => {
  it('manda type, productId, cantidad, deudor y abonoInicialMinor tal cual el input — NUNCA lee cart.cashReceivedMinor', async () => {
    const { cart, checkout } = await ready()
    cart.setCashFromDisplay('999') // efectivo ya escrito en el carrito: debe ser IGNORADO por completo

    await checkout.registerDebt({ ...DEUDOR_INPUT, abonoInicialMinor: 1500 })

    expect(createDeuda).toHaveBeenCalledExactlyOnceWith({
      type: 'apartado',
      productId: TAZA.id,
      cantidad: 3,
      deudor: { nombre: 'Lucía', telefono: '555-0001' },
      abonoInicialMinor: 1500,
    })
  })

  it('sin cuotasPlaneadas (arreglo vacío) NO manda ese campo al backend (opcional)', async () => {
    const { checkout } = await ready()

    await checkout.registerDebt(DEUDOR_INPUT)

    const sentPayload = createDeuda.mock.calls[0][0]
    expect(sentPayload).not.toHaveProperty('cuotasPlaneadas')
  })

  it('con cuotasPlaneadas, las manda tal cual dentro del mismo POST /deudas', async () => {
    const { checkout } = await ready()
    const cuotas = [{ fechaEsperada: '2026-10-15T00:00:00.000Z', montoEsperadoMinor: 2000 }]

    await checkout.registerDebt({ ...DEUDOR_INPUT, cuotasPlaneadas: cuotas })

    expect(createDeuda).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ cuotasPlaneadas: cuotas }))
  })

  it('el abonoInicialMinor 0 explícito no llama a createAbono por separado: nunca hay una segunda llamada', async () => {
    const { checkout } = await ready()

    await checkout.registerDebt(DEUDOR_INPUT)

    expect(createAbono).not.toHaveBeenCalled()
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

  it('400 (p.ej. stock insuficiente): rejected con mensaje amable, carrito intacto', async () => {
    const { cart, checkout } = await ready()
    createDeuda.mockRejectedValue(httpError(400, `Insufficient stock for product ${TAZA.id}`))

    const result = await checkout.registerDebt(DEUDOR_INPUT)

    expect(result).toEqual({ kind: 'rejected', reasonMessage: VOICE.deuda.insufficientStock, canFix: true })
    expect(cart.lines).toHaveLength(1)
  })

  it('un fallo de red también es rejected con mensaje amable', async () => {
    const { checkout } = await ready()
    createDeuda.mockRejectedValue({ isAxiosError: true, code: 'ERR_NETWORK' })

    const result = await checkout.registerDebt(DEUDOR_INPUT)

    expect(result).toEqual({ kind: 'rejected', reasonMessage: VOICE.networkError, canFix: true })
  })
})

describe('checkout.store.registerDebt — resultado con el abono inicial ya incluido (BE-15, transacción atómica)', () => {
  it('sin abono inicial, el resultado trae el saldo completo pendiente', async () => {
    const { checkout } = await ready()

    const result = await checkout.registerDebt(DEUDOR_INPUT)

    expect(result).toEqual({
      kind: 'debt-registered',
      deudaId: deudaFor().id,
      debtType: 'apartado',
      totalMinor: 5997,
      pendingMinor: 5997,
      initialAbonoMinor: 0,
    })
    expect(checkout.lastResult).toEqual(result)
  })

  it('con abono inicial, el servidor ya devuelve la deuda con el abono incluido en abonos[] — el resultado lo refleja', async () => {
    const { checkout } = await ready()
    createDeuda.mockImplementation(async (payload) => deudaFor({
      abonos: payload.abonoInicialMinor > 0
        ? [{ id: 'a-1', deudaId: deudaFor().id, contextId: 'bazar-local', montoMinor: payload.abonoInicialMinor, receivedByMemberId: MEMBER.id, receivedAt: '2026-09-25T12:00:01.000Z', nota: null }]
        : [],
    }))

    const result = await checkout.registerDebt({ ...DEUDOR_INPUT, abonoInicialMinor: 2000 })

    expect(result).toEqual({
      kind: 'debt-registered',
      deudaId: deudaFor().id,
      debtType: 'apartado',
      totalMinor: 5997,
      pendingMinor: 3997,
      initialAbonoMinor: 2000,
    })
  })

  it('BE-15: si el abono inicial por sí solo excede el total, la creación entera falla (rejected) — nunca "debt-registered" con abono fallido', async () => {
    const { checkout } = await ready()
    createDeuda.mockRejectedValue(httpError(400, 'Abono of 20000 exceeds the remaining balance of 5997'))

    const result = await checkout.registerDebt({ ...DEUDOR_INPUT, abonoInicialMinor: 20000 })

    expect(result).toEqual({ kind: 'rejected', reasonMessage: VOICE.deuda.abonoInicialExceedsBalance, canFix: true })
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
