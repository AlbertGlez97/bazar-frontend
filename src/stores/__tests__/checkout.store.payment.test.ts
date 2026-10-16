const TEST_IDENTITY = 'a.' + btoa(JSON.stringify({ sub: 'account-a' })) + '.z'
// Método de pago en el cobro: el método viaja en la venta, queda en la cola
// offline y en el fiado/apartado (abono inicial). Stores y cola REALES sobre
// fake-indexeddb; solo se simula la red.
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCheckoutStore } from '../checkout.store'
import { useCartStore } from '../cart.store'
import { useSaleCatalogStore } from '../sale-catalog.store'
import { useSessionStore } from '../session.store'
import { closeLocalDb } from '@/services/local-db'
import * as salesQueue from '@/services/sales-queue'
import SalesService from '@/services/sales.service'
import DeudasService from '@/services/deudas.service'
import ProductsService from '@/services/products.service'
import type { Product } from '@/types/product.types'
import type { Deuda } from '@/types/deuda.types'
import type { CreateSalePayload, CreateSaleResult, Sale } from '@/types/sale.types'

vi.mock('@/services/sales.service', () => ({ default: { createSale: vi.fn() } }))
vi.mock('@/services/deudas.service', () => ({ default: { createDeuda: vi.fn(), createAbono: vi.fn() } }))
vi.mock('@/services/products.service', () => ({ default: { listProducts: vi.fn() } }))

const realIndexedDb = globalThis.indexedDB
const MEMBER = { id: '10000000-0000-4000-8000-000000000003', name: 'Carlos', role: 'socio' as const, active: true }
const DEVICE = { deviceId: '20000000-0000-4000-8000-000000000001', name: 'Tablet' }
const TAZA: Product = {
  id: '30000000-0000-4000-8000-000000000001', name: 'Taza de barro', tipo: 'cantidad', unitPriceMinor: 110000,
  initialStock: 10, stock: 10, category: 'Cocina', purchaseCostMinor: null, supplier: null, notes: null,
  createdAt: '2026-09-01T00:00:00.000Z', active: true, image: null,
}

function saleFor(payload: CreateSalePayload, totalMinor = 110000): Sale {
  const cash = payload.cashReceivedMinor ?? null
  return {
    id: payload.id, memberId: payload.memberId, deviceId: payload.deviceId, occurredAt: payload.occurredAt,
    receivedAt: '2026-09-25T12:00:01.000Z', currency: 'MXN', status: 'completada', totalMinor,
    paymentMethod: payload.paymentMethod ?? 'EFECTIVO', cashReceivedMinor: cash,
    changeMinor: cash === null ? null : cash - totalMinor, conflictReason: null, conflictDetectedAt: null, items: [],
  }
}
const completed = (p: CreateSalePayload): CreateSaleResult => ({ outcome: 'completed', httpStatus: 201, replayed: false, sale: saleFor(p) })
const networkError = () => ({ isAxiosError: true, code: 'ERR_NETWORK', message: 'Network Error' })

const createSale = vi.mocked(SalesService.createSale)
const createDeuda = vi.mocked(DeudasService.createDeuda)

function deudaFor(overrides: Partial<Deuda> = {}): Deuda {
  return {
    id: '70000000-0000-4000-8000-000000000001', type: 'fiado', deudorId: '60000000-0000-4000-8000-000000000001',
    productId: TAZA.id, contextId: 'bazar-local', cantidad: 1, totalMinor: 110000, status: 'pendiente',
    unitCostMinor: null, saldadaAt: null, createdByMemberId: MEMBER.id, createdAt: '2026-09-25T12:00:00.000Z',
    abonos: [], cuotasPlaneadas: [], ...overrides,
  }
}

/** Sesión lista + catálogo cargado + carrito con 1 taza ($1,100.00). */
async function ready() {
  const session = useSessionStore()
  session.setDevice(DEVICE)
  session.setMember(MEMBER)
  vi.mocked(ProductsService.listProducts).mockResolvedValue({ items: [TAZA], total: 1, page: 1, limit: 100 })
  const catalog = useSaleCatalogStore()
  await catalog.load()
  const cart = useCartStore()
  cart.add(catalog.getById(TAZA.id)!)
  return { cart, checkout: useCheckoutStore() }
}

const setOnline = (online: boolean) => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online)

beforeEach(() => {
  closeLocalDb()
  globalThis.indexedDB = new IDBFactory()
  localStorage.setItem('access_token', TEST_IDENTITY)
  localStorage.setItem('token_expires_at', String(Date.now() + 60000))
  localStorage.setItem('device_context_owner', JSON.stringify({ accountId: 'account-a', apiBase: '/api/v1' }))
  sessionStorage.setItem('member_context_owner', JSON.stringify({ accountId: 'account-a', apiBase: '/api/v1' }))
  setActivePinia(createPinia())
  createSale.mockReset()
  createSale.mockImplementation(async (payload) => completed(payload))
  createDeuda.mockReset()
  createDeuda.mockImplementation(async (payload) => deudaFor({ id: payload.id! }))
  setOnline(true)
})
afterEach(() => {
  vi.restoreAllMocks()
  closeLocalDb()
  globalThis.indexedDB = realIndexedDb
})

