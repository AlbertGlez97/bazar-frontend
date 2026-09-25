/**
 * Modo de interfaz.
 * - `venta`: presentación táctil y visual, pensada para atender en el mostrador.
 * - `gestion`: vista de administración (catálogo con acciones, filtros, etc.).
 */
export type UiMode = 'venta' | 'gestion'

export function isUiMode(value: unknown): value is UiMode {
  return value === 'venta' || value === 'gestion'
}
