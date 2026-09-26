import type { UiMode } from '@/types/ui-mode.types'

/**
 * Página de inicio de cada modo de interfaz.
 *
 * - Modo Venta: "Vender". Quien vende no tiene otra pantalla: "Inicio" y el
 *   resto de la gestión no se ofrecen ahí.
 * - Modo Gestión: "Inicio".
 *
 * Es una función pura y sin imports de router ni de stores, para que la usen
 * a la vez el guard (`router/index.ts`) y el layout al cambiar de modo sin
 * dependencias circulares. Toda redirección "a la casa de la app" debe pasar
 * por aquí y no nombrar `AppHome` a mano: en Modo Venta esa ruta no está
 * disponible y el destino correcto es Vender.
 */
export function landingFor(mode: UiMode): { name: 'AppHome' | 'Sale' } {
  return mode === 'gestion' ? { name: 'AppHome' } : { name: 'Sale' }
}
