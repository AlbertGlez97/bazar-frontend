/**
 * Entradas de la pantalla de ajustes (`/app/ajustes`), declarativas como los
 * ítems de `nav-items.ts`: para agregar una basta una fila más. Las de
 * `socioOnly` no las ve un colaborador y sus rutas lo repiten en el guard
 * (`meta.requiresSocio`): ocultar el enlace no basta, y el backend igual
 * respondería 403.
 */
export interface SettingsItemDef {
  to: string
  label: string
  /** Una línea que dice para qué sirve, debajo del nombre */
  hint: string
  icon: string
  /** Solo lo ve un socio */
  socioOnly?: boolean
}

export interface SettingsContext {
  isSocio?: boolean
}

export const SETTINGS_ITEMS: SettingsItemDef[] = [
  {
    to: '/app/ajustes/contrasena',
    label: 'Cambiar mi contraseña',
    hint: 'Elige una contraseña nueva para tu inicio de sesión.',
    icon: '🔑',
  },
  {
    to: '/app/ajustes/equipo',
    label: 'Mi equipo',
    hint: 'Mira quién trabaja contigo y agrega a una persona nueva.',
    icon: '👥',
    socioOnly: true,
  },
  {
    to: '/app/ajustes/dispositivos',
    label: 'Dispositivos',
    hint: 'Registra tablets y teléfonos, y revoca o reemite su acceso.',
    icon: '📱',
    socioOnly: true,
  },
]

/** Entradas visibles para la persona, en el orden declarado. */
export function getSettingsItems(
  context: SettingsContext = {},
  items: SettingsItemDef[] = SETTINGS_ITEMS,
): SettingsItemDef[] {
  return items.filter((item) => !item.socioOnly || context.isSocio === true)
}
