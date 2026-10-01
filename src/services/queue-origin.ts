import { useSessionStore } from '@/stores/session.store'
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1'

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
  try {
    const token = localStorage.getItem('access_token')
    const segment = token?.split('.')[1]
    if (!segment) return null
    const claims: unknown = JSON.parse(atob(segment.replace(/-/g, '+').replace(/_/g, '/')))
    const sub = (claims as { sub?: unknown } | null)?.sub
    if (typeof sub !== 'string' || !sub) return null
    return { accountId: sub, memberId: session.memberId, deviceId: session.deviceId, apiBase: API_BASE_URL }
  } catch { return null }
}

/** Member changes on a shared account preserve original attribution headers. */
export function canSendDebt(origin: QueueOrigin): boolean {
  const current = currentQueueOrigin()
  return !!current && current.accountId === origin.accountId && current.deviceId === origin.deviceId && current.apiBase === origin.apiBase
}
