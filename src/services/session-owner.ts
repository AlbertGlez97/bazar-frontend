/** Persistence routing identity only; the server still authenticates every request. */
export interface SessionOwner { accountId: string; apiBase: string }
export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '/api/v1').trim().replace(/\/+$/, '')
export function tokenAccountId(token: string | null): string | null {
  try {
    const segment = token?.split('.')[1]
    if (!segment) return null
    const claims: unknown = JSON.parse(atob(segment.replace(/-/g, '+').replace(/_/g, '/')))
    const sub = (claims as { sub?: unknown } | null)?.sub
    return typeof sub === 'string' && sub.trim() ? sub : null
  } catch { return null }
}
export function currentSessionOwner(): SessionOwner | null {
  const accountId = tokenAccountId(localStorage.getItem('access_token'))
  const expiry = Number(localStorage.getItem('token_expires_at'))
  return accountId && Number.isFinite(expiry) && expiry > Date.now() ? { accountId, apiBase: API_BASE_URL } : null
}
export function sameOwner(left: unknown, right: SessionOwner | null): boolean {
  const owner = left as Partial<SessionOwner> | null
  return !!owner && !!right && owner.accountId === right.accountId && owner.apiBase === right.apiBase
}
