// Orquestación del cobro: carrito + sesión -> resultado que la UI pinta.
// Usa los stores REALES (cart, session, catálogo) y la cola REAL sobre
// fake-indexeddb; solo se simulan la red (SalesService, ProductsService).
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
import ProductsService from '@/services/products.service'
import { VOICE, saleConflictMessage } from '@/config/voice'
import type { Product } from '@/types/product.types'
import type { CreateSalePayload, CreateSaleResult, Sale } from '@/types/sale.types'

vi.mock('@/services/sales.service', () => ({ default: { createSale: vi.fn() } }))
vi.mock('@/services/products.service', () => ({ default: { listProducts: vi.fn() } }))

const realIndexedDb = globalThis.indexedDB

const MEMBER = { id: '10000000-0000-4000-8000-000000000003', name: 'Carlos', role: 'socio' as const, active: true }
const DEVICE = { deviceId: '20000000-0000-4000-8000-000000000001', identifier: 'tablet', name: 'Tablet' }

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: '30000000-0000-4000-8000-000000000001', name: 'Taza de barro', tipo: 'cantidad', unitPriceMinor: 1999,
    initialStock: 10, stock: 10, category: 'Cocina', purchaseCostMinor: null, supplier: null, notes: null,
    createdAt: '2026-09-01T00:00:00.000Z', active: true, image: null, ...overrides,
  }
}
const TAZA = product()
const SARAPE = product({ id: '30000000-0000-4000-8000-000000000002', name: 'Sarape', tipo: 'unica', stock: 1, unitPriceMinor: 85000 })

function saleFor(payload: CreateSalePayload, status: Sale['status'] = 'completada', totalMinor = 5997): Sale {
  const rejected = status === 'rechazada_por_conflicto'
  return {
    id: payload.id, memberId: payload.memberId, deviceId: payload.deviceId, occurredAt: payload.occurredAt,
    receivedAt: '2026-09-25T12:00:01.000Z', currency: 'MXN', status,
    totalMinor: rejected ? null : totalMinor, cashReceivedMinor: payload.cashReceivedMinor,
    changeMinor: rejected ? null : payload.cashReceivedMinor - totalMinor,
    conflictReason: rejected ? 'stock insuficiente al sincronizar' : null,
    conflictDetectedAt: rejected ? '2026-09-25T12:00:01.000Z' : null, items: [],
  }
}
const completed = (p: CreateSalePayload, httpStatus = 201, totalMinor?: number): CreateSaleResult => ({
  outcome: 'completed', httpStatus, replayed: httpStatus === 200, sale: saleFor(p, 'completada', totalMinor),
})
const conflict = (p: CreateSalePayload): CreateSaleResult => ({
  outcome: 'conflict', httpStatus: 201, replayed: false, sale: saleFor(p, 'rechazada_por_conflicto'),
})
const httpError = (status: number, message: string | string[] = 'x') => ({
  isAxiosError: true, response: { status, data: { message } },
})
const networkError = () => ({ isAxiosError: true, code: 'ERR_NETWORK', message: 'Network Error' })
const timeoutError = () => ({ isAxiosError: true, code: 'ECONNABORTED', message: 'timeout of 10000ms exceeded' })

const createSale = vi.mocked(SalesService.createSale)

/** Sesión lista + catálogo cargado + carrito con 3 tazas y efectivo suficiente. */
async function readySale() {
  const session = useSessionStore()
  session.setDevice(DEVICE)
  session.setMember(MEMBER)

  vi.mocked(ProductsService.listProducts).mockResolvedValue({ items: [TAZA, SARAPE], total: 2, page: 1, limit: 100 })
  const catalog = useSaleCatalogStore()
  await catalog.load()

  const cart = useCartStore()
  cart.add(catalog.getById(TAZA.id)!)
  cart.setQuantity(TAZA.id, 3)
  cart.setCashFromDisplay('100')

  return { session, catalog, cart, checkout: useCheckoutStore() }
}

function setOnline(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online)
}

beforeEach(() => {
  closeLocalDb()
  globalThis.indexedDB = new IDBFactory()
  setActivePinia(createPinia())
  createSale.mockReset()
  createSale.mockImplementation(async (payload) => completed(payload))
  setOnline(true)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  closeLocalDb()
  globalThis.indexedDB = realIndexedDb
})

