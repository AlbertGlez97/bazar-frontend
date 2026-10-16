import { describe, expect, it } from 'vitest'
import {
  MAX_STOCK,
  buildRestockPayload,
  canRestock,
  maxRestockQuantity,
  stockAfterRestock,
} from '../product-restock'
import type { Product } from '@/types/product.types'

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p-1', name: 'Lámpara', tipo: 'cantidad', unitPriceMinor: 5000, initialStock: 10, stock: 10,
  category: null, purchaseCostMinor: 1000, supplier: null, notes: null,
  createdAt: '2026-01-01T00:00:00.000Z', active: true, image: null, ...overrides,
})

describe('canRestock', () => {
  it('un producto por cantidad y activo se puede reponer', () => {
    expect(canRestock(product())).toBe(true)
  })
  it('también si está agotado (es justo cuando se necesita)', () => {
    expect(canRestock(product({ stock: 0 }))).toBe(true)
  })
  it('una pieza única no se repone', () => {
    expect(canRestock(product({ tipo: 'unica', stock: 0 }))).toBe(false)
  })
  it('un producto desactivado no se repone (primero se reactiva)', () => {
    expect(canRestock(product({ active: false }))).toBe(false)
  })
})

describe('maxRestockQuantity / stockAfterRestock', () => {
  it('el tope es lo que falta para llegar al máximo permitido', () => {
    expect(maxRestockQuantity(product({ stock: 10 }))).toBe(MAX_STOCK - 10)
    expect(maxRestockQuantity(product({ stock: MAX_STOCK }))).toBe(0)
  })
  it('la existencia resultante es la actual más lo que se suma', () => {
    expect(stockAfterRestock(product({ stock: 10 }), 5)).toBe(15)
    expect(stockAfterRestock(product({ stock: 0 }), 3)).toBe(3)
  })
})

describe('buildRestockPayload', () => {
  const draft = (overrides: Partial<{ quantity: number; costText: string; note: string }> = {}) =>
    ({ quantity: 3, costText: '', note: '', ...overrides })

  describe('lo que manda', () => {
    it('solo la cantidad cuando no hay costo ni nota', () => {
      const result = buildRestockPayload(draft(), product())

      expect(result).toEqual({ ok: true, payload: { quantity: 3 } })
      if (result.ok) expect(Object.keys(result.payload)).toEqual(['quantity'])
    })

    it('el costo en pesos viaja en centavos', () => {
      expect(buildRestockPayload(draft({ costText: '12.50' }), product())).toEqual({
        ok: true, payload: { quantity: 3, unitCostMinor: 1250 },
      })
      expect(buildRestockPayload(draft({ costText: '$1,000.05' }), product())).toEqual({
        ok: true, payload: { quantity: 3, unitCostMinor: 100005 },
      })
    })

    it('un costo de 0 es un costo (piezas regaladas), no un campo vacío', () => {
      expect(buildRestockPayload(draft({ costText: '0' }), product())).toEqual({
        ok: true, payload: { quantity: 3, unitCostMinor: 0 },
      })
    })

    it('un costo en blanco se omite', () => {
      const result = buildRestockPayload(draft({ costText: '   ' }), product())

      expect(result).toEqual({ ok: true, payload: { quantity: 3 } })
    })

    it('la nota se recorta y una nota en blanco se omite', () => {
      expect(buildRestockPayload(draft({ note: '  Compra del sábado  ' }), product())).toEqual({
        ok: true, payload: { quantity: 3, note: 'Compra del sábado' },
      })
      expect(buildRestockPayload(draft({ note: '   ' }), product())).toEqual({
        ok: true, payload: { quantity: 3 },
      })
    })

    it('todo junto', () => {
      expect(buildRestockPayload(draft({ quantity: 7, costText: '8', note: 'x' }), product())).toEqual({
        ok: true, payload: { quantity: 7, unitCostMinor: 800, note: 'x' },
      })
    })
  })

  describe('cantidad', () => {
    it.each([0, -1, 1.5, Number.NaN])('rechaza %s', (quantity) => {
      const result = buildRestockPayload(draft({ quantity }), product())

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.errors.quantity).toBe('Escribe cuántas piezas compraste (1 o más).')
    })

    it('rechaza una cantidad que haría pasar la existencia del máximo', () => {
      const result = buildRestockPayload(draft({ quantity: 101 }), product({ stock: MAX_STOCK - 100 }))

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.errors.quantity).toMatch(/máximo/i)
    })

    it('acepta exactamente hasta el máximo', () => {
      expect(buildRestockPayload(draft({ quantity: 100 }), product({ stock: MAX_STOCK - 100 })).ok).toBe(true)
    })
  })

  describe('costo', () => {
    it.each(['100,50', '10.005', '-20', 'abc', '1e5'])('avisa de un monto que no entiende (%s) en vez de guardarlo como 0', (costText) => {
      const result = buildRestockPayload(draft({ costText }), product())

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.errors.cost).toMatch(/No entiendo ese monto/)
    })

    it('rechaza un costo por encima del máximo que acepta el servidor', () => {
      const result = buildRestockPayload(draft({ costText: '99999999999' }), product())

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.errors.cost).toMatch(/demasiado grande/i)
    })
  })

  describe('nota', () => {
    it('rechaza una nota de más de 1000 caracteres', () => {
      const result = buildRestockPayload(draft({ note: 'x'.repeat(1001) }), product())

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.errors.note).toMatch(/1000/)
    })

    it('acepta una nota de exactamente 1000', () => {
      expect(buildRestockPayload(draft({ note: 'x'.repeat(1000) }), product()).ok).toBe(true)
    })
  })

  it('junta todos los errores a la vez', () => {
    const result = buildRestockPayload(draft({ quantity: 0, costText: 'abc', note: 'x'.repeat(1001) }), product())

    expect(result.ok).toBe(false)
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['cost', 'note', 'quantity'])
  })
})
