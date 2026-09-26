import type { UiMode } from '@/types/ui-mode.types'

/**
 * Navegación lateral de `AppLayout`, declarativa: cada ítem es una fila con su
 * orden en cada modo. Para agregar uno basta una fila más (ver "Reportes", que
 * solo ven los socios y solo en Modo Gestión: `modes` y `socioOnly`).
 *
 * Por modo:
 * - **Modo Venta**: solo "Vender". Quien vende no ve nada más en el menú.
 * - **Modo Gestión**: "Inicio", "Productos", "Vender" y "Reportes" (este solo
 *   para socios), y el espacio para las secciones que vienen.
 *
 * Punto de extensión (secciones futuras: Comisiones, Deudas, ...): se agregan
 * como una fila más de `NAV_ITEMS` con `modes: ['gestion']` (y `socioOnly: true`
 * si son de socios) **cuando su ruta ya exista**. No se listan antes: un ítem
 * sin pantalla sería un enlace muerto. La ruta, además, debe declarar su
 * restricción en el guard (`requiresGestion`/`requiresSocio`); ocultar el
 * ítem del menú no basta.
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
  // "Vender" está en los dos modos: es lo único en Modo Venta y va después de
  // "Productos" en Modo Gestión.
  { to: '/app/venta', label: 'Vender', icon: '🛒', exact: false, order: { venta: 1, gestion: 3 } },
  // "Inicio" y "Productos": solo Modo Gestión. (El guard también saca de "Inicio"
  // a quien lo escriba en la URL en Modo Venta: ver `requiresGestion` en el router.)
  { to: '/app', label: 'Inicio', icon: '🏠', exact: true, modes: ['gestion'], order: { venta: 2, gestion: 1 } },
  { to: '/app/productos', label: 'Productos', icon: '📦', exact: false, modes: ['gestion'], order: { venta: 3, gestion: 2 } },
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
