import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useMediaQuery } from '../useMediaQuery'
import { usePrefersReducedMotion } from '../usePrefersReducedMotion'

type Listener = (event: { matches: boolean }) => void

function mockMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>()
  let matches = initial
  const list = {
    get matches() { return matches },
    addEventListener: vi.fn((_: string, fn: Listener) => listeners.add(fn)),
    removeEventListener: vi.fn((_: string, fn: Listener) => listeners.delete(fn)),
  }
  window.matchMedia = vi.fn(() => list) as unknown as typeof window.matchMedia
  return {
    list,
    listeners,
    set(value: boolean) { matches = value; listeners.forEach((fn) => fn({ matches: value })) },
  }
}

const original = window.matchMedia
afterEach(() => { window.matchMedia = original })

describe('usePrefersReducedMotion', () => {
  it('reads the initial preference and picks the scroll behavior from it', () => {
    mockMatchMedia(true)
    const scope = effectScope()
    const state = scope.run(() => usePrefersReducedMotion())!
    expect(state.prefersReducedMotion.value).toBe(true)
    expect(state.scrollBehavior.value).toBe('auto')
    scope.stop()
  })

  it('reacts to matchMedia changes and stops listening with its scope', () => {
    const media = mockMatchMedia(false)
    const scope = effectScope()
    const state = scope.run(() => usePrefersReducedMotion())!
    expect(state.scrollBehavior.value).toBe('smooth')
    media.set(true)
    expect(state.prefersReducedMotion.value).toBe(true)
    expect(state.scrollBehavior.value).toBe('auto')
    media.set(false)
    expect(state.scrollBehavior.value).toBe('smooth')
    scope.stop()
    expect(media.list.removeEventListener).toHaveBeenCalled()
    expect(media.listeners.size).toBe(0)
  })

  it('queries the reduced-motion media feature', () => {
    mockMatchMedia(false)
    const scope = effectScope()
    scope.run(() => usePrefersReducedMotion())
    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
    scope.stop()
  })

  it('degrades to the fallback when matchMedia is unavailable', () => {
    // @ts-expect-error simulating an environment without matchMedia
    window.matchMedia = undefined
    const scope = effectScope()
    const wide = scope.run(() => useMediaQuery('(min-width: 900px)', true))!
    const reduced = scope.run(() => usePrefersReducedMotion())!
    expect(wide.value).toBe(true)
    expect(reduced.prefersReducedMotion.value).toBe(false)
    scope.stop()
  })
})
