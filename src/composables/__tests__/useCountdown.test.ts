import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useCountdown } from '../useCountdown'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useCountdown', () => {
  it('arranca en 0 y sin estar corriendo', () => {
    const { remaining, running } = useCountdown()
    expect(remaining.value).toBe(0)
    expect(running.value).toBe(false)
  })

  it('cuenta hacia atrás de segundo en segundo y se detiene en 0', () => {
    const { remaining, running, start } = useCountdown()

    start(3)
    expect(remaining.value).toBe(3)
    expect(running.value).toBe(true)

    vi.advanceTimersByTime(1000)
    expect(remaining.value).toBe(2)
    vi.advanceTimersByTime(2000)
    expect(remaining.value).toBe(0)
    expect(running.value).toBe(false)

    vi.advanceTimersByTime(5000)
    expect(remaining.value).toBe(0)
  })

  it('volver a arrancar reinicia la cuenta sin duplicar relojes', () => {
    const { remaining, start } = useCountdown()

    start(10)
    vi.advanceTimersByTime(4000)
    start(10)
    vi.advanceTimersByTime(1000)

    expect(remaining.value).toBe(9)
  })

  it('se limpia solo al destruir el alcance (no deja relojes vivos)', () => {
    const scope = effectScope()
    const countdown = scope.run(() => useCountdown())!

    countdown.start(10)
    scope.stop()

    expect(vi.getTimerCount()).toBe(0)
  })
})
