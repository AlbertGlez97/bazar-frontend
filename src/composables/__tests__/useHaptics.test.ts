import { afterEach, describe, expect, it, vi } from 'vitest'
import { useHaptics, HAPTIC_OK, HAPTIC_ERROR } from '../useHaptics'

const original = Object.getOwnPropertyDescriptor(navigator, 'vibrate')
afterEach(() => {
  if (original) Object.defineProperty(navigator, 'vibrate', original)
  else delete (navigator as unknown as Record<string, unknown>).vibrate
})

function setVibrate(value: unknown) {
  Object.defineProperty(navigator, 'vibrate', { configurable: true, writable: true, value })
}

describe('useHaptics', () => {
  it('vibra una vez, corto, con el patrón de "listo"', () => {
    const vibrate = vi.fn(() => true)
    setVibrate(vibrate)

    expect(useHaptics().vibrate(HAPTIC_OK)).toBe(true)

    expect(vibrate).toHaveBeenCalledWith(HAPTIC_OK)
    expect(HAPTIC_OK).toBeLessThanOrEqual(60)
  })

  it('el patrón de error son dos pulsos cortos', () => {
    expect(Array.isArray(HAPTIC_ERROR)).toBe(true)
    expect((HAPTIC_ERROR as number[]).length).toBe(3)
  })

  it('sin soporte (iOS) no lanza error y devuelve false', () => {
    delete (navigator as unknown as Record<string, unknown>).vibrate

    expect(() => useHaptics().vibrate(HAPTIC_OK)).not.toThrow()
    expect(useHaptics().vibrate(HAPTIC_OK)).toBe(false)
    expect(useHaptics().supported()).toBe(false)
  })

  it('si el navegador lanza al vibrar (política de permisos) lo absorbe', () => {
    setVibrate(() => { throw new Error('blocked') })

    expect(() => useHaptics().vibrate(HAPTIC_OK)).not.toThrow()
    expect(useHaptics().vibrate(HAPTIC_OK)).toBe(false)
  })
})