describe('checkout.store — cobro por método', () => {
  it('EFECTIVO (por defecto): manda el método, el efectivo y el cambio sale del efectivo', async () => {
    const { cart, checkout } = await ready()
    cart.setAmountFromDisplay('1,500')

    const result = await checkout.charge()

    expect(createSale.mock.calls[0]![0]).toMatchObject({ paymentMethod: 'EFECTIVO', cashReceivedMinor: 150000 })
    expect(result).toMatchObject({ kind: 'success', paymentMethod: 'EFECTIVO', totalMinor: 110000, changeMinor: 40000 })
  })

  it.each(['TRANSFERENCIA', 'TARJETA'] as const)('%s: manda el método SIN efectivo y no hay cambio', async (method) => {
    const { cart, checkout } = await ready()
    cart.setPaymentMethod(method)

    const result = await checkout.charge()

    const payload = createSale.mock.calls[0]![0]
    expect(payload.paymentMethod).toBe(method)
    expect(payload).not.toHaveProperty('cashReceivedMinor')
    expect(result).toMatchObject({ kind: 'success', paymentMethod: method, totalMinor: 110000, changeMinor: 0 })
  })

  it('transferencia o tarjeta con un monto menor al total no se cobra (es un fiado, no una venta)', async () => {
    const { cart, checkout } = await ready()
    cart.setPaymentMethod('TARJETA')
    cart.setAmountFromDisplay('300')

    const result = await checkout.charge()

    expect(result).toEqual({ kind: 'blocked', reason: 'cash-insufficient' })
    expect(createSale).not.toHaveBeenCalled()
  })

  it('un reintento con el mismo método conserva el id; cambiar de método genera uno nuevo', async () => {
    const { cart, checkout } = await ready()
    cart.setPaymentMethod('TARJETA')
    createSale.mockRejectedValueOnce(networkError())
    await checkout.charge()
    setOnline(true)
    await checkout.charge()
    const sameId = createSale.mock.calls.map(([payload]) => payload.id)
    expect(new Set(sameId).size).toBe(1)

    cart.setPaymentMethod('TRANSFERENCIA')
    await checkout.charge()

    expect(createSale.mock.calls.at(-1)![0].id).not.toBe(sameId[0])
  })
})

describe('checkout.store — efectivo tecleado y luego otro método', () => {
  it.each(['TRANSFERENCIA', 'TARJETA'] as const)('en línea: tecleó efectivo y cambió a %s -> el payload no lleva efectivo ni cambio', async (method) => {
    const { cart, checkout } = await ready()
    cart.setAmountFromDisplay('1,500')
    cart.setPaymentMethod(method)

    await checkout.charge()

    const payload = createSale.mock.calls[0]![0]
    expect(payload.paymentMethod).toBe(method)
    expect(payload).not.toHaveProperty('cashReceivedMinor')
    expect(payload).not.toHaveProperty('changeMinor')
  })

  it.each(['TRANSFERENCIA', 'TARJETA'] as const)('sin conexión: tecleó efectivo y cambió a %s -> la cola no guarda efectivo ni cambio', async (method) => {
    const { cart, checkout } = await ready()
    cart.setAmountFromDisplay('1,500')
    cart.setPaymentMethod(method)
    setOnline(false)

    const result = await checkout.charge()

    expect(result).toMatchObject({ kind: 'saved-offline', paymentMethod: method, changeMinor: 0 })
    const [queued] = await salesQueue.list()
    if (queued!.kind === 'debt') throw new Error('expected a sale')
    expect(queued!.payload.paymentMethod).toBe(method)
    expect(queued!.payload).not.toHaveProperty('cashReceivedMinor')
    expect(queued!.payload).not.toHaveProperty('changeMinor')
  })

  it('cambió a tarjeta y volvió a efectivo: el efectivo anterior no reaparece', async () => {
    const { cart, checkout } = await ready()
    cart.setAmountFromDisplay('1,500')
    cart.setPaymentMethod('TARJETA')
    cart.setPaymentMethod('EFECTIVO')

    expect(cart.amountMinor).toBe(0)
    expect(await checkout.charge()).toMatchObject({ kind: 'blocked' })
    expect(createSale).not.toHaveBeenCalled()
  })

  it('el servidor responde sin efectivo ni cambio (null): el resultado dice cambio 0', async () => {
    const { cart, checkout } = await ready()
    cart.setPaymentMethod('TRANSFERENCIA')
    createSale.mockImplementationOnce(async (payload) => {
      const done = await completed(payload)
      return { ...done, sale: { ...done.sale, cashReceivedMinor: null, changeMinor: null } }
    })

    const result = await checkout.charge()

    expect(result).toMatchObject({ kind: 'success', paymentMethod: 'TRANSFERENCIA', changeMinor: 0 })
  })
})