describe('checkout.store — cobro bloqueado', () => {
  it('con el carrito vacío no cobra ni llama al servidor', async () => {
    const session = useSessionStore()
    session.setDevice(DEVICE)
    session.setMember(MEMBER)
    const checkout = useCheckoutStore()

    expect(await checkout.charge()).toEqual({ kind: 'blocked', reason: 'empty-cart' })
    expect(createSale).not.toHaveBeenCalled()
  })

  it('con efectivo insuficiente no cobra', async () => {
    const { cart, checkout } = await readySale()
    cart.setCashFromDisplay('10')

    expect(await checkout.charge()).toEqual({ kind: 'blocked', reason: 'cash-insufficient' })
    expect(createSale).not.toHaveBeenCalled()
    expect(await salesQueue.list()).toEqual([])
  })

  it('sin persona o dispositivo en la sesión no cobra', async () => {
    const { session, checkout } = await readySale()
    session.clearMember()

    expect(await checkout.charge()).toEqual({ kind: 'blocked', reason: 'missing-context' })
    expect(createSale).not.toHaveBeenCalled()
  })
})

describe('checkout.store — cobro en línea', () => {
  it('pide que un 401 no redirija al login: la venta se guarda y la pantalla lo explica', async () => {
    const { checkout } = await readySale()

    await checkout.charge()

    expect(createSale).toHaveBeenCalledTimes(1)
    expect(createSale.mock.calls[0][1]).toEqual({ handleAuthLocally: true })
  })

  it('201 completada: success con los valores del SERVIDOR y stock local descontado', async () => {
    const { catalog, cart, checkout } = await readySale()
    createSale.mockImplementation(async (payload) => completed(payload, 201, 6000)) // el servidor cobró distinto

    const result = await checkout.charge()

    expect(result.kind).toBe('success')
    if (result.kind !== 'success') return
    expect(result.totalMinor).toBe(6000)
    expect(result.changeMinor).toBe(4000)
    expect(result.sale.status).toBe('completada')
    expect(catalog.getById(TAZA.id)?.stock).toBe(7)
    expect(await salesQueue.list()).toEqual([])
    // La UI decide cuándo limpiar el carrito
    expect(cart.lines).toHaveLength(1)
    expect(checkout.lastResult).toEqual(result)
  })

  it('manda el cuerpo del contrato: id v7, sesión, occurredAt fijo, moneda, efectivo y partidas', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-25T12:00:00.000Z'))
    const { checkout } = await readySale()

    await checkout.charge()

    expect(createSale).toHaveBeenCalledTimes(1)
    const payload = createSale.mock.calls[0][0]
    expect(payload.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(payload).toEqual({
      id: payload.id,
      memberId: MEMBER.id,
      deviceId: DEVICE.deviceId,
      occurredAt: '2026-09-25T12:00:00.000Z',
      currency: 'MXN',
      cashReceivedMinor: 10000,
      items: [{ productId: TAZA.id, quantity: 3, unitPriceMinor: 1999 }],
    })
  })

  it('200 idempotente completada también es success', async () => {
    const { checkout } = await readySale()
    createSale.mockImplementation(async (payload) => completed(payload, 200))

    expect((await checkout.charge()).kind).toBe('success')
  })

  it('201 rechazada_por_conflicto: kind conflict (NUNCA success), sin descontar stock local', async () => {
    const { catalog, checkout } = await readySale()
    createSale.mockImplementation(async (payload) => conflict(payload))

    const result = await checkout.charge()

    expect(result.kind).toBe('conflict')
    expect(result.kind).not.toBe('success')
    if (result.kind !== 'conflict') return
    expect(result.reason).toBe(saleConflictMessage())
    expect(result.sale.status).toBe('rechazada_por_conflicto')
    expect(catalog.getById(TAZA.id)?.stock).toBe(10)
    expect(await salesQueue.list()).toEqual([])
  })

  it('200 idempotente de una rechazada sigue siendo conflict', async () => {
    const { checkout } = await readySale()
    createSale.mockImplementation(async (payload) => ({ ...conflict(payload), httpStatus: 200, replayed: true }))

    expect((await checkout.charge()).kind).toBe('conflict')
  })

  it('400 en línea: rejected con mensaje amable, NADA en cola, carrito y stock intactos', async () => {
    const { catalog, cart, checkout } = await readySale()
    createSale.mockRejectedValue(httpError(400, 'Insufficient stock for product 30000000-0000-4000-8000-000000000001'))

    const result = await checkout.charge()

    expect(result).toEqual({ kind: 'rejected', reasonMessage: VOICE.sale.insufficientStock, canFix: true })
    expect(await salesQueue.list()).toEqual([])
    expect(cart.lines).toHaveLength(1)
    expect(catalog.getById(TAZA.id)?.stock).toBe(10)
  })

  it('409 en línea: rejected con el mensaje de datos distintos', async () => {
    const { checkout } = await readySale()
    createSale.mockRejectedValue(httpError(409, 'Sale x already exists with different data'))

    expect(await checkout.charge()).toEqual({ kind: 'rejected', reasonMessage: VOICE.sale.payloadConflict, canFix: true })
    expect(await salesQueue.list()).toEqual([])
  })

  it('401/403 en línea: auth-needed, la venta queda GUARDADA en la cola y el stock local se descuenta', async () => {
    const { catalog, checkout } = await readySale()
    createSale.mockRejectedValue(httpError(401, 'Unauthorized'))

    const result = await checkout.charge()

    expect(result.kind).toBe('auth-needed')
    if (result.kind !== 'auth-needed') return
    expect(result.message).toBe(VOICE.sale.authNeeded)
    const [record] = await salesQueue.list()
    expect(record.id).toBe(result.pendingId)
    expect(record.state).toBe('pending')
    expect(catalog.getById(TAZA.id)?.stock).toBe(7)
  })

  it('un 403 también es auth-needed', async () => {
    const { checkout } = await readySale()
    createSale.mockRejectedValue(httpError(403, 'Sale attribution must match the authenticated selection'))

    expect((await checkout.charge()).kind).toBe('auth-needed')
    expect(await salesQueue.list()).toHaveLength(1)
  })
})

