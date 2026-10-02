import { useSessionStore } from '@/stores/session.store'
import { currentSessionOwner } from './session-owner'
export { API_BASE_URL } from './session-owner'

/** Non-secret immutable routing identity; credentials are read only at send time. */
export interface QueueOrigin {
  accountId: string
  memberId: string
  deviceId: string
  apiBase: string
}

export function currentQueueOrigin(): QueueOrigin | null {
  const session = useSessionStore()
  if (!session.memberId || !session.deviceId) return null
  session.reconcileOwnership()
  const owner = currentSessionOwner()
  return owner && session.memberId && session.deviceId
    ? { ...owner, memberId: session.memberId, deviceId: session.deviceId } : null
}

/** Member changes on a shared account preserve original attribution headers. */
export function canSendDebt(origin: QueueOrigin): boolean {
  const current = currentQueueOrigin()
  return !!current && current.accountId === origin.accountId && current.deviceId === origin.deviceId && current.apiBase === origin.apiBase
}
