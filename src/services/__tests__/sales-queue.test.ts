import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeLocalDb } from '../local-db'
import {
  count,
  countNeedsReview,
  dismissReview,
  enqueue,
  list,
  markNeedsReview,
  onQueueChange,
  recordAttempt,
  remove,
} from '../sales-queue'
import type { CreateSalePayload } from '@/types/sale.types'

const realIndexedDb = globalThis.indexedDB

function payloadFor(id: string, overrides: Partial<CreateSalePayload> = {}): CreateSalePayload {
  return {
    id,
    memberId: 'm-1',
    deviceId: 'd-1',
    occurredAt: '2026-09-25T12:00:00.000Z',
    currency: 'MXN',
    cashReceivedMinor: 10000,
    items: [{ productId: 'p-1', quantity: 2, unitPriceMinor: 1999 }],
    ...overrides,
  }
}

function input(id: string, createdAt = '2026-09-25T12:00:00.000Z', extra: Partial<CreateSalePayload> = {}) {
  return {
    payload: payloadFor(id, extra),
    createdAt,
    sellerName: 'Carlos',
    totalMinorEstimate: 3998,
    changeMinorEstimate: 6002,
  }
}

beforeEach(() => {
  closeLocalDb()
  globalThis.indexedDB = new IDBFactory()
})
afterEach(() => {
  closeLocalDb()
  globalThis.indexedDB = realIndexedDb
})

describe('enqueue', () => {
  it('guarda un registro pending con el payload congelado y los datos de visualización', async () => {
    const result = await enqueue(input('a'))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.alreadyQueued).toBe(false)
    expect(result.record).toEqual({
      id: 'a',
      payload: payloadFor('a'),
      createdAt: '2026-09-25T12:00:00.000Z',
      state: 'pending',
      attempts: 0,
      sellerName: 'Carlos',
      totalMinorEstimate: 3998,
      changeMinorEstimate: 6002,
    })
    expect(await list()).toEqual([result.record])
  })

  it('es idempotente por id: el mismo id dos veces no crea dos registros', async () => {
    await enqueue(input('a'))
    const second = await enqueue(input('a'))

    expect(second.ok && second.alreadyQueued).toBe(true)
    expect(await list()).toHaveLength(1)
    expect(await count()).toBe(1)
  })

  it('un segundo enqueue con el mismo id NO muta el payload congelado', async () => {
    await enqueue(input('a'))
    const second = await enqueue(input('a', '2026-09-25T13:00:00.000Z', { cashReceivedMinor: 99999 }))

    expect(second.ok && second.record.payload.cashReceivedMinor).toBe(10000)
    const [stored] = await list()
    expect(stored.payload.cashReceivedMinor).toBe(10000)
    expect(stored.createdAt).toBe('2026-09-25T12:00:00.000Z')
  })

  it('guarda una copia: mutar el objeto de entrada después no altera lo guardado', async () => {
    const original = input('a')
    await enqueue(original)
    original.payload.items[0].quantity = 99

    expect((await list())[0].payload.items[0].quantity).toBe(2)
  })

  it('sobrevive a un "reload": cerrar y reabrir la base conserva el registro', async () => {
    await enqueue(input('a'))
    closeLocalDb()

    const [record] = await list()
    expect(record.id).toBe('a')
    expect(record.state).toBe('pending')
  })

  it('sin IndexedDB devuelve { ok: false } en vez de fingir que se guardó', async () => {
    closeLocalDb()
    // @ts-expect-error simulamos un navegador sin IndexedDB
    globalThis.indexedDB = undefined

    const result = await enqueue(input('a'))

    expect(result).toEqual({ ok: false, reason: 'storage-unavailable' })
  })
})