describe('checkout.store — sin conexión o fallo de red', () => {
  it('offline (navigator.onLine=false): va directo a la cola SIN llamar al servicio; se siente como éxito', async () => {
    setOnline(false)
    const { catalog, cart, checkout } = await readySale()

    const result = await checkout.charge()

    expect(createSale).not.toHaveBeenCalled()
    expect(result.kind).toBe('saved-offline')
    if (result.kind !== 'saved-offline') return
    expect(result.totalMinor).toBe(5997)
    expect(result.changeMinor).toBe(4003)
    const [record] = await salesQueue.list()
    expect(record).toMatchObject({
      id: result.pendingId, state: 'pending', sellerName: 'Carlos',
      totalMinorEstimate: 5997, changeMinorEstimate: 4003,
    })
    expect(record.payload).toMatchObject({ memberId: MEMBER.id, deviceId: DEVICE.deviceId, cashReceivedMinor: 10000 })
    expect(catalog.getById(TAZA.id)?.stock).toBe(7)
    expect(cart.lines).toHaveLength(1)
  })

  it.each([
    ['error de red', networkError()],
    ['timeout', timeoutError()],
    ['500', httpError(500)],
    ['503', httpError(503)],
  ])('%s en línea: el resultado es desconocido, se encola el MISMO registro y es saved-offline', async (_label, error) => {
    const { catalog, checkout } = await readySale()
    createSale.mockRejectedValue(error)

    const result = await checkout.charge()

    expect(result.kind).toBe('saved-offline')
    const [record] = await salesQueue.list()
    expect(record.payload).toEqual(createSale.mock.calls[0][0])
    expect(catalog.getById(TAZA.id)?.stock).toBe(7)
  })

  it('error de red y reintento con el MISMO id: mismo cuerpo, sin segunda venta, sin doble descuento de stock', async () => {
    const { catalog, checkout } = await readySale()
    createSale.mockRejectedValueOnce(networkError())

    const first = await checkout.charge()
    expect(first.kind).toBe('saved-offline')

    // El servidor SÍ había guardado la venta: el reintento es un 200 idempotente
    createSale.mockImplementation(async (payload) => completed(payload, 200))
    const second = await checkout.charge()

    expect(second.kind).toBe('success')
    expect(createSale).toHaveBeenCalledTimes(2)
    expect(createSale.mock.calls[1][0]).toEqual(createSale.mock.calls[0][0]) // id, occurredAt y cuerpo idénticos
    expect(await salesQueue.list()).toEqual([]) // la copia en cola se retiró: no queda nada por reenviar
    expect(catalog.getById(TAZA.id)?.stock).toBe(7) // se descontó UNA vez
  })

  it('reintento tras saved-offline sin cambiar el carrito no duplica el registro de la cola', async () => {
    setOnline(false)
    const { checkout } = await readySale()

    const first = await checkout.charge()
    const second = await checkout.charge()

    expect(first).toEqual(second)
    expect(await salesQueue.list()).toHaveLength(1)
  })

  it('tras un intento encolado, un 400 en el reintento retira la copia de la cola y muestra rejected', async () => {
    const { checkout } = await readySale()
    createSale.mockRejectedValueOnce(networkError())
    await checkout.charge()
    expect(await salesQueue.list()).toHaveLength(1)

    createSale.mockRejectedValueOnce(httpError(400, 'Product x is deactivated and cannot be sold'))
    const result = await checkout.charge()

    expect(result).toEqual({ kind: 'rejected', reasonMessage: VOICE.sale.productDeactivated, canFix: true })
    expect(await salesQueue.list()).toEqual([])
  })

  it('sin IndexedDB y offline: failed-to-save (nunca finge que se guardó) y todo queda intacto', async () => {
    setOnline(false)
    const { catalog, cart, checkout } = await readySale()
    closeLocalDb()
    // @ts-expect-error simulamos un navegador sin IndexedDB
    globalThis.indexedDB = undefined

    const result = await checkout.charge()

    expect(result).toEqual({ kind: 'failed-to-save', message: VOICE.sale.failedToSave })
    expect(createSale).not.toHaveBeenCalled()
    expect(catalog.getById(TAZA.id)?.stock).toBe(10)
    expect(cart.lines).toHaveLength(1)
  })

  it('sin IndexedDB y con error de red: failed-to-save', async () => {
    const { checkout } = await readySale()
    createSale.mockRejectedValue(networkError())
    closeLocalDb()
    // @ts-expect-error simulamos un navegador sin IndexedDB
    globalThis.indexedDB = undefined

    expect((await checkout.charge()).kind).toBe('failed-to-save')
  })

  it('sin IndexedDB pero con el servidor respondiendo bien, el cobro en línea funciona', async () => {
    const { checkout } = await readySale()
    closeLocalDb()
    // @ts-expect-error simulamos un navegador sin IndexedDB
    globalThis.indexedDB = undefined

    expect((await checkout.charge()).kind).toBe('success')
  })
})

