import type { UiMode } from '@/types/ui-mode.types'

/**
 * Navegación lateral de `AppLayout`, declarativa: cada ítem es una fila con su
 * orden en cada modo. Para agregar uno basta una fila más (ver "Reportes", que
 * solo ven los socios y solo en Modo Gestión: `modes` y `socioOnly`).
 */
export interface NavItemDef {
  to: string
  label: string
  icon: string
  /** `true` = solo activo en la ruta exacta (Inicio; '/app' es prefijo de todas) */
  exact: boolean
  /** Modos en los que aparece; sin valor, en todos */
  modes?: UiMode[]
  /** Solo lo ve un socio */
  socioOnly?: boolean
  /** Posición (menor = más arriba) en cada modo */
  order: Record<UiMode, number>
}

export interface NavContext {
  isSocio?: boolean
}

export const NAV_ITEMS: NavItemDef[] = [
  // "Vender" siempre está a la vista: primero en Modo Venta (es a lo que se viene),
  // después de "Productos" en Modo Gestión.
  { to: '/app/venta', label: 'Vender', icon: '🛒', exact: false, order: { venta: 1, gestion: 3 } },
  { to: '/app', label: 'Inicio', icon: '🏠', exact: true, order: { venta: 2, gestion: 1 } },
  { to: '/app/productos', label: 'Productos', icon: '📦', exact: false, order: { venta: 3, gestion: 2 } },
  // Reportes: solo socios y solo en Modo Gestión (la ruta lo exige también en el guard).
  { to: '/app/reportes', label: 'Reportes', icon: '📊', exact: false, modes: ['gestion'], socioOnly: true, order: { venta: 0, gestion: 4 } },
]

/** Ítems visibles para el modo y la persona, en el orden de ese modo. */
export function getNavItems(
  mode: UiMode,
  context: NavContext = {},
  items: NavItemDef[] = NAV_ITEMS,
): NavItemDef[] {
  return items
    .filter((item) => !item.modes || item.modes.includes(mode))
    .filter((item) => !item.socioOnly || context.isSocio === true)
    .sort((a, b) => a.order[mode] - b.order[mode])
}
