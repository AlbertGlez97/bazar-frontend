import type { Router } from 'vue-router'
import { landingFor } from '@/router/landing'
import type { UiMode } from '@/types/ui-mode.types'

/**
 * Operational screens the help page may send the reader back to. Help itself is
 * excluded so a hint can never create a loop.
 */
export const HELP_RETURN_ROUTES: readonly string[] = [
  'AppHome', 'ProductCatalog', 'Sale', 'Reports', 'CodigosQr', 'Incidencias', 'Deudas',
  'Settings', 'ChangePassword', 'Team', 'DevicesAdmin',
  'Contributions', 'FinanceOverview', 'Expenses', 'WorkShifts', 'FinanceReserves',
  'FinanceSimulator', 'FinanceAgreements', 'FinanceAgreementDetail',
]

const MAX_FROM_LENGTH = 2000

/** Cheap shape check: a short, local `/app` path without backslashes or control characters. */
export function isHelpFromShape(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= MAX_FROM_LENGTH
    && /^\/app(?:[/?#]|$)/.test(value)
    && !value.startsWith('//')
    // eslint-disable-next-line no-control-regex
    && !/[\\\u0000-\u001f\u007f]/.test(value)
}

export interface HelpReturnContext {
  router: Pick<Router, 'resolve'>
  isSocio: boolean
  mode: UiMode
}

/**
 * Where "Volver" goes. Resolves only known local operational routes. It never
 * uses browser back, which may leave the app, and never lets a forged hint
 * bypass the role or mode restrictions of the target route.
 */
export function safeHelpReturnTarget(from: unknown, { router, isSocio, mode }: HelpReturnContext): string | { name: 'AppHome' | 'Sale' } {
  if (isHelpFromShape(from)) {
    const target = router.resolve(from)
    if (typeof target.name === 'string' && HELP_RETURN_ROUTES.includes(target.name)
      && (!target.meta.requiresSocio || isSocio)
      && (!target.meta.requiresGestion || mode === 'gestion')) return target.fullPath
  }
  return landingFor(mode)
}
