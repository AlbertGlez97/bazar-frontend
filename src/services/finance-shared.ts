/**
 * Helpers shared by the financial offline modules (contributions, expenses):
 * strict receipt primitives, plain-clone, scoped keys, backoff and the
 * classification of failed sends.
 */
export type FinanceFailureState = 'pending' | 'needs_review' | 'paused'

export const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
export const scopedKey = (scope: string, id: string) => JSON.stringify([scope, id])

export const isInstant = (v: unknown): v is string =>
  typeof v === 'string' &&
  /T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(v) &&
  Number.isFinite(Date.parse(v))

export const isUuid = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)

export const asObject = (v: unknown): Record<string, unknown> | null =>
  !!v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null

export const MAX_MONEY_MINOR = 2147483647

export const sameInstant = (a: string, b: string) => Date.parse(a) === Date.parse(b)

/** Bounded exponential backoff: 30s, 60s, 120s, 240s, then 5 minutes. */
export function nextAttemptAt(previousAttempts: number, now: number): number {
  return now + Math.min(300000, 30000 * 2 ** Math.min(previousAttempts, 4))
}

/** 401/403 pause; other 4xx (except 408/429) need review; everything else retries. */
export function classifyFinanceFailure(error: unknown): { state: FinanceFailureState; message: string } {
  const status = (error as { response?: { status?: number } })?.response?.status
  const state: FinanceFailureState =
    status === 401 || status === 403
      ? 'paused'
      : status && status >= 400 && status < 500 && status !== 408 && status !== 429
        ? 'needs_review'
        : 'pending'
  const message =
    state === 'paused'
      ? 'La sesión o el dispositivo no están autorizados. Confirma el origen y reintenta.'
      : state === 'needs_review'
        ? 'El servidor rechazó el registro. Revisa los datos; no se modificó el movimiento.'
        : 'No se pudo confirmar la sincronización. El registro sigue guardado y se reenviará con el mismo ID.'
  return { state, message }
}
