// Helper de tests: simula las capacidades del dispositivo. jsdom no trae
// `window.matchMedia` ni `navigator.maxTouchPoints` reales, así que los tests
// que dependen de "táctil" / "pantalla pequeña" instalan este mock.
import { vi } from 'vitest'
import { COARSE_POINTER_QUERY, SMALL_SCREEN_QUERY } from '@/composables/useDeviceCapabilities'

interface DeviceState {
  touch: boolean
  small: boolean
}

type Listener = () => void

interface MockMediaQueryList {
  matches: boolean
  media: string
  addEventListener: (type: string, listener: Listener) => void
  removeEventListener: (type: string, listener: Listener) => void
}

export interface MockDevice {
  /** Cambia el estado y avisa a quienes escuchan `change` (como al girar la tablet). */
  set: (next: Partial<DeviceState>) => void
  /** Listeners `change` activos ahora mismo (para comprobar la limpieza). */
  listenerCount: () => number
  restore: () => void
}

const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia')
const originalMaxTouchPoints = Object.getOwnPropertyDescriptor(navigator, 'maxTouchPoints')

/**
 * @param initial `touch`: puntero grueso; `small`: viewport < 900 px.
 * `touchPoints` es independiente para probar la señal de `maxTouchPoints`.
 */
export function mockDevice(
  initial: Partial<DeviceState> & { touchPoints?: number } = {},
): MockDevice {
  const state: DeviceState = { touch: initial.touch ?? false, small: initial.small ?? false }
  // Array (no Set): las dos consultas registran el mismo `refresh`, y cada
  // registro debe contar por separado para poder comprobar la limpieza.
  const listeners: Listener[] = []

  const matchMedia = vi.fn((query: string): MockMediaQueryList => ({
    get matches() {
      if (query === COARSE_POINTER_QUERY) return state.touch
      if (query === SMALL_SCREEN_QUERY) return state.small
      return false
    },
    media: query,
    addEventListener: (_type, listener) => { listeners.push(listener) },
    removeEventListener: (_type, listener) => {
      const index = listeners.indexOf(listener)
      if (index >= 0) listeners.splice(index, 1)
    },
  }))

  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: matchMedia })
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: initial.touchPoints ?? 0,
  })

  return {
    set(next) {
      Object.assign(state, next)
      // Copia: un listener puede darse de baja mientras se notifica.
      ;[...listeners].forEach((listener) => listener())
    },
    listenerCount: () => listeners.length,
    restore() {
      if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia)
      else Reflect.deleteProperty(window, 'matchMedia')
      if (originalMaxTouchPoints) Object.defineProperty(navigator, 'maxTouchPoints', originalMaxTouchPoints)
      else Reflect.deleteProperty(navigator, 'maxTouchPoints')
    },
  }
}