describe('checkout.store — id y occurredAt congelados', () => {
  it('reintentar con el carrito sin cambios reutiliza id y occurredAt aunque pase el tiempo', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-25T12:00:00.000Z'))
    const { checkout } = await readySale()
    createSale.mockRejectedValueOnce(httpError(400, 'Cash received is insufficient for the calculated total'))

    await checkout.charge()
    vi.setSystemTime(new Date('2026-09-25T12:10:00.000Z'))
    await checkout.charge()

    const [first, second] = createSale.mock.calls.map(([payload]) => payload)
    expect(second.id).toBe(first.id)
    expect(second.occurredAt).toBe('2026-09-25T12:00:00.000Z')
  })

  it('si cambia el carrito (cantidad, productos o efectivo) se genera un id NUEVO', async () => {
    const { catalog, cart, checkout } = await readySale()
    createSale.mockRejectedValue(httpError(400, 'Insufficient stock for product x'))

    await checkout.charge()
    cart.decrement(TAZA.id)
    await checkout.charge()
    cart.add(catalog.getById(SARAPE.id)!)
    cart.setCashFromDisplay('2000')
    await checkout.charge()
    cart.setCashFromDisplay('2001')
    await checkout.charge()

    const ids = createSale.mock.calls.map(([payload]) => payload.id)
    expect(new Set(ids).size).toBe(4)
  })

  it('volver al mismo contenido (agregar y quitar) conserva el id: el cuerpo sería idéntico', async () => {
    const { catalog, cart, checkout } = await readySale()
    createSale.mockRejectedValue(httpError(400, 'Insufficient stock for product x'))

    await checkout.charge()
    cart.add(catalog.getById(SARAPE.id)!)
    cart.remove(SARAPE.id)
    await checkout.charge()

    const [first, second] = createSale.mock.calls.map(([payload]) => payload)
    expect(second.id).toBe(first.id)
  })

  it('si cambia la persona que atiende se genera un id nuevo (memberId debe coincidir con los headers)', async () => {
    const { session, checkout } = await readySale()
    createSale.mockRejectedValue(httpError(400, 'Insufficient stock for product x'))

    await checkout.charge()
    session.setMember({ id: '10000000-0000-4000-8000-000000000009', name: 'Ana', role: 'colaborador', active: true })
    await checkout.charge()

    const [first, second] = createSale.mock.calls.map(([payload]) => payload)
    expect(second.id).not.toBe(first.id)
    expect(second.memberId).toBe('10000000-0000-4000-8000-000000000009')
  })

  it('startNewSale limpia carrito, efectivo y el intento: la siguiente venta tiene id nuevo', async () => {
    const { catalog, cart, checkout } = await readySale()
    await checkout.charge()
    const firstId = createSale.mock.calls[0][0].id

    checkout.startNewSale()

    expect(cart.lines).toEqual([])
    expect(cart.cashReceivedMinor).toBe(0)
    expect(checkout.lastResult).toBeNull()

    cart.add(catalog.getById(TAZA.id)!)
    cart.setQuantity(TAZA.id, 3)
    cart.setCashFromDisplay('100')
    await checkout.charge()
    expect(createSale.mock.calls[1][0].id).not.toBe(firstId)
  })

  it('dismissResult quita el resultado pero conserva el carrito, el efectivo y el intento (regresar a la venta)', async () => {
    const { cart, checkout } = await readySale()
    createSale.mockRejectedValueOnce(httpError(400, 'Insufficient stock for product x'))
    await checkout.charge()
    expect(checkout.lastResult?.kind).toBe('rejected')
    const firstId = createSale.mock.calls[0][0].id

    checkout.dismissResult()

    expect(checkout.lastResult).toBeNull()
    expect(cart.lines).toHaveLength(1)
    expect(cart.cashReceivedMinor).toBe(10000)
    // El intento sigue congelado: reintentar sin cambios manda el MISMO id (idempotencia).
    await checkout.charge()
    expect(createSale.mock.calls[1][0].id).toBe(firstId)
  })

  it('dismissResult sin resultado no hace nada', () => {
    const checkout = useCheckoutStore()
    expect(() => checkout.dismissResult()).not.toThrow()
    expect(checkout.lastResult).toBeNull()
  })
})