describe('checkout.store — sin conexión: el método viaja en la cola', () => {
  it.each(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'] as const)('%s queda guardado en la venta encolada', async (method) => {
    const { cart, checkout } = await ready()
    cart.setPaymentMethod(method)
    if (method === 'EFECTIVO') cart.setAmountFromDisplay('1100')
    setOnline(false)

    const result = await checkout.charge()

    expect(result).toMatchObject({ kind: 'saved-offline', paymentMethod: method })
    const [queued] = await salesQueue.list()
    expect(queued!.kind).not.toBe('debt')
    if (queued!.kind === 'debt') throw new Error('expected a sale')
    expect(queued!.payload.paymentMethod).toBe(method)
    expect(queued!.payload.cashReceivedMinor).toBe(method === 'EFECTIVO' ? 110000 : undefined)
    expect(createSale).not.toHaveBeenCalled()
  })

  it('una venta con red caída se encola con su método y se envía igual al sincronizar', async () => {
    const { cart, checkout } = await ready()
    cart.setPaymentMethod('TRANSFERENCIA')
    createSale.mockRejectedValueOnce(networkError())

    const result = await checkout.charge()

    expect(result).toMatchObject({ kind: 'saved-offline', paymentMethod: 'TRANSFERENCIA', changeMinor: 0 })
    const [queued] = await salesQueue.list()
    expect(queued!.kind === 'debt' ? null : queued!.payload.paymentMethod).toBe('TRANSFERENCIA')
  })
})

describe('checkout.store — fiado/apartado con el método elegido', () => {
  const input = (overrides: Record<string, unknown> = {}) => ({
    type: 'fiado' as const, deudor: { nombre: 'Lucía' }, abonoInicialMinor: 30000, cuotasPlaneadas: [], ...overrides,
  })

  it.each(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'] as const)('el abono inicial va con %s', async (abonoInicialPaymentMethod) => {
    const { checkout } = await ready()

    await checkout.registerDebt(input({ abonoInicialPaymentMethod }))

    expect(createDeuda.mock.calls[0]![0]).toMatchObject({ abonoInicialMinor: 30000, abonoInicialPaymentMethod })
  })

  it('sin método en la entrada, el abono inicial es EFECTIVO', async () => {
    const { checkout } = await ready()

    await checkout.registerDebt(input())

    expect(createDeuda.mock.calls[0]![0].abonoInicialPaymentMethod).toBe('EFECTIVO')
  })

  it('con $0 de abono también viaja el método (el servidor lo ignora)', async () => {
    const { checkout } = await ready()

    await checkout.registerDebt(input({ abonoInicialMinor: 0, abonoInicialPaymentMethod: 'TARJETA' }))

    expect(createDeuda.mock.calls[0]![0]).toMatchObject({ abonoInicialMinor: 0, abonoInicialPaymentMethod: 'TARJETA' })
  })

  it('el resultado dice con qué método se abonó', async () => {
    const { checkout } = await ready()
    createDeuda.mockImplementation(async (payload) =>
      deudaFor({ id: payload.id!, abonos: [{ id: 'a1', deudaId: payload.id!, contextId: 'x', montoMinor: 30000, paymentMethod: 'TARJETA', receivedByMemberId: MEMBER.id, receivedAt: '2026-09-25T12:00:00.000Z', nota: null }] }))

    const result = await checkout.registerDebt(input({ abonoInicialPaymentMethod: 'TARJETA' }))

    expect(result).toMatchObject({ kind: 'debt-registered', initialAbonoMinor: 30000, paymentMethod: 'TARJETA' })
  })

  it('sin conexión el método queda en la cola de deudas y el resultado lo conserva', async () => {
    const { checkout } = await ready()
    setOnline(false)

    const result = await checkout.registerDebt(input({ abonoInicialPaymentMethod: 'TRANSFERENCIA' }))

    expect(result).toMatchObject({ kind: 'debt-saved-offline', initialAbonoMinor: 30000, paymentMethod: 'TRANSFERENCIA' })
    const [queued] = await salesQueue.list()
    expect(queued!.kind === 'debt' ? queued!.payload.abonoInicialPaymentMethod : null).toBe('TRANSFERENCIA')
  })

  it('cambiar el método de un fiado ya intentado genera otra deuda (otro id), no un reenvío', async () => {
    const { checkout } = await ready()
    await checkout.registerDebt(input({ abonoInicialPaymentMethod: 'TARJETA' }))

    await checkout.registerDebt(input({ abonoInicialPaymentMethod: 'TRANSFERENCIA' }))

    const ids = createDeuda.mock.calls.map(([payload]) => payload.id)
    expect(ids[0]).not.toBe(ids[1])
  })
})
