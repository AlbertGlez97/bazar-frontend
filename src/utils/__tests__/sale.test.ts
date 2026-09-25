import { describe, expect, it } from 'vitest'
import { buildSalePayload, newSaleId } from '../sale'

const MEMBER = '10000000-0000-4000-8000-000000000003'
const DEVICE = '20000000-0000-4000-8000-000000000001'
const P1 = '30000000-0000-4000-8000-000000000001'
const P2 = '30000000-0000-4000-8000-000000000002'
const SALE_ID = '0190a5f0-7c3e-7000-8000-000000000001'

const base = {
  id: SALE_ID,
  memberId: MEMBER,
  deviceId: DEVICE,
  occurredAt: '2026-09-23T12:00:00.000Z',
  cashReceivedMinor: 250000,
}

describe('newSaleId (UUID v7)', () => {
  it('tiene forma de UUID con la versión 7 y la variante RFC 4122', () => {
    const id = newSaleId()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('genera ids distintos en cada llamada', () => {
    const ids = new Set(Array.from({ length: 500 }, () => newSaleId()))
    expect(ids.size).toBe(500)
  })

  it('son ordenables por tiempo (v7): un id posterior no es menor', () => {
    const first = newSaleId()
    const later = newSaleId()
    expect(first <= later).toBe(true)
  })
})

describe('buildSalePayload', () => {
  it('produce exactamente el cuerpo del contrato (moneda MXN, sin campos extra)', () => {
    const payload = buildSalePayload({
      ...base,
      lines: [
        { productId: P1, quantity: 1, unitPriceMinor: 125000 },
        { productId: P2, quantity: 2, unitPriceMinor: 42500 },
      ],
    })

    expect(payload).toEqual({
      id: SALE_ID,
      memberId: MEMBER,
      deviceId: DEVICE,
      occurredAt: '2026-09-23T12:00:00.000Z',
      currency: 'MXN',
      cashReceivedMinor: 250000,
      items: [
        { productId: P1, quantity: 1, unitPriceMinor: 125000 },
        { productId: P2, quantity: 2, unitPriceMinor: 42500 },
      ],
    })
  })

  it('no contiene propiedades desconocidas (el servidor responde 400 si las hay)', () => {
    const payload = buildSalePayload({
      ...base,
      // Una línea del carrito trae más datos que el contrato: no deben colarse.
      lines: [{ productId: P1, quantity: 1, unitPriceMinor: 100, name: 'Taza', image: '/x.png' } as never],
    })

    expect(Object.keys(payload).sort()).toEqual(
      ['cashReceivedMinor', 'currency', 'deviceId', 'id', 'items', 'memberId', 'occurredAt'],
    )
    expect(Object.keys(payload.items[0]).sort()).toEqual(['productId', 'quantity', 'unitPriceMinor'])
    expect(payload).not.toHaveProperty('contextId')
  })

  it('omite unitPriceMinor cuando la línea no lo trae', () => {
    const payload = buildSalePayload({ ...base, lines: [{ productId: P1, quantity: 3 }] })
    expect(payload.items[0]).toEqual({ productId: P1, quantity: 3 })
    expect(Object.keys(payload.items[0])).not.toContain('unitPriceMinor')
  })

  it('fusiona líneas repetidas del mismo producto sumando cantidades, en orden de aparición', () => {
    const payload = buildSalePayload({
      ...base,
      lines: [
        { productId: P1, quantity: 1, unitPriceMinor: 100 },
        { productId: P2, quantity: 1, unitPriceMinor: 200 },
        { productId: P1, quantity: 4, unitPriceMinor: 100 },
      ],
    })

    expect(payload.items).toEqual([
      { productId: P1, quantity: 5, unitPriceMinor: 100 },
      { productId: P2, quantity: 1, unitPriceMinor: 200 },
    ])
  })

  it('acepta un Date en occurredAt y lo serializa como instante ISO con Z', () => {
    const payload = buildSalePayload({
      ...base,
      occurredAt: new Date('2026-09-23T06:00:00.000-06:00'),
      lines: [{ productId: P1, quantity: 1 }],
    })
    expect(payload.occurredAt).toBe('2026-09-23T12:00:00.000Z')
  })

  it('acepta efectivo en cero (producto de precio 0)', () => {
    const payload = buildSalePayload({
      ...base,
      cashReceivedMinor: 0,
      lines: [{ productId: P1, quantity: 1, unitPriceMinor: 0 }],
    })
    expect(payload.cashReceivedMinor).toBe(0)
    expect(payload.items[0].unitPriceMinor).toBe(0)
  })

  it('no comparte referencias con las líneas de entrada (copia defensiva)', () => {
    const lines = [{ productId: P1, quantity: 1, unitPriceMinor: 100 }]
    const payload = buildSalePayload({ ...base, lines })
    lines[0].quantity = 99
    expect(payload.items[0].quantity).toBe(1)
  })

  it.each([
    ['sin líneas', { lines: [] }],
    ['cantidad 0', { lines: [{ productId: P1, quantity: 0 }] }],
    ['cantidad negativa', { lines: [{ productId: P1, quantity: -1 }] }],
    ['cantidad decimal', { lines: [{ productId: P1, quantity: 1.5 }] }],
    ['cantidad sobre 100000', { lines: [{ productId: P1, quantity: 100001 }] }],
    ['efectivo decimal', { cashReceivedMinor: 100.5, lines: [{ productId: P1, quantity: 1 }] }],
    ['efectivo negativo', { cashReceivedMinor: -1, lines: [{ productId: P1, quantity: 1 }] }],
    ['efectivo sobre el máximo', { cashReceivedMinor: 2147483648, lines: [{ productId: P1, quantity: 1 }] }],
    ['precio decimal', { lines: [{ productId: P1, quantity: 1, unitPriceMinor: 10.5 }] }],
    ['fecha inválida', { occurredAt: 'no-es-fecha', lines: [{ productId: P1, quantity: 1 }] }],
  ])('rechaza datos que el servidor devolvería como 400: %s', (_label, overrides) => {
    expect(() => buildSalePayload({ ...base, ...overrides })).toThrow()
  })

  it('rechaza más de 500 productos distintos', () => {
    const lines = Array.from({ length: 501 }, (_, i) => ({
      productId: `30000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      quantity: 1,
    }))
    expect(() => buildSalePayload({ ...base, lines })).toThrow()
  })
})
