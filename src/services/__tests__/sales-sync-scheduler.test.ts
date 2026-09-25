import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSyncScheduler } from '../sales-sync-scheduler'
import type { SchedulerDeps } from '../sales-sync-scheduler'
import type { SyncSummary } from '../sales-sync'

const INTERVAL = 30_000
const MAX_BACKOFF = 300_000

const done: SyncSummary = { synced: 1, needsReview: 0, remainingPending: 0, stoppedBecause: null }
const failed = (stoppedBecause: SyncSummary['stoppedBecause'] = 'network', remainingPending = 1): SyncSummary => ({
  synced: 0, needsReview: 0, remainingPending, stoppedBecause,
})

/** Escenario controlable: cuántas pendientes hay, si hay red y qué responde cada corrida. */
function setup(initialPending = 1) {
  const state = { pending: initialPending, online: true }
  const target = new EventTarget()
  const results: SyncSummary[] = []

  const sync = vi.fn(async (): Promise<SyncSummary> => {
    const next = results.shift() ?? done
    if (next.stoppedBecause === null) state.pending = next.remainingPending
    return next
  })
  const onSyncStart = vi.fn()
  const onSyncEnd = vi.fn()

  const deps: SchedulerDeps = {
    sync,
    countPending: async () => state.pending,
    isOnline: () => state.online,
    target,
    onSyncStart,
    onSyncEnd,
    intervalMs: INTERVAL,
    maxBackoffMs: MAX_BACKOFF,
  }
  const scheduler = createSyncScheduler(deps)
  const goOnline = () => { state.online = true; target.dispatchEvent(new Event('online')) }
  const goOffline = () => { state.online = false; target.dispatchEvent(new Event('offline')) }
  return { scheduler, sync, state, results, target, goOnline, goOffline, onSyncStart, onSyncEnd }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('createSyncScheduler — disparadores', () => {
  it('start() sincroniza de inmediato si hay pendientes y hay red', async () => {
    const { scheduler, sync } = setup()

    await scheduler.start()

    expect(sync).toHaveBeenCalledTimes(1)
    scheduler.stop()
  })

  it('start() no sincroniza ni programa timers si no hay nada pendiente', async () => {
    const { scheduler, sync } = setup(0)

    await scheduler.start()

    expect(sync).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    scheduler.stop()
  })

  it('start() sin red no sincroniza y no programa timers', async () => {
    const { scheduler, sync, state } = setup()
    state.online = false

    await scheduler.start()

    expect(sync).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    scheduler.stop()
  })

  it('el evento "online" dispara una corrida', async () => {
    const { scheduler, sync, state, goOnline } = setup()
    state.online = false
    await scheduler.start()
    expect(sync).not.toHaveBeenCalled()

    goOnline()
    await vi.advanceTimersByTimeAsync(0)

    expect(sync).toHaveBeenCalledTimes(1)
    scheduler.stop()
  })

  it('mientras haya pendientes y red, reintenta cada 30 s', async () => {
    const { scheduler, sync, results } = setup()
    results.push(failed('server'), failed('server'))
    await scheduler.start()
    expect(sync).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(INTERVAL)
    expect(sync).toHaveBeenCalledTimes(2)
    scheduler.stop()
  })

  it('cuando la cola queda vacía deja de programar timers', async () => {
    const { scheduler, sync } = setup()
    await scheduler.start() // done -> pending 0

    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(INTERVAL * 10)
    expect(sync).toHaveBeenCalledTimes(1)
    scheduler.stop()
  })

  it('sin red no hay timer; el evento "offline" cancela el que estuviera armado', async () => {
    const { scheduler, results, goOffline } = setup()
    results.push(failed('server'))
    await scheduler.start()
    expect(vi.getTimerCount()).toBe(1)

    goOffline()

    expect(vi.getTimerCount()).toBe(0)
    scheduler.stop()
  })
})

describe('createSyncScheduler — backoff', () => {
  it('cada fallo consecutivo duplica la espera (30 s, 60 s, 120 s...) con tope de 5 min', async () => {
    const { scheduler, sync, results } = setup()
    results.push(...Array.from({ length: 8 }, () => failed('network')))
    await scheduler.start() // 1er fallo -> próxima en 30 s

    const gaps: number[] = []
    expect(vi.getTimerCount()).toBe(1)

    for (const expected of [30_000, 60_000, 120_000, 240_000, MAX_BACKOFF, MAX_BACKOFF]) {
      const before = sync.mock.calls.length
      await vi.advanceTimersByTimeAsync(expected - 1)
      expect(sync.mock.calls.length, `aún no debe correr antes de ${expected} ms`).toBe(before)
      await vi.advanceTimersByTimeAsync(1)
      expect(sync.mock.calls.length).toBe(before + 1)
      gaps.push(expected)
    }
    expect(gaps).toEqual([30_000, 60_000, 120_000, 240_000, 300_000, 300_000])
    scheduler.stop()
  })

  it('un éxito reinicia el backoff', async () => {
    const { scheduler, sync, results, state } = setup()
    results.push(failed('network'), failed('network'))
    await scheduler.start()
    await vi.advanceTimersByTimeAsync(30_000) // 2º fallo -> próxima en 60 s
    // La siguiente corrida tiene éxito parcial y aún quedan pendientes
    results.push({ synced: 1, needsReview: 0, remainingPending: 1, stoppedBecause: null })
    await vi.advanceTimersByTimeAsync(60_000)
    state.pending = 1
    expect(sync).toHaveBeenCalledTimes(3)

    // Tras el éxito, la espera vuelve a 30 s
    results.push(done)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(sync).toHaveBeenCalledTimes(4)
    scheduler.stop()
  })

  it('volver a tener red reinicia el backoff y corre de inmediato', async () => {
    const { scheduler, sync, results, goOffline, goOnline } = setup()
    results.push(failed('network'), failed('network'), failed('network'))
    await scheduler.start()
    await vi.advanceTimersByTimeAsync(30_000)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(sync).toHaveBeenCalledTimes(3)

    goOffline()
    goOnline()
    await vi.advanceTimersByTimeAsync(0)
    expect(sync).toHaveBeenCalledTimes(4)
    scheduler.stop()
  })

  it('"locked-elsewhere" no cuenta como fallo (otra pestaña está trabajando)', async () => {
    const { scheduler, sync, results } = setup()
    results.push(failed('locked-elsewhere'), failed('locked-elsewhere'))
    await scheduler.start()

    await vi.advanceTimersByTimeAsync(INTERVAL)
    expect(sync).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(INTERVAL)
    expect(sync).toHaveBeenCalledTimes(3)
    scheduler.stop()
  })

  it('si sync lanza, cuenta como fallo y el scheduler sigue vivo', async () => {
    const { scheduler, sync } = setup()
    sync.mockRejectedValueOnce(new Error('boom'))

    await expect(scheduler.start()).resolves.toBeUndefined()

    await vi.advanceTimersByTimeAsync(INTERVAL)
    expect(sync).toHaveBeenCalledTimes(2)
    scheduler.stop()
  })
})

describe('createSyncScheduler — ciclo de vida', () => {
  it('stop() quita el listener y el timer: ya no sincroniza', async () => {
    const { scheduler, sync, results, goOnline } = setup()
    results.push(failed('server'))
    await scheduler.start()
    scheduler.stop()

    expect(vi.getTimerCount()).toBe(0)
    goOnline()
    await vi.advanceTimersByTimeAsync(INTERVAL * 5)
    expect(sync).toHaveBeenCalledTimes(1)
  })

  it('start() dos veces no duplica listeners ni timers', async () => {
    const { scheduler, sync, results, goOnline } = setup()
    results.push(failed('server'), failed('server'), failed('server'))
    await scheduler.start()
    await scheduler.start()
    scheduler.stop()
    await scheduler.start()

    expect(vi.getTimerCount()).toBeLessThanOrEqual(1)
    const before = sync.mock.calls.length
    goOnline()
    await vi.advanceTimersByTimeAsync(0)
    expect(sync.mock.calls.length).toBe(before + 1)
    scheduler.stop()
  })

  it('notifyChange() arma el timer cuando aparece una pendiente nueva (p. ej. tras encolar)', async () => {
    const { scheduler, sync, state } = setup(0)
    await scheduler.start()
    expect(vi.getTimerCount()).toBe(0)

    state.pending = 1
    await scheduler.notifyChange()
    expect(vi.getTimerCount()).toBe(1)

    await vi.advanceTimersByTimeAsync(INTERVAL)
    expect(sync).toHaveBeenCalledTimes(1)
    scheduler.stop()
  })

  it('notifyChange() no hace nada si el scheduler no está iniciado', async () => {
    const { scheduler } = setup()
    await scheduler.notifyChange()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('syncNow() corre aunque el scheduler no esté iniciado y avisa inicio y fin', async () => {
    const { scheduler, sync, onSyncStart, onSyncEnd } = setup()

    const summary = await scheduler.syncNow()

    expect(summary).toEqual(done)
    expect(sync).toHaveBeenCalledTimes(1)
    expect(onSyncStart).toHaveBeenCalledTimes(1)
    expect(onSyncEnd).toHaveBeenCalledExactlyOnceWith(done)
  })

  it('syncNow() sin red no llama a sync', async () => {
    const { scheduler, sync, state } = setup()
    state.online = false

    const summary = await scheduler.syncNow()

    expect(sync).not.toHaveBeenCalled()
    expect(summary.stoppedBecause).toBe('offline')
  })
})
