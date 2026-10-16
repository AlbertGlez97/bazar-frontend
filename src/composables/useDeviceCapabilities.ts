// Composable de capacidades del dispositivo — detecta si es táctil y si la
// pantalla es pequeña, y se mantiene al día cuando cambian (girar la tablet,
// redimensionar la ventana, conectar un mouse).
//
// Solo INFORMA: quien lo usa decide qué hacer con la señal. Nunca fija nada
// por su cuenta (ver `suggestUiMode()` y el store de modo de interfaz).

import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'
import type { UiMode } from '@/types/ui-mode.types'

/**
 * Ancho de viewport (px) desde el cual la pantalla ya NO se considera
 * pequeña. Debajo de esto (teléfono, tablet vertical estrecha) la vista de
 * gestión se queda apretada. No existía un breakpoint compartido en el
 * proyecto y no se añadió una librería: `matchMedia` basta.
 */
export const SMALL_SCREEN_MAX_WIDTH = 900

/** Consulta de "pantalla pequeña": estrictamente menor a 900 px (899.98 evita el solape en 900). */
export const SMALL_SCREEN_QUERY = '(max-width: 899.98px)'

/** Consulta de puntero impreciso (dedo) como puntero principal. */
export const COARSE_POINTER_QUERY = '(pointer: coarse)'

export interface DeviceCapabilities {
  isTouchDevice: boolean
  isSmallScreen: boolean
}

/** jsdom y algunos entornos (SSR) no tienen `matchMedia`. */
function getMatchMedia(): ((query: string) => MediaQueryList) | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia.bind(window)
}

/**
 * Lectura puntual (no reactiva) de las capacidades. La usa el store para
 * decidir la sugerencia inicial sin dejar listeners abiertos.
 * Táctil = puntero grueso (`pointer: coarse`) O al menos un punto de contacto.
 */
export function detectDeviceCapabilities(): DeviceCapabilities {
  const matchMedia = getMatchMedia()
  const coarse = matchMedia?.(COARSE_POINTER_QUERY).matches ?? false
  const touchPoints = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0
  return {
    isTouchDevice: coarse || touchPoints,
    isSmallScreen: matchMedia?.(SMALL_SCREEN_QUERY).matches ?? false,
  }
}

/**
 * Modo de interfaz que se SUGIERE para el dispositivo: solo un teléfono/
 * tablet chica táctil arranca en `venta`; todo lo demás en `gestion`.
 * Es únicamente el valor de primera vez: nunca pisa una preferencia guardada.
 */
export function suggestUiMode({ isTouchDevice, isSmallScreen }: DeviceCapabilities = detectDeviceCapabilities()): UiMode {
  return isTouchDevice && isSmallScreen ? 'venta' : 'gestion'
}

/**
 * Escucha los cambios de una consulta. Safari anterior a 14 solo trae el
 * `addListener` viejo y algunos entornos ni eso: sin ninguno, la lectura
 * inicial sigue valiendo y nada falla.
 */
function subscribe(mql: MediaQueryList, listener: () => void): () => void {
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', listener)
    return () => mql.removeEventListener('change', listener)
  }
  if (typeof mql.addListener === 'function') {
    mql.addListener(listener)
    return () => mql.removeListener(listener)
  }
  return () => {}
}

export function useDeviceCapabilities(): { isTouchDevice: Ref<boolean>; isSmallScreen: Ref<boolean> } {
  const initial = detectDeviceCapabilities()
  const isTouchDevice = ref(initial.isTouchDevice)
  const isSmallScreen = ref(initial.isSmallScreen)

  const matchMedia = getMatchMedia()
  if (matchMedia) {
    const queries = [matchMedia(COARSE_POINTER_QUERY), matchMedia(SMALL_SCREEN_QUERY)]

    const refresh = () => {
      const current = detectDeviceCapabilities()
      isTouchDevice.value = current.isTouchDevice
      isSmallScreen.value = current.isSmallScreen
    }

    const unsubscribers = queries.map((mql) => subscribe(mql, refresh))

    // Se limpia al desmontar el componente (o al parar el scope que lo usa).
    if (getCurrentScope()) {
      onScopeDispose(() => unsubscribers.forEach((stop) => stop()))
    }
  }

  return { isTouchDevice, isSmallScreen }
}