describe('checkout.store — doble toque', () => {
  it('dos charge() seguidos envían UNA sola venta y comparten el resultado', async () => {
    const { checkout } = await readySale()
    let release: () => void = () => undefined
    createSale.mockImplementation((payload) => new Promise((resolve) => {
      release = () => resolve(completed(payload))
    }))

    const first = checkout.charge()
    expect(checkout.loading).toBe(true)
    const second = checkout.charge()
    await vi.waitFor(() => expect(createSale).toHaveBeenCalledTimes(1))
    release()
    const [a, b] = await Promise.all([first, second])

    expect(createSale).toHaveBeenCalledTimes(1)
    expect(a).toEqual(b)
    expect(a.kind).toBe('success')
    expect(checkout.loading).toBe(false)
  })

  it('loading vuelve a false aunque el cobro termine en error', async () => {
    const { checkout } = await readySale()
    createSale.mockRejectedValue(httpError(400, 'x'))

    await checkout.charge()

    expect(checkout.loading).toBe(false)
  })

  it('un error inesperado dentro del cobro no deja loading colgado y se convierte en failed-to-save si nada pudo guardarse', async () => {
    const { checkout } = await readySale()
    createSale.mockRejectedValue(new TypeError('algo raro'))
    vi.spyOn(salesQueue, 'enqueue').mockRejectedValue(new Error('IDB roto'))

    const result = await checkout.charge()

    expect(result.kind).toBe('failed-to-save')
    expect(checkout.loading).toBe(false)
  })
})

describe('checkout.store — casos de dinero', () => {
  it('producto de precio 0 con efectivo 0 se cobra', async () => {
    const session = useSessionStore()
    session.setDevice(DEVICE)
    session.setMember(MEMBER)
    vi.mocked(ProductsService.listProducts).mockResolvedValue({
      items: [product({ id: 'free', unitPriceMinor: 0 })], total: 1, page: 1, limit: 100,
    })
    const catalog = useSaleCatalogStore()
    await catalog.load()
    const cart = useCartStore()
    cart.add(catalog.getById('free')!)

    const result = await useCheckoutStore().charge()

    expect(result.kind).toBe('success')
    expect(createSale.mock.calls[0][0]).toMatchObject({ cashReceivedMinor: 0, items: [{ productId: 'free', quantity: 1, unitPriceMinor: 0 }] })
  })
})