describe('list / count', () => {
  it('ordena por createdAt y desempata por id', async () => {
    await enqueue(input('c', '2026-09-25T12:00:02.000Z'))
    await enqueue(input('b', '2026-09-25T12:00:01.000Z'))
    await enqueue(input('a', '2026-09-25T12:00:01.000Z'))

    expect((await list()).map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('count cuenta solo pending y countNeedsReview solo needs_review', async () => {
    await enqueue(input('a'))
    await enqueue(input('b'))
    await enqueue(input('c'))
    await markNeedsReview('b', 'Motivo')

    expect(await count()).toBe(2)
    expect(await countNeedsReview()).toBe(1)
  })

  it('con la cola vacía todo es 0', async () => {
    expect(await list()).toEqual([])
    expect(await count()).toBe(0)
    expect(await countNeedsReview()).toBe(0)
  })
})

describe('markNeedsReview / recordAttempt / remove / dismissReview', () => {
  it('markNeedsReview cambia el estado y guarda el motivo sin tocar el payload', async () => {
    await enqueue(input('a'))

    expect(await markNeedsReview('a', 'Un socio puede revisarla.')).toBe(true)

    const [record] = await list()
    expect(record.state).toBe('needs_review')
    expect(record.lastError).toBe('Un socio puede revisarla.')
    expect(record.payload).toEqual(payloadFor('a'))
  })

  it('recordAttempt suma un intento, guarda el error y la hora, y mantiene pending', async () => {
    await enqueue(input('a'))

    expect(await recordAttempt('a', 'Sin internet', '2026-09-25T12:05:00.000Z')).toBe(true)
    await recordAttempt('a', 'Sin internet otra vez', '2026-09-25T12:06:00.000Z')

    const [record] = await list()
    expect(record.attempts).toBe(2)
    expect(record.lastError).toBe('Sin internet otra vez')
    expect(record.lastAttemptAt).toBe('2026-09-25T12:06:00.000Z')
    expect(record.state).toBe('pending')
  })

  it('operar sobre un id que no existe devuelve false y no crea nada', async () => {
    expect(await markNeedsReview('nope', 'x')).toBe(false)
    expect(await recordAttempt('nope', 'x')).toBe(false)
    expect(await remove('nope')).toBe(false)
    expect(await dismissReview('nope')).toBe(false)
    expect(await list()).toEqual([])
  })

  it('remove elimina el registro', async () => {
    await enqueue(input('a'))
    expect(await remove('a')).toBe(true)
    expect(await list()).toEqual([])
  })

  it('dismissReview quita una needs_review pero JAMÁS una pending (una venta sin enviar no se descarta)', async () => {
    await enqueue(input('a'))
    await enqueue(input('b'))
    await markNeedsReview('b', 'Motivo')

    expect(await dismissReview('a')).toBe(false)
    expect(await dismissReview('b')).toBe(true)

    expect((await list()).map((r) => r.id)).toEqual(['a'])
  })
})

describe('onQueueChange', () => {
  it('avisa después de cada cambio y permite darse de baja', async () => {
    const listener = vi.fn()
    const off = onQueueChange(listener)

    await enqueue(input('a'))
    await recordAttempt('a', 'x')
    await markNeedsReview('a', 'y')
    await dismissReview('a')
    await enqueue(input('b'))
    await remove('b')
    expect(listener).toHaveBeenCalledTimes(6)

    off()
    await enqueue(input('c'))
    expect(listener).toHaveBeenCalledTimes(6)
  })

  it('no avisa cuando no hubo cambio (id repetido, id inexistente)', async () => {
    await enqueue(input('a'))
    const listener = vi.fn()
    onQueueChange(listener)

    await enqueue(input('a'))
    await remove('nope')

    expect(listener).not.toHaveBeenCalled()
  })

  it('un listener que lanza no rompe la operación ni a los demás', async () => {
    onQueueChange(() => { throw new Error('boom') })
    const other = vi.fn()
    onQueueChange(other)

    const result = await enqueue(input('a'))

    expect(result.ok).toBe(true)
    expect(other).toHaveBeenCalledTimes(1)
  })
})
