/** Una vibración corta: "listo". */
export const HAPTIC_OK = 40
/** Dos vibraciones cortas: "algo no salió". */
export const HAPTIC_ERROR: number[] = [40, 60, 40]

/**
 * Vibración del dispositivo. `navigator.vibrate` no existe en iOS Safari y
 * algunos navegadores lo bloquean por política de permisos: aquí se detecta y
 * se absorbe cualquier fallo, así nunca rompe lo que la persona está haciendo.
 * Los componentes no llaman a `navigator.vibrate`; piden la vibración por aquí.
 */
export function useHaptics() {
  function supported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
  }

  /** `true` si el navegador aceptó la vibración. */
  function vibrate(pattern: number | number[]): boolean {
    if (!supported()) return false
    try {
      return navigator.vibrate(pattern)
    } catch {
      return false
    }
  }

  return { supported, vibrate }
}
