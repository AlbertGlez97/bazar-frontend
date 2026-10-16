import { resolveHelpTarget } from '@/config/help-structure'
import type { HelpTarget } from '@/types/help.types'

/**
 * The one place that says which help the `?` opens on each route.
 * Route name -> category id, topic id or article id (`null`: no contextual help).
 */
export const HELP_ROUTE_CONTEXT: Readonly<Record<string, string | null>> = {
  AppHome: 'primeros-pasos',
  Sale: 'ventas.efectivo',
  ProductCatalog: 'productos',
  CodigosQr: 'productos.etiquetas-qr',
  Deudas: 'deudas',
  Reports: 'administracion.reportes',
  Incidencias: 'administracion.incidencias',
  Contributions: 'finanzas.aportaciones',
  FinanceOverview: 'finanzas.resumen',
  Expenses: 'finanzas.gastos',
  WorkShifts: 'finanzas.jornadas',
  FinanceReserves: 'finanzas.reservas',
  FinanceSimulator: 'finanzas.simulador',
  // The agreement detail also holds the payments; `finanzas.pagos` is reachable
  // through the `related` list of the Acuerdos topic.
  FinanceAgreements: 'finanzas.acuerdos',
  FinanceAgreementDetail: 'finanzas.acuerdos',
  Settings: 'dispositivos-sesion',
  ChangePassword: 'dispositivos-sesion.contrasena',
  Team: 'dispositivos-sesion.equipo',
  DevicesAdmin: 'dispositivos-sesion.dispositivos',
  Help: null,
}

const DEFAULT_TARGET_ID = 'primeros-pasos'
const HELP_PATH = /^\/app\/ayuda(?:[/?#]|$)/

/**
 * Help target for a route. `null` on the help page itself; an unknown route
 * falls back to Primeros pasos so the `?` never opens an empty drawer.
 */
export function helpTargetForRoute(routeName?: string | symbol | null, routePath?: string): HelpTarget | null {
  if (typeof routeName === 'string' && Object.prototype.hasOwnProperty.call(HELP_ROUTE_CONTEXT, routeName)) {
    const id = HELP_ROUTE_CONTEXT[routeName]
    return id ? resolveHelpTarget(id) : null
  }
  if (typeof routePath === 'string' && HELP_PATH.test(routePath)) return null
  return resolveHelpTarget(DEFAULT_TARGET_ID)
}
