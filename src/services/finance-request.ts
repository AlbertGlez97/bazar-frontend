import { currentQueueOrigin } from './queue-origin'
import type { FinanceOrigin } from './contributions-records'

/** Refuses to send when offline or when the selected person or device changed since the screen loaded. */
export function assertOrigin(origin: FinanceOrigin) {
  if (!navigator.onLine) throw new Error('Rules requests require a connection')
  const current = currentQueueOrigin()
  if (!current || (['accountId', 'apiBase', 'memberId', 'deviceId'] as const).some((key) => current[key] !== origin[key]))
    throw new Error('Rules origin no longer matches the active selection')
}

/** Axios options for a socio-only request: who is acting, on which device, checked at dispatch. */
export function socioRequest(origin: FinanceOrigin) {
  assertOrigin(origin)
  return { headers: { 'x-device-id': origin.deviceId }, financialOrigin: origin }
}
